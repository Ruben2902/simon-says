import { SIMON_COLORS } from "@simon/shared-types";
import type {
  ActionAcknowledgement,
  ClientToServerEvents,
  GameFinishedPayload,
  GameSyncPayload,
  InterServerEvents,
  RoomAcknowledgement,
  RoomErrorPayload,
  ServerToClientEvents,
  SocketData,
} from "@simon/shared-types";
import type { Server, Socket } from "socket.io";
import { z } from "zod";

import {
  RoomError,
  RoomManager,
  type InternalRoom,
} from "../game/room-manager.js";
import type { RoomRepository } from "../persistence/room-repository.js";
import { SlidingWindowRateLimiter } from "../security/sliding-window-rate-limiter.js";

type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const COUNTDOWN_MS = 2_400;
const SEQUENCE_LEAD_MS = 420;
const SEQUENCE_STEP_MS = 700;
const SEQUENCE_FLASH_MS = 430;
const POST_SEQUENCE_BUFFER_MS = 180;
const ROUND_RESULT_MS = 1_350;
const RECONNECT_GRACE_MS = 15_000;

const nameSchema = z
  .string()
  .trim()
  .min(1, "Escribe un nombre.")
  .max(18, "El nombre admite hasta 18 caracteres.")
  .regex(
    /^[\p{L}\p{N} _-]+$/u,
    "Usa solo letras, números, espacios, guiones o guiones bajos.",
  )
  .transform((name) => name.replace(/\s+/g, " "));
const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{5}$/, "El código debe tener cinco caracteres.");
const createRoomSchema = z.object({ name: nameSchema });
const joinRoomSchema = z.object({ name: nameSchema, code: roomCodeSchema });
const reconnectSchema = z.object({
  code: roomCodeSchema,
  reconnectToken: z.string().min(32).max(128),
});
const readySchema = z.object({ ready: z.boolean() });
const inputSchema = z.object({ color: z.enum(SIMON_COLORS) });

interface RegisterSocketHandlerOptions {
  onError?: (error: unknown) => void;
  repository: RoomRepository;
  roomManager?: RoomManager;
}

export interface GameCoordinator {
  restorePersistedRooms(): Promise<number>;
  shutdown(): void;
}

function invalidPayload(message: string): RoomErrorPayload {
  return { code: "INVALID_PAYLOAD", message };
}

function toRoomError(error: unknown): RoomErrorPayload {
  if (error instanceof RoomError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "SERVICE_UNAVAILABLE",
    message: "El servicio está ocupado. Inténtalo nuevamente.",
  };
}

function getPlayerId(socket: GameSocket): string {
  if (!socket.data.playerId) {
    throw new RoomError(
      "PLAYER_NOT_FOUND",
      "Tu sesión no pertenece a una sala activa.",
    );
  }
  return socket.data.playerId;
}

function getRoomCode(socket: GameSocket): string {
  if (!socket.data.roomCode) {
    throw new RoomError("ROOM_NOT_FOUND", "Tu sesión no pertenece a una sala.");
  }
  return socket.data.roomCode;
}

export function registerSocketHandlers(
  io: GameServer,
  options: RegisterSocketHandlerOptions,
): GameCoordinator {
  const roomManager = options.roomManager ?? new RoomManager();
  const repository = options.repository;
  const actionLimiter = new SlidingWindowRateLimiter();
  const roomTimers = new Map<string, Set<ReturnType<typeof setTimeout>>>();
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let shuttingDown = false;

  const reportError = (error: unknown) => options.onError?.(error);
  const clearRoomTimers = (code: string) => {
    const timers = roomTimers.get(code);
    timers?.forEach(clearTimeout);
    roomTimers.delete(code);
  };
  const clearDisconnectTimer = (playerId: string) => {
    const timer = disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(playerId);
    }
  };
  const schedule = (
    code: string,
    delayMs: number,
    task: () => Promise<void>,
  ) => {
    const timers = roomTimers.get(code) ?? new Set();
    roomTimers.set(code, timers);
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        void task().catch(reportError);
      },
      Math.max(0, delayMs),
    );
    timers.add(timer);
  };

  const assertRateLimit = (
    socket: GameSocket,
    action: string,
    limit: number,
    windowMs: number,
  ) => {
    if (!actionLimiter.consume(`${socket.id}:${action}`, limit, windowMs)) {
      throw new RoomError(
        "RATE_LIMITED",
        "Demasiadas acciones seguidas. Espera un momento.",
      );
    }
  };

  const loadRoom = async (code: string): Promise<InternalRoom> => {
    const persisted = await repository.load(code);
    if (!persisted) {
      roomManager.removeRoom(code);
      throw new RoomError("ROOM_NOT_FOUND", "No encontramos esa sala.");
    }
    return roomManager.hydrate(persisted);
  };

  const saveRoom = async (room: InternalRoom) => {
    await repository.save(roomManager.serialize(room));
  };

  const saveAndEmitRoom = async (room: InternalRoom) => {
    await saveRoom(room);
    io.to(room.code).emit("room:updated", roomManager.snapshot(room));
  };

  const buildSync = (room: InternalRoom): GameSyncPayload => {
    const snapshot = roomManager.snapshot(room);
    return {
      room: snapshot,
      sequenceEvent: room.sequenceEvent,
      countdownEndsAt: room.countdownEndsAt,
      inputDeadlineAt: room.deadlineAt,
      finished:
        room.status === "finished" && room.finishedReason
          ? {
              winnerId: room.winnerId,
              reason: room.finishedReason,
              room: snapshot,
            }
          : null,
    };
  };

  const finishMatchLocked = async (
    room: InternalRoom,
    winnerId: string | null,
    reason: GameFinishedPayload["reason"],
  ) => {
    const payload: GameFinishedPayload = {
      winnerId,
      reason,
      room: roomManager.snapshot(room),
    };
    await saveRoom(room);
    io.to(room.code).emit("room:updated", payload.room);
    io.to(room.code).emit("game:finished", payload);
  };

  const startRoundLocked = async (room: InternalRoom) => {
    if (
      room.status === "finished" ||
      (room.phase !== "countdown" && room.phase !== "round-result")
    ) {
      return;
    }

    const nextRoom = roomManager.startNextRound(room.code);
    const playbackStartedAt = Date.now();
    const playbackMs =
      SEQUENCE_LEAD_MS +
      nextRoom.sequence.length * SEQUENCE_STEP_MS +
      POST_SEQUENCE_BUFFER_MS;
    const inputOpensAt = playbackStartedAt + playbackMs;
    nextRoom.sequenceEvent = {
      round: nextRoom.round,
      sequence: [...nextRoom.sequence],
      playbackStartedAt,
      leadMs: SEQUENCE_LEAD_MS,
      stepMs: SEQUENCE_STEP_MS,
      flashMs: SEQUENCE_FLASH_MS,
      inputOpensAt,
    };
    await saveAndEmitRoom(nextRoom);
    io.to(nextRoom.code).emit("game:sequence", nextRoom.sequenceEvent);
    schedule(nextRoom.code, playbackMs, () => enableInput(nextRoom.code));
  };

  const resolveRoundLocked = async (room: InternalRoom) => {
    if (!roomManager.hasRoundResolved(room)) {
      await saveRoom(room);
      return;
    }

    clearRoomTimers(room.code);
    const resolution = roomManager.resolveRound(room.code);
    if (resolution.kind === "finished") {
      await finishMatchLocked(
        room,
        resolution.winnerId,
        resolution.reason ?? "draw",
      );
      return;
    }

    const nextRoundAt = Date.now() + ROUND_RESULT_MS;
    room.nextRoundAt = nextRoundAt;
    await saveAndEmitRoom(room);
    io.to(room.code).emit("game:round-result", {
      round: room.round,
      players: roomManager.snapshot(room).players,
      nextRoundAt,
    });
    schedule(room.code, ROUND_RESULT_MS, () => startRound(room.code));
  };

  const startRound = async (code: string) => {
    await repository.withRoomLock(code, async () => {
      const room = await loadRoom(code);
      await startRoundLocked(room);
    });
  };

  const enableInput = async (code: string) => {
    await repository.withRoomLock(code, async () => {
      const room = await loadRoom(code);
      if (room.phase !== "showing-sequence") {
        return;
      }
      const inputWindowMs = Math.max(7_000, room.sequence.length * 2_200);
      const deadlineAt = Date.now() + inputWindowMs;
      roomManager.enableInput(code, deadlineAt);
      await saveAndEmitRoom(room);
      io.to(code).emit("game:input-enabled", { round: room.round, deadlineAt });
      schedule(code, inputWindowMs, () => timeoutRound(code));
    });
  };

  const timeoutRound = async (code: string) => {
    await repository.withRoomLock(code, async () => {
      const room = await loadRoom(code);
      if (room.phase !== "accepting-input") {
        return;
      }
      roomManager.timeoutPendingPlayers(code);
      io.to(code).emit("game:player-progress", {
        players: roomManager.snapshot(room).players,
      });
      await resolveRoundLocked(room);
    });
  };

  const startMatchLocked = async (room: InternalRoom) => {
    clearRoomTimers(room.code);
    const nextRoom = roomManager.beginMatch(room.code);
    const startsAt = Date.now() + COUNTDOWN_MS;
    nextRoom.countdownEndsAt = startsAt;
    await saveAndEmitRoom(nextRoom);
    io.to(nextRoom.code).emit("game:starting", { startsAt });
    schedule(nextRoom.code, COUNTDOWN_MS, () => startRound(nextRoom.code));
  };

  const persistLeaveResultLocked = async (
    code: string,
    result: ReturnType<RoomManager["leavePlayer"]>,
  ) => {
    const room = roomManager.getRoom(code);
    if (!room || !result.room) {
      await repository.delete(code);
      clearRoomTimers(code);
      return;
    }

    await saveRoom(room);
    io.to(code).emit("room:updated", result.room);
    if (result.finished) {
      clearRoomTimers(code);
      io.to(code).emit("game:finished", {
        winnerId: result.finished.winnerId,
        reason: result.finished.reason,
        room: result.room,
      });
    }
  };

  const restorePersistedRooms = async (): Promise<number> => {
    const records = await repository.loadAll();
    for (const record of records) {
      const room = roomManager.hydrate(record);
      if (room.phase === "countdown" && room.countdownEndsAt) {
        schedule(room.code, room.countdownEndsAt - Date.now(), () =>
          startRound(room.code),
        );
      } else if (room.phase === "showing-sequence" && room.sequenceEvent) {
        schedule(room.code, room.sequenceEvent.inputOpensAt - Date.now(), () =>
          enableInput(room.code),
        );
      } else if (room.phase === "accepting-input" && room.deadlineAt) {
        schedule(room.code, room.deadlineAt - Date.now(), () =>
          timeoutRound(room.code),
        );
      } else if (room.phase === "round-result" && room.nextRoundAt) {
        schedule(room.code, room.nextRoundAt - Date.now(), () =>
          startRound(room.code),
        );
      }
    }
    return records.length;
  };

  io.on("connection", (socket) => {
    socket.on("room:create", async (payload, callback) => {
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) {
        callback({
          ok: false,
          error: invalidPayload(
            parsed.error.issues[0]?.message ?? "Datos inválidos.",
          ),
        });
        return;
      }

      try {
        assertRateLimit(socket, "membership", 8, 60_000);
        const room = roomManager.createRoom(socket.id, parsed.data.name);
        const playerId = roomManager.getPlayerIdForConnection(socket.id);
        const reconnectToken = roomManager.getReconnectToken(playerId);
        if (!(await repository.create(roomManager.serialize(room)))) {
          roomManager.removeRoom(room.code);
          throw new RoomError(
            "INVALID_ROOM_STATE",
            "No fue posible reservar una sala. Inténtalo nuevamente.",
          );
        }
        await socket.join(room.code);
        socket.data.playerId = playerId;
        socket.data.roomCode = room.code;
        const acknowledgement: RoomAcknowledgement = {
          ok: true,
          data: { playerId, reconnectToken, room: roomManager.snapshot(room) },
        };
        callback(acknowledgement);
        io.to(room.code).emit("room:updated", roomManager.snapshot(room));
      } catch (error) {
        reportError(error);
        callback({ ok: false, error: toRoomError(error) });
      }
    });

    socket.on("room:join", async (payload, callback) => {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        callback({
          ok: false,
          error: invalidPayload(
            parsed.error.issues[0]?.message ?? "Datos inválidos.",
          ),
        });
        return;
      }

      try {
        assertRateLimit(socket, "membership", 8, 60_000);
        await repository.withRoomLock(parsed.data.code, async () => {
          await loadRoom(parsed.data.code);
          const room = roomManager.joinRoom(
            socket.id,
            parsed.data.code,
            parsed.data.name,
          );
          const playerId = roomManager.getPlayerIdForConnection(socket.id);
          const reconnectToken = roomManager.getReconnectToken(playerId);
          await saveRoom(room);
          await socket.join(room.code);
          socket.data.playerId = playerId;
          socket.data.roomCode = room.code;
          callback({
            ok: true,
            data: {
              playerId,
              reconnectToken,
              room: roomManager.snapshot(room),
            },
          });
          io.to(room.code).emit("room:updated", roomManager.snapshot(room));
        });
      } catch (error) {
        reportError(error);
        callback({ ok: false, error: toRoomError(error) });
      }
    });

    socket.on("room:reconnect", async (payload, callback) => {
      const parsed = reconnectSchema.safeParse(payload);
      if (!parsed.success) {
        callback({
          ok: false,
          error: invalidPayload("La sesión guardada no es válida."),
        });
        return;
      }

      try {
        assertRateLimit(socket, "membership", 8, 60_000);
        await repository.withRoomLock(parsed.data.code, async () => {
          await loadRoom(parsed.data.code);
          const result = roomManager.reconnect(
            socket.id,
            parsed.data.code,
            parsed.data.reconnectToken,
          );
          clearDisconnectTimer(result.playerId);
          await saveRoom(result.room);
          await socket.join(result.room.code);
          socket.data.playerId = result.playerId;
          socket.data.roomCode = result.room.code;
          callback({
            ok: true,
            data: {
              playerId: result.playerId,
              reconnectToken: result.reconnectToken,
              sync: buildSync(result.room),
            },
          });
          io.to(result.room.code).emit(
            "room:updated",
            roomManager.snapshot(result.room),
          );
        });
      } catch (error) {
        reportError(error);
        callback({ ok: false, error: toRoomError(error) });
      }
    });

    socket.on("player:ready", async (payload, callback) => {
      const parsed = readySchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, error: invalidPayload("Estado no válido.") });
        return;
      }

      try {
        assertRateLimit(socket, "control", 20, 60_000);
        const code = getRoomCode(socket);
        await repository.withRoomLock(code, async () => {
          await loadRoom(code);
          const playerId = getPlayerId(socket);
          roomManager.assertPlayerConnection(playerId, socket.id);
          const room = roomManager.setReady(playerId, parsed.data.ready);
          if (roomManager.canStart(room)) {
            await startMatchLocked(room);
          } else {
            await saveAndEmitRoom(room);
          }
          callback({ ok: true });
        });
      } catch (error) {
        reportError(error);
        callback({ ok: false, error: toRoomError(error) });
      }
    });

    socket.on("game:input", async (payload, callback) => {
      const parsed = inputSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, error: invalidPayload("Color no válido.") });
        return;
      }

      try {
        assertRateLimit(socket, "input", 20, 1_000);
        const code = getRoomCode(socket);
        await repository.withRoomLock(code, async () => {
          const room = await loadRoom(code);
          const playerId = getPlayerId(socket);
          roomManager.assertPlayerConnection(playerId, socket.id);
          const { accepted } = roomManager.submitInput(
            playerId,
            parsed.data.color,
          );
          const acknowledgement: ActionAcknowledgement = accepted
            ? { ok: true }
            : {
                ok: false,
                error: {
                  code: "INPUT_LOCKED",
                  message: "Tu respuesta para esta ronda ya terminó.",
                },
              };
          callback(acknowledgement);
          io.to(code).emit("game:player-progress", {
            players: roomManager.snapshot(room).players,
          });
          await resolveRoundLocked(room);
        });
      } catch (error) {
        reportError(error);
        callback({ ok: false, error: toRoomError(error) });
      }
    });

    socket.on("game:rematch", async (callback) => {
      try {
        assertRateLimit(socket, "control", 20, 60_000);
        const code = getRoomCode(socket);
        await repository.withRoomLock(code, async () => {
          await loadRoom(code);
          const playerId = getPlayerId(socket);
          roomManager.assertPlayerConnection(playerId, socket.id);
          const room = roomManager.requestRematch(playerId);
          clearRoomTimers(code);
          await saveAndEmitRoom(room);
          callback({ ok: true });
        });
      } catch (error) {
        reportError(error);
        callback({ ok: false, error: toRoomError(error) });
      }
    });

    socket.on("room:leave", async (callback) => {
      const code = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!code || !playerId) {
        callback({ ok: true });
        return;
      }

      try {
        clearDisconnectTimer(playerId);
        await repository.withRoomLock(code, async () => {
          await loadRoom(code);
          roomManager.assertPlayerConnection(playerId, socket.id);
          const result = roomManager.leavePlayer(playerId);
          await persistLeaveResultLocked(code, result);
        });
        await socket.leave(code);
        socket.data.playerId = undefined;
        socket.data.roomCode = undefined;
        callback({ ok: true });
      } catch (error) {
        reportError(error);
        callback({ ok: false, error: toRoomError(error) });
      }
    });

    socket.on("disconnect", () => {
      if (shuttingDown) {
        return;
      }
      const code = socket.data.roomCode;
      const playerId = socket.data.playerId;
      actionLimiter.clearPrefix(`${socket.id}:`);
      if (!code || !playerId) {
        return;
      }

      void repository
        .withRoomLock(code, async () => {
          await loadRoom(code);
          const room = roomManager.markDisconnected(playerId, socket.id);
          if (!room) {
            return;
          }
          await saveAndEmitRoom(room);
          clearDisconnectTimer(playerId);
          const timer = setTimeout(() => {
            disconnectTimers.delete(playerId);
            void repository
              .withRoomLock(code, async () => {
                await loadRoom(code);
                const result = roomManager.expireDisconnectedPlayer(playerId);
                await persistLeaveResultLocked(code, result);
              })
              .catch(reportError);
          }, RECONNECT_GRACE_MS);
          disconnectTimers.set(playerId, timer);
        })
        .catch(reportError);
    });
  });

  return {
    restorePersistedRooms,
    shutdown() {
      shuttingDown = true;
      for (const code of roomTimers.keys()) {
        clearRoomTimers(code);
      }
      for (const timer of disconnectTimers.values()) {
        clearTimeout(timer);
      }
      disconnectTimers.clear();
    },
  };
}
