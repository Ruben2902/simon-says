export const PLAYER_SESSION_STORAGE_KEY = "simon-says:player-session:v1";

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
}

export function readPlayerSession(): PlayerSession | null {
  try {
    const rawSession = window.sessionStorage.getItem(
      PLAYER_SESSION_STORAGE_KEY,
    );
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as Partial<PlayerSession>;
    if (
      typeof session.roomCode !== "string" ||
      typeof session.playerId !== "string" ||
      typeof session.reconnectToken !== "string"
    ) {
      clearPlayerSession();
      return null;
    }

    return session as PlayerSession;
  } catch {
    clearPlayerSession();
    return null;
  }
}

export function savePlayerSession(session: PlayerSession): void {
  try {
    window.sessionStorage.setItem(
      PLAYER_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
  } catch {
    // The live socket remains usable when browser storage is unavailable.
  }
}

export function clearPlayerSession(): void {
  try {
    window.sessionStorage.removeItem(PLAYER_SESSION_STORAGE_KEY);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}
