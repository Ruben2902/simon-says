import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@simon/shared-types";
import { io, type Socket } from "socket.io-client";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const gameServerUrl =
  process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:3001";

export function createGameSocket(): GameSocket {
  return io(gameServerUrl, {
    autoConnect: false,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  });
}
