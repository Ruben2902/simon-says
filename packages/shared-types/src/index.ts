export const SIMON_COLORS = ["green", "red", "yellow", "blue"] as const;

export type SimonColor = (typeof SIMON_COLORS)[number];

export type PlayerStatus =
  "waiting" | "ready" | "playing" | "completed" | "failed";

export interface PlayerSnapshot {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  score: number;
  status: PlayerStatus;
  progress: number;
}

export type RoomStatus =
  | "waiting-for-player"
  | "waiting-for-ready"
  | "starting"
  | "playing"
  | "finished";

export type GamePhase =
  | "lobby"
  | "countdown"
  | "showing-sequence"
  | "accepting-input"
  | "round-result"
  | "finished";

export interface RoomSnapshot {
  code: string;
  players: PlayerSnapshot[];
  status: RoomStatus;
  phase: GamePhase;
  round: number;
}

export type RoomErrorCode =
  | "INVALID_PAYLOAD"
  | "ALREADY_IN_ROOM"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "GAME_ALREADY_STARTED"
  | "INVALID_ROOM_STATE"
  | "PLAYER_NOT_FOUND"
  | "INPUT_LOCKED"
  | "RECONNECT_EXPIRED"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE";

export interface RoomErrorPayload {
  code: RoomErrorCode;
  message: string;
}

export type ActionAcknowledgement =
  { ok: true } | { ok: false; error: RoomErrorPayload };

export type RoomAcknowledgement =
  | {
      ok: true;
      data: {
        playerId: string;
        reconnectToken: string;
        room: RoomSnapshot;
      };
    }
  | { ok: false; error: RoomErrorPayload };

export interface GameStartingPayload {
  startsAt: number;
}

export interface GameSequencePayload {
  round: number;
  sequence: SimonColor[];
  playbackStartedAt: number;
  leadMs: number;
  stepMs: number;
  flashMs: number;
  inputOpensAt: number;
}

export interface GameInputEnabledPayload {
  round: number;
  deadlineAt: number;
}

export interface GamePlayerProgressPayload {
  players: PlayerSnapshot[];
}

export interface GameRoundResultPayload {
  round: number;
  players: PlayerSnapshot[];
  nextRoundAt: number;
}

export type GameFinishedReason =
  "opponent-failed" | "furthest-progress" | "draw" | "forfeit";

export interface GameFinishedPayload {
  winnerId: string | null;
  reason: GameFinishedReason;
  room: RoomSnapshot;
}

export interface GameSyncPayload {
  room: RoomSnapshot;
  sequenceEvent: GameSequencePayload | null;
  countdownEndsAt: number | null;
  inputDeadlineAt: number | null;
  finished: GameFinishedPayload | null;
}

export type ReconnectAcknowledgement =
  | {
      ok: true;
      data: {
        playerId: string;
        reconnectToken: string;
        sync: GameSyncPayload;
      };
    }
  | { ok: false; error: RoomErrorPayload };

export interface ClientToServerEvents {
  "room:create": (
    payload: { name: string },
    callback: (acknowledgement: RoomAcknowledgement) => void,
  ) => void;
  "room:join": (
    payload: { name: string; code: string },
    callback: (acknowledgement: RoomAcknowledgement) => void,
  ) => void;
  "room:reconnect": (
    payload: { code: string; reconnectToken: string },
    callback: (acknowledgement: ReconnectAcknowledgement) => void,
  ) => void;
  "room:leave": (
    callback: (acknowledgement: ActionAcknowledgement) => void,
  ) => void;
  "player:ready": (
    payload: { ready: boolean },
    callback: (acknowledgement: ActionAcknowledgement) => void,
  ) => void;
  "game:input": (
    payload: { color: SimonColor },
    callback: (acknowledgement: ActionAcknowledgement) => void,
  ) => void;
  "game:rematch": (
    callback: (acknowledgement: ActionAcknowledgement) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "room:updated": (room: RoomSnapshot) => void;
  "room:error": (error: RoomErrorPayload) => void;
  "game:starting": (payload: GameStartingPayload) => void;
  "game:sequence": (payload: GameSequencePayload) => void;
  "game:input-enabled": (payload: GameInputEnabledPayload) => void;
  "game:player-progress": (payload: GamePlayerProgressPayload) => void;
  "game:round-result": (payload: GameRoundResultPayload) => void;
  "game:finished": (payload: GameFinishedPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}
