"use client";

import type {
  GameFinishedPayload,
  GameSequencePayload,
  GameSyncPayload,
  PlayerSnapshot,
  RoomAcknowledgement,
  RoomErrorCode,
  RoomSnapshot,
  SimonColor,
} from "@simon/shared-types";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { createGameSocket, type GameSocket } from "@/lib/game-socket";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translations";
import {
  clearPlayerSession,
  readPlayerSession,
  savePlayerSession,
} from "@/lib/player-session";

import { useSimonAudio } from "./use-simon-audio";

const KEYBOARD_COLORS: Record<string, SimonColor> = {
  "1": "green",
  "2": "red",
  "3": "yellow",
  "4": "blue",
};

type InterfaceErrorCode = RoomErrorCode | "CONNECTION_FAILED" | "NAME_REQUIRED";

const ERROR_KEYS: Record<InterfaceErrorCode, TranslationKey> = {
  CONNECTION_FAILED: "error.connection",
  NAME_REQUIRED: "error.nameRequired",
  INVALID_PAYLOAD: "error.invalidPayload",
  ALREADY_IN_ROOM: "error.alreadyInRoom",
  ROOM_NOT_FOUND: "error.roomNotFound",
  ROOM_FULL: "error.roomFull",
  GAME_ALREADY_STARTED: "error.gameStarted",
  INVALID_ROOM_STATE: "error.invalidRoomState",
  PLAYER_NOT_FOUND: "error.playerNotFound",
  INPUT_LOCKED: "error.inputLocked",
  RECONNECT_EXPIRED: "error.reconnectExpired",
  RATE_LIMITED: "error.rateLimited",
  SERVICE_UNAVAILABLE: "error.serviceUnavailable",
};

const MESSAGE_KEYS: Record<RoomSnapshot["phase"], TranslationKey> = {
  lobby: "message.lobby",
  countdown: "message.countdown",
  "showing-sequence": "message.showingSequence",
  "accepting-input": "message.acceptingInput",
  "round-result": "message.roundResult",
  finished: "message.finished",
};

function updateRoomPlayers(
  room: RoomSnapshot | null,
  players: PlayerSnapshot[],
): RoomSnapshot | null {
  return room ? { ...room, players } : room;
}

export function useMultiplayerSession() {
  const { t } = useI18n();
  const socketRef = useRef<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<InterfaceErrorCode | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [roundData, setRoundData] = useState<GameSequencePayload | null>(null);
  const [activeColor, setActiveColor] = useState<SimonColor | null>(null);
  const [inputEnabled, setInputEnabled] = useState(false);
  const [inputDeadlineAt, setInputDeadlineAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [messageKey, setMessageKey] =
    useState<TranslationKey>("message.preparing");
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<GameFinishedPayload | null>(null);
  const [muted, setMuted] = useState(false);
  const playTone = useSimonAudio();

  const applySync = useCallback((sync: GameSyncPayload) => {
    setRoom(sync.room);
    setResult(sync.finished);
    setRoundData(sync.sequenceEvent);
    setCountdownEndsAt(sync.countdownEndsAt);
    setInputDeadlineAt(sync.inputDeadlineAt);
    setSecondsLeft(
      sync.inputDeadlineAt === null
        ? null
        : Math.max(0, Math.ceil((sync.inputDeadlineAt - Date.now()) / 1_000)),
    );
    setInputEnabled(
      sync.room.phase === "accepting-input" &&
        sync.inputDeadlineAt !== null &&
        sync.inputDeadlineAt > Date.now(),
    );
    setActiveColor(null);

    setMessageKey(MESSAGE_KEYS[sync.room.phase]);
  }, []);

  useEffect(() => {
    const socket = createGameSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setConnected(true);
      setErrorCode(null);
      const session = readPlayerSession();

      if (!session) {
        setRestoring(false);
        return;
      }

      setRestoring(true);
      socket.emit(
        "room:reconnect",
        { code: session.roomCode, reconnectToken: session.reconnectToken },
        (acknowledgement) => {
          setRestoring(false);
          if (!acknowledgement.ok) {
            clearPlayerSession();
            setPlayerId("");
            setRoom(null);
            setResult(null);
            setRoundData(null);
            setInputEnabled(false);
            setErrorCode(acknowledgement.error.code);
            return;
          }

          const {
            playerId: restoredPlayerId,
            reconnectToken,
            sync,
          } = acknowledgement.data;
          savePlayerSession({
            roomCode: sync.room.code,
            playerId: restoredPlayerId,
            reconnectToken,
          });
          setPlayerId(restoredPlayerId);
          applySync(sync);
        },
      );
    };
    const handleDisconnect = () => {
      setConnected(false);
      setRestoring(false);
      setInputEnabled(false);
    };
    const handleConnectError = () => {
      setConnected(false);
      setRestoring(false);
      setErrorCode("CONNECTION_FAILED");
    };
    const handleRoomUpdated = (nextRoom: RoomSnapshot) => {
      setRoom(nextRoom);
      if (nextRoom.phase === "lobby") {
        setResult(null);
        setRoundData(null);
        setInputDeadlineAt(null);
        setSecondsLeft(null);
        setMessageKey("message.lobby");
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("room:updated", handleRoomUpdated);
    socket.on("room:error", (roomError) => setErrorCode(roomError.code));
    socket.on("game:starting", ({ startsAt }) => {
      setCountdownEndsAt(startsAt);
      setInputDeadlineAt(null);
      setSecondsLeft(null);
      setMessageKey("message.countdown");
      setInputEnabled(false);
      setResult(null);
    });
    socket.on("game:sequence", (payload) => {
      setRoundData(payload);
      setCountdownEndsAt(null);
      setCountdown(null);
      setInputDeadlineAt(null);
      setSecondsLeft(null);
      setMessageKey("message.showingSequence");
      setInputEnabled(false);
    });
    socket.on("game:input-enabled", ({ deadlineAt }) => {
      setMessageKey("message.acceptingInput");
      setInputDeadlineAt(deadlineAt);
      setSecondsLeft(Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1_000)));
      setInputEnabled(true);
    });
    socket.on("game:player-progress", ({ players }) => {
      setRoom((current) => updateRoomPlayers(current, players));
    });
    socket.on("game:round-result", ({ players }) => {
      setRoom((current) => updateRoomPlayers(current, players));
      setInputEnabled(false);
      setInputDeadlineAt(null);
      setSecondsLeft(null);
      setMessageKey("message.roundResult");
    });
    socket.on("game:finished", (gameResult) => {
      setRoom(gameResult.room);
      setResult(gameResult);
      setInputEnabled(false);
      setInputDeadlineAt(null);
      setSecondsLeft(null);
      setActiveColor(null);
    });

    socket.connect();

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("room:updated");
      socket.off("room:error");
      socket.off("game:starting");
      socket.off("game:sequence");
      socket.off("game:input-enabled");
      socket.off("game:player-progress");
      socket.off("game:round-result");
      socket.off("game:finished");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [applySync]);

  useEffect(() => {
    if (countdownEndsAt === null) {
      return;
    }

    const updateCountdown = () => {
      setCountdown(
        Math.max(1, Math.ceil((countdownEndsAt - Date.now()) / 1_000)),
      );
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 150);
    return () => window.clearInterval(interval);
  }, [countdownEndsAt]);

  useEffect(() => {
    if (inputDeadlineAt === null) {
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, inputDeadlineAt - Date.now());
      setSecondsLeft(Math.ceil(remaining / 1_000));
      if (remaining === 0) {
        setInputEnabled(false);
      }
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 150);
    return () => window.clearInterval(interval);
  }, [inputDeadlineAt]);

  useEffect(() => {
    if (!roundData) {
      return;
    }

    const timers: number[] = [];
    roundData.sequence.forEach((color, index) => {
      const startAt =
        roundData.playbackStartedAt +
        roundData.leadMs +
        index * roundData.stepMs;
      const endAt = startAt + roundData.flashMs;
      if (endAt <= Date.now()) {
        return;
      }

      timers.push(
        window.setTimeout(
          () => {
            setActiveColor(color);
            if (!muted) {
              playTone(color, roundData.flashMs / 1_000);
            }
          },
          Math.max(0, startAt - Date.now()),
        ),
      );
      timers.push(
        window.setTimeout(
          () => setActiveColor(null),
          Math.max(0, endAt - Date.now()),
        ),
      );
    });

    return () => timers.forEach(window.clearTimeout);
  }, [muted, playTone, roundData]);

  const joinRoom = useCallback(
    (eventName: "room:create" | "room:join", name: string, code?: string) => {
      const socket = socketRef.current;
      const cleanName = name.trim();

      if (!socket || !cleanName) {
        setErrorCode("NAME_REQUIRED");
        return;
      }

      setPending(true);
      setErrorCode(null);

      const callback = (acknowledgement: RoomAcknowledgement) => {
        setPending(false);
        if (!acknowledgement.ok) {
          setErrorCode(acknowledgement.error.code);
          return;
        }

        const {
          playerId: nextPlayerId,
          reconnectToken,
          room: nextRoom,
        } = acknowledgement.data;
        savePlayerSession({
          roomCode: nextRoom.code,
          playerId: nextPlayerId,
          reconnectToken,
        });
        setPlayerId(nextPlayerId);
        setRoom(nextRoom);
      };

      if (eventName === "room:create") {
        socket.emit("room:create", { name: cleanName }, callback);
      } else {
        socket.emit(
          "room:join",
          { name: cleanName, code: code ?? "" },
          callback,
        );
      }
    },
    [],
  );

  const handleReady = (ready: boolean) => {
    socketRef.current?.emit("player:ready", { ready }, (acknowledgement) => {
      if (!acknowledgement.ok) {
        setErrorCode(acknowledgement.error.code);
      }
    });
  };

  const handleColor = useCallback(
    (color: SimonColor) => {
      if (!inputEnabled || !connected) {
        return;
      }

      setActiveColor(color);
      if (!muted) {
        playTone(color);
      }
      window.setTimeout(() => setActiveColor(null), 230);
      socketRef.current?.emit("game:input", { color }, (acknowledgement) => {
        if (
          !acknowledgement.ok &&
          acknowledgement.error.code !== "INPUT_LOCKED"
        ) {
          setErrorCode(acknowledgement.error.code);
        }
      });
    },
    [connected, inputEnabled, muted, playTone],
  );

  const handleKeyboardEvent = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches("input, textarea, select, button")) {
      return;
    }

    const color = KEYBOARD_COLORS[event.key];
    if (color && inputEnabled) {
      event.preventDefault();
      handleColor(color);
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => handleKeyboardEvent(event);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resetLocalRoom = () => {
    setRoom(null);
    setPlayerId("");
    setResult(null);
    setRoundData(null);
    setInputEnabled(false);
    setInputDeadlineAt(null);
    setSecondsLeft(null);
    setCountdown(null);
    setCountdownEndsAt(null);
    setErrorCode(null);
  };

  const handleLeave = () => {
    socketRef.current?.emit("room:leave", () => {
      clearPlayerSession();
      resetLocalRoom();
    });
  };

  const handleRematch = () => {
    socketRef.current?.emit("game:rematch", (acknowledgement) => {
      if (!acknowledgement.ok) {
        setErrorCode(acknowledgement.error.code);
      }
    });
  };

  return {
    activeColor,
    connected,
    countdown,
    error: errorCode ? t(ERROR_KEYS[errorCode]) : "",
    handleColor,
    handleLeave,
    handleReady,
    handleRematch,
    joinRoom,
    message: t(messageKey),
    muted,
    pending,
    playerId,
    restoring,
    result,
    room,
    roundData,
    secondsLeft,
    setMuted,
    usableInput: inputEnabled && connected && !restoring,
  };
}
