import { resolve } from "node:path";

import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_001),
  HOST: z.string().min(1).default("0.0.0.0"),
  WEB_ORIGINS: z.string().min(1).default("http://localhost:3000"),
  REDIS_URL: z.string().url().optional(),
  ROOM_STORE_FILE: z.string().min(1).default("../../.data/rooms.json"),
  ROOM_TTL_SECONDS: z.coerce.number().int().min(300).default(86_400),
  HTTP_RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(120),
  TRUST_PROXY: booleanFromString,
});

export interface ServerConfig {
  environment: "development" | "test" | "production";
  host: string;
  httpRateLimitMax: number;
  port: number;
  redisUrl?: string;
  roomStoreFile: string;
  roomTtlSeconds: number;
  trustProxy: boolean;
  webOrigins: string[];
}

export function loadConfig(environment = process.env): ServerConfig {
  const parsed = configSchema.parse({
    ...environment,
    WEB_ORIGINS: environment.WEB_ORIGINS ?? environment.WEB_ORIGIN,
  });
  const webOrigins = parsed.WEB_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    environment: parsed.NODE_ENV,
    host: parsed.HOST,
    httpRateLimitMax: parsed.HTTP_RATE_LIMIT_MAX,
    port: parsed.PORT,
    redisUrl: parsed.REDIS_URL,
    roomStoreFile: resolve(process.cwd(), parsed.ROOM_STORE_FILE),
    roomTtlSeconds: parsed.ROOM_TTL_SECONDS,
    trustProxy: parsed.TRUST_PROXY,
    webOrigins,
  };
}
