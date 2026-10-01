import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createAdapter } from "@socket.io/redis-adapter";
import Fastify from "fastify";
import { createClient, type RedisClientType } from "redis";
import { Server as SocketServer } from "socket.io";

import { loadConfig } from "./config.js";
import { RoomManager } from "./game/room-manager.js";
import {
  FileRoomRepository,
  RedisRoomRepository,
  type RoomRepository,
} from "./persistence/room-repository.js";
import { SlidingWindowRateLimiter } from "./security/sliding-window-rate-limiter.js";
import { registerSocketHandlers } from "./socket/register-handlers.js";

const config = loadConfig();
const allowedOrigins = new Set(config.webOrigins);
const isAllowedOrigin = (origin: string | undefined) =>
  origin === undefined || allowedOrigins.has(origin);

const app = Fastify({
  bodyLimit: 16 * 1_024,
  logger: true,
  requestTimeout: 10_000,
  trustProxy: config.trustProxy,
});

await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "same-site" },
});
await app.register(cors, {
  credentials: true,
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
});
await app.register(rateLimit, {
  max: config.httpRateLimitMax,
  timeWindow: "1 minute",
});

let redisPublisher: RedisClientType | null = null;
let redisSubscriber: RedisClientType | null = null;
let repository: RoomRepository;

if (config.redisUrl) {
  redisPublisher = createClient({ url: config.redisUrl });
  redisSubscriber = redisPublisher.duplicate();
  redisPublisher.on("error", (error) =>
    app.log.error(error, "Redis publisher error"),
  );
  redisSubscriber.on("error", (error) =>
    app.log.error(error, "Redis subscriber error"),
  );
  await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
  repository = new RedisRoomRepository(redisPublisher, config.roomTtlSeconds);
} else {
  repository = new FileRoomRepository(config.roomStoreFile);
}

app.get("/health", { config: { rateLimit: false } }, async () => ({
  service: "simon-server",
  status: "ok",
  timestamp: new Date().toISOString(),
}));

app.get("/ready", { config: { rateLimit: false } }, async (_request, reply) => {
  const ready = await repository.health();
  return reply.code(ready ? 200 : 503).send({
    persistence: repository.mode,
    status: ready ? "ready" : "unavailable",
  });
});

const handshakeLimiter = new SlidingWindowRateLimiter();
const io = new SocketServer(app.server, {
  allowRequest(request, callback) {
    const origin = request.headers.origin;
    const address = request.socket.remoteAddress ?? "unknown";
    const withinLimit = handshakeLimiter.consume(address, 30, 60_000);
    callback(null, isAllowedOrigin(origin) && withinLimit);
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 20_000,
    skipMiddlewares: false,
  },
  cors: {
    origin: config.webOrigins,
    credentials: true,
  },
  maxHttpBufferSize: 10_000,
  perMessageDeflate: false,
  pingInterval: 20_000,
  pingTimeout: 15_000,
});

if (redisPublisher && redisSubscriber) {
  io.adapter(createAdapter(redisPublisher, redisSubscriber));
}

const roomManager = new RoomManager();
const coordinator = registerSocketHandlers(io, {
  repository,
  roomManager,
  onError: (error) => app.log.error(error),
});
const restoredRooms = await coordinator.restorePersistedRooms();

app.get("/metrics", { config: { rateLimit: false } }, async () => ({
  activeConnections: io.engine.clientsCount,
  activeRooms: roomManager.listRooms().length,
  persistence: repository.mode,
  restoredRooms,
}));

let closing = false;
const closeGracefully = async (signal: string) => {
  if (closing) {
    return;
  }
  closing = true;
  app.log.info({ signal }, "Shutting down gracefully");
  coordinator.shutdown();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await app.close();
  await Promise.all([
    redisSubscriber?.isOpen ? redisSubscriber.quit() : Promise.resolve(),
    redisPublisher?.isOpen ? redisPublisher.quit() : Promise.resolve(),
  ]);
};

process.once("SIGINT", () => void closeGracefully("SIGINT"));
process.once("SIGTERM", () => void closeGracefully("SIGTERM"));

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    {
      origins: config.webOrigins,
      persistence: repository.mode,
      restoredRooms,
    },
    "Simon server ready",
  );
} catch (error) {
  app.log.error(error);
  await closeGracefully("startup-error");
  process.exitCode = 1;
}
