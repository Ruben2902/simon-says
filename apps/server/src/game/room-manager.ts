import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { pickRandomColor, type RandomSource } from "@simon/game-engine";
import type {
  GameFinishedReason,
  GamePhase,
  GameSequencePayload,
  PlayerSnapshot,
  RoomErrorCode,
  RoomSnapshot,
  RoomStatus,
  SimonColor,
} from "@simon/shared-types";

interface InternalPlayer extends PlayerSnapshot {
  connectionId: string | null;
  reconnectTokenHash: string;
  expired: boolean;
  failedAt: number | null;
}

export interface PersistedPlayer extends PlayerSnapshot {
  connectionId: string | null;
  reconnectTokenHash: string;
  expired: boolean;
  failedAt: number | null;
}

export interface PersistedRoom {
  version: 1;
  code: string;
  players: PersistedPlayer[];
  status: RoomStatus;
  phase: GamePhase;
  round: number;
  sequence: SimonColor[];
  deadlineAt: number | null;
  countdownEndsAt: number | null;
  nextRoundAt: number | null;
  sequenceEvent: GameSequencePayload | null;
  winnerId: string | null;
  finishedReason: GameFinishedReason | null;
  updatedAt: number;
}

export interface InternalRoom {
  code: string;
  players: Map<string, InternalPlayer>;
  status: RoomStatus;
  phase: GamePhase;
  round: number;
  sequence: SimonColor[];
  deadlineAt: number | null;
  countdownEndsAt: number | null;
  nextRoundAt: number | null;
  sequenceEvent: GameSequencePayload | null;
  winnerId: string | null;
  finishedReason: GameFinishedReason | null;
}

export interface RoundResolution {
  kind: "next-round" | "finished";
  winnerId: string | null;
  reason?: GameFinishedReason;
}

export interface DisconnectResult {
  code: string | null;
  room: RoomSnapshot | null;
  finished:
    | {
        winnerId: string | null;
        reason: GameFinishedReason;
      }
    | undefined;
}

export interface ReconnectResult {
  playerId: string;
  reconnectToken: string;
  room: InternalRoom;
}

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
  return Array.from(
    { length: 5 },
    () => ROOM_ALPHABET[randomInt(0, ROOM_ALPHABET.length)],
  ).join("");
}

function createReconnectToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashReconnectToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokensMatch(token: string, expectedHash: string): boolean {
  const supplied = Buffer.from(hashReconnectToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export class RoomError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, InternalRoom>();
  private readonly playerRooms = new Map<string, string>();
  private readonly connectionPlayers = new Map<string, string>();
  private readonly pendingReconnectTokens = new Map<string, string>();

  constructor(
    private readonly random: RandomSource = Math.random,
    private readonly codeFactory: () => string = generateRoomCode,
    private readonly playerIdFactory: () => string = randomUUID,
  ) {}

  createRoom(connectionId: string, name: string): InternalRoom {
    this.assertConnectionIsFree(connectionId);

    let code = this.codeFactory();
    let attempts = 0;
    while (this.rooms.has(code) && attempts < 20) {
      code = this.codeFactory();
      attempts += 1;
    }

    if (this.rooms.has(code)) {
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "No fue posible generar una sala. Inténtalo nuevamente.",
      );
    }

    const player = this.createPlayer(connectionId, name);
    const room: InternalRoom = {
      code,
      players: new Map([[player.id, player]]),
      status: "waiting-for-player",
      phase: "lobby",
      round: 0,
      sequence: [],
      deadlineAt: null,
      countdownEndsAt: null,
      nextRoundAt: null,
      sequenceEvent: null,
      winnerId: null,
      finishedReason: null,
    };

    this.rooms.set(code, room);
    this.registerPlayer(player, code, connectionId);
    return room;
  }

  joinRoom(connectionId: string, code: string, name: string): InternalRoom {
    this.assertConnectionIsFree(connectionId);
    const room = this.getRequiredRoom(code);

    if (room.players.size >= 2) {
      throw new RoomError("ROOM_FULL", "La sala ya tiene dos jugadores.");
    }
    if (room.status !== "waiting-for-player") {
      throw new RoomError(
        "GAME_ALREADY_STARTED",
        "La partida ya comenzó y no admite nuevos jugadores.",
      );
    }

    const player = this.createPlayer(connectionId, name);
    room.players.set(player.id, player);
    room.status = "waiting-for-ready";
    this.registerPlayer(player, room.code, connectionId);
    return room;
  }

  reconnect(
    connectionId: string,
    code: string,
    reconnectToken: string,
  ): ReconnectResult {
    this.assertConnectionIsFree(connectionId);
    const room = this.getRequiredRoom(code);
    const player = [...room.players.values()].find(
      (candidate) =>
        !candidate.expired &&
        tokensMatch(reconnectToken, candidate.reconnectTokenHash),
    );

    if (!player || this.playerRooms.get(player.id) !== room.code) {
      throw new RoomError(
        "RECONNECT_EXPIRED",
        "La reserva de tu lugar expiró. Entra nuevamente a la sala.",
      );
    }

    if (player.connectionId) {
      this.connectionPlayers.delete(player.connectionId);
    }
    player.connectionId = connectionId;
    player.connected = true;
    this.connectionPlayers.set(connectionId, player.id);

    return { playerId: player.id, reconnectToken, room };
  }

  getPlayerIdForConnection(connectionId: string): string {
    const playerId = this.connectionPlayers.get(connectionId);
    if (!playerId) {
      throw new RoomError(
        "PLAYER_NOT_FOUND",
        "No encontramos al jugador conectado.",
      );
    }
    return playerId;
  }

  assertPlayerConnection(playerId: string, connectionId: string): void {
    const room = this.getRequiredPlayerRoom(playerId);
    const player = this.getRequiredPlayer(room, playerId);
    if (!player.connected || player.connectionId !== connectionId) {
      throw new RoomError(
        "PLAYER_NOT_FOUND",
        "Esta conexión ya no controla al jugador.",
      );
    }
  }

  getReconnectToken(playerId: string): string {
    const token = this.pendingReconnectTokens.get(playerId);
    if (!token) {
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "El token de reconexión ya fue entregado.",
      );
    }
    this.pendingReconnectTokens.delete(playerId);
    return token;
  }

  setReady(playerId: string, ready: boolean): InternalRoom {
    const room = this.getRequiredPlayerRoom(playerId);
    if (
      room.status !== "waiting-for-player" &&
      room.status !== "waiting-for-ready"
    ) {
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "No puedes cambiar tu estado durante una partida.",
      );
    }

    const player = this.getRequiredPlayer(room, playerId);
    player.ready = ready;
    player.status = ready ? "ready" : "waiting";
    return room;
  }

  canStart(room: InternalRoom): boolean {
    return (
      room.players.size === 2 &&
      [...room.players.values()].every(
        (player) => player.ready && player.connected && !player.expired,
      )
    );
  }

  beginMatch(code: string): InternalRoom {
    const room = this.getRequiredRoom(code);
    if (!this.canStart(room)) {
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "Se necesitan dos jugadores listos y conectados para comenzar.",
      );
    }

    room.status = "starting";
    room.phase = "countdown";
    room.round = 0;
    room.sequence = [];
    room.deadlineAt = null;
    room.nextRoundAt = null;
    room.sequenceEvent = null;
    room.winnerId = null;
    room.finishedReason = null;
    for (const player of room.players.values()) {
      player.ready = false;
      player.score = 0;
      player.progress = 0;
      player.failedAt = null;
      player.status = "playing";
    }
    return room;
  }

  startNextRound(code: string): InternalRoom {
    const room = this.getRequiredRoom(code);
    if (room.status !== "starting" && room.status !== "playing") {
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "La sala no está preparada para iniciar una ronda.",
      );
    }

    room.status = "playing";
    room.phase = "showing-sequence";
    room.round += 1;
    room.sequence.push(pickRandomColor(this.random));
    room.deadlineAt = null;
    room.countdownEndsAt = null;
    room.nextRoundAt = null;
    for (const player of room.players.values()) {
      player.progress = 0;
      player.failedAt = null;
      player.status = "playing";
    }
    return room;
  }

  enableInput(code: string, deadlineAt: number): InternalRoom {
    const room = this.getRequiredRoom(code);
    if (room.phase !== "showing-sequence") {
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "La secuencia aún no está lista para responder.",
      );
    }
    room.phase = "accepting-input";
    room.deadlineAt = deadlineAt;
    return room;
  }

  submitInput(
    playerId: string,
    color: SimonColor,
  ): { room: InternalRoom; accepted: boolean } {
    const room = this.getRequiredPlayerRoom(playerId);
    if (room.phase !== "accepting-input") {
      throw new RoomError("INPUT_LOCKED", "Las respuestas están bloqueadas.");
    }

    const player = this.getRequiredPlayer(room, playerId);
    if (!player.connected || player.status !== "playing") {
      return { room, accepted: false };
    }

    if (room.sequence[player.progress] !== color) {
      player.status = "failed";
      player.failedAt = player.progress;
      return { room, accepted: true };
    }
    player.progress += 1;
    if (player.progress === room.sequence.length) {
      player.status = "completed";
      player.score = room.round;
    }
    return { room, accepted: true };
  }

  hasRoundResolved(room: InternalRoom): boolean {
    return [...room.players.values()].every(
      (player) => player.status === "completed" || player.status === "failed",
    );
  }

  timeoutPendingPlayers(code: string): InternalRoom {
    const room = this.getRequiredRoom(code);
    for (const player of room.players.values()) {
      if (player.status === "playing") {
        player.status = "failed";
        player.failedAt = player.progress;
      }
    }
    return room;
  }

  resolveRound(code: string): RoundResolution {
    const room = this.getRequiredRoom(code);
    if (!this.hasRoundResolved(room)) {
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "La ronda todavía tiene respuestas pendientes.",
      );
    }

    const players = [...room.players.values()];
    const completed = players.filter((player) => player.status === "completed");
    if (completed.length === players.length) {
      room.phase = "round-result";
      room.deadlineAt = null;
      return { kind: "next-round", winnerId: null };
    }
    if (completed.length === 1) {
      return this.finishRoom(room, completed[0].id, "opponent-failed");
    }

    const [first, second] = players;
    if (first.progress === second.progress) {
      return this.finishRoom(room, null, "draw");
    }
    const winner = first.progress > second.progress ? first : second;
    return this.finishRoom(room, winner.id, "furthest-progress");
  }

  requestRematch(playerId: string): InternalRoom {
    const room = this.getRequiredPlayerRoom(playerId);
    if (room.status !== "finished") {
      if (room.phase === "lobby") {
        return room;
      }
      throw new RoomError(
        "INVALID_ROOM_STATE",
        "La revancha solo está disponible al terminar la partida.",
      );
    }

    for (const player of [...room.players.values()]) {
      if (player.expired) {
        this.removePlayer(room, player.id);
      }
    }
    room.status =
      room.players.size === 2 ? "waiting-for-ready" : "waiting-for-player";
    room.phase = "lobby";
    room.round = 0;
    room.sequence = [];
    room.deadlineAt = null;
    room.countdownEndsAt = null;
    room.nextRoundAt = null;
    room.sequenceEvent = null;
    room.winnerId = null;
    room.finishedReason = null;
    for (const player of room.players.values()) {
      player.ready = false;
      player.score = 0;
      player.progress = 0;
      player.failedAt = null;
      player.status = "waiting";
    }
    return room;
  }

  markDisconnected(
    playerId: string,
    connectionId?: string,
  ): InternalRoom | undefined {
    const room = this.getPlayerRoom(playerId);
    const player = room?.players.get(playerId);
    if (
      !room ||
      !player ||
      player.expired ||
      (connectionId !== undefined &&
        player.connectionId !== null &&
        player.connectionId !== connectionId)
    ) {
      return undefined;
    }

    if (player.connectionId) {
      this.connectionPlayers.delete(player.connectionId);
    }
    player.connectionId = null;
    player.connected = false;
    return room;
  }

  expireDisconnectedPlayer(playerId: string): DisconnectResult {
    const room = this.getPlayerRoom(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player || player.connected) {
      return {
        code: room?.code ?? null,
        room: room ? this.snapshot(room) : null,
        finished: undefined,
      };
    }

    const wasActive = room.status === "starting" || room.status === "playing";
    player.expired = true;
    player.status = "failed";
    player.failedAt = player.progress;
    this.invalidatePlayerIdentity(player);
    if (wasActive) {
      const winner = [...room.players.values()].find(
        (candidate) => candidate.id !== playerId && !candidate.expired,
      );
      this.finishRoom(room, winner?.id ?? null, "forfeit");
      return {
        code: room.code,
        room: this.snapshot(room),
        finished: { winnerId: winner?.id ?? null, reason: "forfeit" },
      };
    }

    this.removePlayer(room, playerId);
    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      return { code: room.code, room: null, finished: undefined };
    }
    room.status = "waiting-for-player";
    room.phase = "lobby";
    room.round = 0;
    const remaining = [...room.players.values()][0];
    remaining.ready = false;
    remaining.status = "waiting";
    return { code: room.code, room: this.snapshot(room), finished: undefined };
  }

  leavePlayer(playerId: string): DisconnectResult {
    const room = this.getPlayerRoom(playerId);
    const player = room?.players.get(playerId);
    if (!room || !player) {
      return { code: null, room: null, finished: undefined };
    }

    const wasActive = room.status === "starting" || room.status === "playing";
    this.removePlayer(room, playerId);
    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      return { code: room.code, room: null, finished: undefined };
    }

    const remaining = [...room.players.values()][0];
    if (wasActive) {
      this.finishRoom(room, remaining.id, "forfeit");
      return {
        code: room.code,
        room: this.snapshot(room),
        finished: { winnerId: remaining.id, reason: "forfeit" },
      };
    }
    room.status = "waiting-for-player";
    room.phase = "lobby";
    room.round = 0;
    remaining.ready = false;
    remaining.status = "waiting";
    return { code: room.code, room: this.snapshot(room), finished: undefined };
  }

  getPlayerRoom(playerId: string): InternalRoom | undefined {
    const code = this.playerRooms.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  getRoom(code: string): InternalRoom | undefined {
    return this.rooms.get(code);
  }

  listRooms(): InternalRoom[] {
    return [...this.rooms.values()];
  }

  removeRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) {
      return;
    }
    for (const player of room.players.values()) {
      this.invalidatePlayerIdentity(player);
    }
    this.rooms.delete(code);
  }

  serialize(room: InternalRoom): PersistedRoom {
    return {
      version: 1,
      code: room.code,
      players: [...room.players.values()].map((player) => ({ ...player })),
      status: room.status,
      phase: room.phase,
      round: room.round,
      sequence: [...room.sequence],
      deadlineAt: room.deadlineAt,
      countdownEndsAt: room.countdownEndsAt,
      nextRoundAt: room.nextRoundAt,
      sequenceEvent: room.sequenceEvent
        ? { ...room.sequenceEvent, sequence: [...room.sequenceEvent.sequence] }
        : null,
      winnerId: room.winnerId,
      finishedReason: room.finishedReason,
      updatedAt: Date.now(),
    };
  }

  hydrate(record: PersistedRoom): InternalRoom {
    const previous = this.rooms.get(record.code);
    if (previous) {
      for (const player of previous.players.values()) {
        this.playerRooms.delete(player.id);
        if (player.connectionId) {
          this.connectionPlayers.delete(player.connectionId);
        }
      }
    }

    const players = new Map<string, InternalPlayer>();
    for (const persisted of record.players) {
      const player: InternalPlayer = { ...persisted };
      players.set(player.id, player);
      this.playerRooms.set(player.id, record.code);
      if (player.connectionId) {
        this.connectionPlayers.set(player.connectionId, player.id);
      }
    }
    const room: InternalRoom = {
      code: record.code,
      players,
      status: record.status,
      phase: record.phase,
      round: record.round,
      sequence: [...record.sequence],
      deadlineAt: record.deadlineAt,
      countdownEndsAt: record.countdownEndsAt,
      nextRoundAt: record.nextRoundAt,
      sequenceEvent: record.sequenceEvent
        ? {
            ...record.sequenceEvent,
            sequence: [...record.sequenceEvent.sequence],
          }
        : null,
      winnerId: record.winnerId,
      finishedReason: record.finishedReason,
    };
    this.rooms.set(room.code, room);
    return room;
  }

  snapshot(room: InternalRoom): RoomSnapshot {
    return {
      code: room.code,
      players: [...room.players.values()].map(
        ({
          connectionId: _connectionId,
          reconnectTokenHash: _reconnectTokenHash,
          expired: _expired,
          failedAt: _failedAt,
          ...player
        }) => ({ ...player }),
      ),
      status: room.status,
      phase: room.phase,
      round: room.round,
    };
  }

  private createPlayer(connectionId: string, name: string): InternalPlayer {
    const id = this.playerIdFactory();
    const reconnectToken = createReconnectToken();
    this.pendingReconnectTokens.set(id, reconnectToken);
    return {
      id,
      name,
      connected: true,
      connectionId,
      reconnectTokenHash: hashReconnectToken(reconnectToken),
      expired: false,
      ready: false,
      score: 0,
      status: "waiting",
      progress: 0,
      failedAt: null,
    };
  }

  private registerPlayer(
    player: InternalPlayer,
    code: string,
    connectionId: string,
  ): void {
    this.playerRooms.set(player.id, code);
    this.connectionPlayers.set(connectionId, player.id);
  }

  private removePlayer(room: InternalRoom, playerId: string): void {
    const player = room.players.get(playerId);
    if (!player) {
      return;
    }
    this.invalidatePlayerIdentity(player);
    room.players.delete(playerId);
  }

  private invalidatePlayerIdentity(player: InternalPlayer): void {
    if (player.connectionId) {
      this.connectionPlayers.delete(player.connectionId);
    }
    this.pendingReconnectTokens.delete(player.id);
    this.playerRooms.delete(player.id);
    player.connectionId = null;
  }

  private finishRoom(
    room: InternalRoom,
    winnerId: string | null,
    reason: GameFinishedReason,
  ): RoundResolution {
    room.status = "finished";
    room.phase = "finished";
    room.deadlineAt = null;
    room.countdownEndsAt = null;
    room.nextRoundAt = null;
    room.winnerId = winnerId;
    room.finishedReason = reason;
    return { kind: "finished", winnerId, reason };
  }

  private assertConnectionIsFree(connectionId: string): void {
    if (this.connectionPlayers.has(connectionId)) {
      throw new RoomError(
        "ALREADY_IN_ROOM",
        "Ya perteneces a una sala activa.",
      );
    }
  }

  private getRequiredRoom(code: string): InternalRoom {
    const room = this.rooms.get(code);
    if (!room) {
      throw new RoomError("ROOM_NOT_FOUND", "No encontramos esa sala.");
    }
    return room;
  }

  private getRequiredPlayerRoom(playerId: string): InternalRoom {
    const room = this.getPlayerRoom(playerId);
    if (!room) {
      throw new RoomError(
        "PLAYER_NOT_FOUND",
        "El jugador no pertenece a una sala.",
      );
    }
    return room;
  }

  private getRequiredPlayer(
    room: InternalRoom,
    playerId: string,
  ): InternalPlayer {
    const player = room.players.get(playerId);
    if (!player) {
      throw new RoomError(
        "PLAYER_NOT_FOUND",
        "El jugador no existe en la sala.",
      );
    }
    return player;
  }
}
