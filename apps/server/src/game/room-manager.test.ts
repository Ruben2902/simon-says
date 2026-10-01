import { describe, expect, it } from "vitest";

import { RoomError, RoomManager } from "./room-manager.js";

function createManager(colors: number[] = [0, 0.25, 0.5]) {
  let colorIndex = 0;
  let playerIndex = 0;
  return new RoomManager(
    () => colors[colorIndex++] ?? 0,
    () => "ABCDE",
    () => `player-${++playerIndex}`,
  );
}

function createReadyRoom(manager = createManager()) {
  const room = manager.createRoom("player-1", "Ada");
  manager.joinRoom("player-2", room.code, "Linus");
  manager.setReady("player-1", true);
  manager.setReady("player-2", true);
  return { manager, room };
}

describe("RoomManager", () => {
  it("creates a room and accepts exactly one opponent", () => {
    const manager = createManager();
    const room = manager.createRoom("player-1", "Ada");

    expect(room.code).toBe("ABCDE");
    expect(manager.snapshot(room).status).toBe("waiting-for-player");

    manager.joinRoom("player-2", room.code, "Linus");
    expect(manager.snapshot(room).players).toHaveLength(2);

    expect(() => manager.joinRoom("player-3", room.code, "Grace")).toThrow(
      RoomError,
    );
  });

  it("starts only when both players are ready", () => {
    const { manager, room } = createReadyRoom();

    expect(manager.canStart(room)).toBe(true);
    manager.beginMatch(room.code);
    expect(room.phase).toBe("countdown");
    expect(room.status).toBe("starting");
  });

  it("gives both players the same server-generated sequence", () => {
    const { manager, room } = createReadyRoom();
    manager.beginMatch(room.code);
    manager.startNextRound(room.code);

    expect(room.sequence).toEqual(["green"]);
    expect(
      manager.snapshot(room).players.every((player) => player.progress === 0),
    ).toBe(true);
  });

  it("advances when both players complete the round", () => {
    const { manager, room } = createReadyRoom();
    manager.beginMatch(room.code);
    manager.startNextRound(room.code);
    manager.enableInput(room.code, Date.now() + 10_000);

    manager.submitInput("player-1", "green");
    manager.submitInput("player-2", "green");

    expect(manager.hasRoundResolved(room)).toBe(true);
    expect(manager.resolveRound(room.code).kind).toBe("next-round");
  });

  it("declares a winner when the opponent fails", () => {
    const { manager, room } = createReadyRoom();
    manager.beginMatch(room.code);
    manager.startNextRound(room.code);
    manager.enableInput(room.code, Date.now() + 10_000);

    manager.submitInput("player-1", "green");
    manager.submitInput("player-2", "red");

    expect(manager.resolveRound(room.code)).toEqual({
      kind: "finished",
      winnerId: "player-1",
      reason: "opponent-failed",
    });
  });

  it("restores the same player when they reconnect during the grace period", () => {
    const { manager, room } = createReadyRoom();
    const reconnectToken = manager.getReconnectToken("player-2");

    manager.markDisconnected("player-2", "player-2");
    expect(manager.snapshot(room).players[1].connected).toBe(false);

    const result = manager.reconnect(
      "connection-new",
      room.code,
      reconnectToken,
    );

    expect(result.playerId).toBe("player-2");
    expect(manager.snapshot(room).players[1].connected).toBe(true);
  });

  it("persists only a hash of the reconnect token", () => {
    const manager = createManager();
    const room = manager.createRoom("socket-1", "Ada");
    const reconnectToken = manager.getReconnectToken("player-1");
    const record = manager.serialize(room);

    expect(JSON.stringify(record)).not.toContain(reconnectToken);
    expect(record.players[0].reconnectTokenHash).toHaveLength(64);
  });

  it("hydrates a persisted room and accepts its existing token", () => {
    const manager = createManager();
    const room = manager.createRoom("socket-1", "Ada");
    const reconnectToken = manager.getReconnectToken("player-1");
    const record = manager.serialize(room);
    const restored = createManager();

    restored.hydrate(record);
    restored.markDisconnected("player-1");
    const result = restored.reconnect("socket-new", room.code, reconnectToken);

    expect(result.playerId).toBe("player-1");
    expect(restored.snapshot(result.room).players[0].connected).toBe(true);
  });

  it("invalidates the previous connection after a token takeover", () => {
    const manager = createManager();
    const room = manager.createRoom("socket-old", "Ada");
    const reconnectToken = manager.getReconnectToken("player-1");

    manager.reconnect("socket-new", room.code, reconnectToken);

    expect(() =>
      manager.assertPlayerConnection("player-1", "socket-old"),
    ).toThrow(RoomError);
    expect(() =>
      manager.assertPlayerConnection("player-1", "socket-new"),
    ).not.toThrow();
  });

  it("removes a disconnected lobby player after the grace period", () => {
    const manager = createManager();
    const room = manager.createRoom("player-1", "Ada");
    const reconnectToken = manager.getReconnectToken("player-1");

    manager.markDisconnected("player-1");
    manager.expireDisconnectedPlayer("player-1");

    expect(() =>
      manager.reconnect("connection-new", room.code, reconnectToken),
    ).toThrow(RoomError);
  });

  it("awards a forfeit win after a disconnected player grace period expires", () => {
    const { manager, room } = createReadyRoom();
    manager.beginMatch(room.code);

    manager.markDisconnected("player-2");
    const result = manager.expireDisconnectedPlayer("player-2");

    expect(result.finished).toEqual({
      winnerId: "player-1",
      reason: "forfeit",
    });
    expect(result.room?.status).toBe("finished");
  });
});
