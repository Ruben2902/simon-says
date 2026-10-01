import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { SIMON_COLORS } from "@simon/shared-types";
import type { RedisClientType } from "redis";
import { z } from "zod";

import type { PersistedRoom } from "../game/room-manager.js";

const playerSchema = z.object({
  id: z
    .string()
    .uuid()
    .or(z.string().regex(/^player-\d+$/)),
  name: z.string().min(1).max(18),
  connectionId: z.string().nullable(),
  connected: z.boolean(),
  ready: z.boolean(),
  score: z.number().int().nonnegative(),
  status: z.enum(["waiting", "ready", "playing", "completed", "failed"]),
  progress: z.number().int().nonnegative(),
  reconnectTokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  expired: z.boolean(),
  failedAt: z.number().int().nonnegative().nullable(),
});

const sequenceEventSchema = z
  .object({
    round: z.number().int().nonnegative(),
    sequence: z.array(z.enum(SIMON_COLORS)),
    playbackStartedAt: z.number().int().nonnegative(),
    leadMs: z.number().int().nonnegative(),
    stepMs: z.number().int().positive(),
    flashMs: z.number().int().positive(),
    inputOpensAt: z.number().int().nonnegative(),
  })
  .nullable();

const persistedRoomSchema = z.object({
  version: z.literal(1),
  code: z.string().regex(/^[A-Z2-9]{5}$/),
  players: z.array(playerSchema).max(2),
  status: z.enum([
    "waiting-for-player",
    "waiting-for-ready",
    "starting",
    "playing",
    "finished",
  ]),
  phase: z.enum([
    "lobby",
    "countdown",
    "showing-sequence",
    "accepting-input",
    "round-result",
    "finished",
  ]),
  round: z.number().int().nonnegative(),
  sequence: z.array(z.enum(SIMON_COLORS)),
  deadlineAt: z.number().int().nonnegative().nullable(),
  countdownEndsAt: z.number().int().nonnegative().nullable(),
  nextRoundAt: z.number().int().nonnegative().nullable(),
  sequenceEvent: sequenceEventSchema,
  winnerId: z.string().nullable(),
  finishedReason: z
    .enum(["opponent-failed", "furthest-progress", "draw", "forfeit"])
    .nullable(),
  updatedAt: z.number().int().nonnegative(),
});

function parseRoom(value: unknown): PersistedRoom {
  return persistedRoomSchema.parse(value) as PersistedRoom;
}

export interface RoomRepository {
  readonly mode: "file" | "memory" | "redis";
  create(room: PersistedRoom): Promise<boolean>;
  delete(code: string): Promise<void>;
  health(): Promise<boolean>;
  load(code: string): Promise<PersistedRoom | null>;
  loadAll(): Promise<PersistedRoom[]>;
  save(room: PersistedRoom): Promise<void>;
  withRoomLock<T>(code: string, task: () => Promise<T>): Promise<T>;
}

class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    }
  }
}

export class MemoryRoomRepository implements RoomRepository {
  readonly mode = "memory" as const;
  protected readonly rooms = new Map<string, PersistedRoom>();
  private readonly mutex = new KeyedMutex();

  async create(room: PersistedRoom): Promise<boolean> {
    if (this.rooms.has(room.code)) {
      return false;
    }
    this.rooms.set(room.code, structuredClone(room));
    return true;
  }

  async delete(code: string): Promise<void> {
    this.rooms.delete(code);
  }

  async health(): Promise<boolean> {
    return true;
  }

  async load(code: string): Promise<PersistedRoom | null> {
    const room = this.rooms.get(code);
    return room ? structuredClone(room) : null;
  }

  async loadAll(): Promise<PersistedRoom[]> {
    return [...this.rooms.values()].map((room) => structuredClone(room));
  }

  async save(room: PersistedRoom): Promise<void> {
    this.rooms.set(room.code, structuredClone(room));
  }

  async withRoomLock<T>(code: string, task: () => Promise<T>): Promise<T> {
    return this.mutex.run(code, task);
  }
}

export class FileRoomRepository implements RoomRepository {
  readonly mode = "file" as const;
  private readonly mutex = new KeyedMutex();
  private readonly ioMutex = new KeyedMutex();
  private readonly records = new Map<string, PersistedRoom>();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  async create(room: PersistedRoom): Promise<boolean> {
    return this.ioMutex.run("file", async () => {
      await this.ensureLoaded();
      if (this.records.has(room.code)) {
        return false;
      }
      this.records.set(room.code, structuredClone(room));
      await this.flush();
      return true;
    });
  }

  async delete(code: string): Promise<void> {
    await this.ioMutex.run("file", async () => {
      await this.ensureLoaded();
      this.records.delete(code);
      await this.flush();
    });
  }

  async health(): Promise<boolean> {
    try {
      await this.ensureLoaded();
      return true;
    } catch {
      return false;
    }
  }

  async load(code: string): Promise<PersistedRoom | null> {
    await this.ensureLoaded();
    const room = this.records.get(code);
    return room ? structuredClone(room) : null;
  }

  async loadAll(): Promise<PersistedRoom[]> {
    await this.ensureLoaded();
    return [...this.records.values()].map((room) => structuredClone(room));
  }

  async save(room: PersistedRoom): Promise<void> {
    await this.ioMutex.run("file", async () => {
      await this.ensureLoaded();
      this.records.set(room.code, structuredClone(room));
      await this.flush();
    });
  }

  async withRoomLock<T>(code: string, task: () => Promise<T>): Promise<T> {
    return this.mutex.run(code, task);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = z.array(persistedRoomSchema).parse(JSON.parse(raw));
      for (const room of parsed) {
        this.records.set(room.code, room as PersistedRoom);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.loaded = false;
        throw error;
      }
    }
  }

  private async flush(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify([...this.records.values()]), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}

export class RedisRoomRepository implements RoomRepository {
  readonly mode = "redis" as const;

  constructor(
    private readonly client: RedisClientType,
    private readonly ttlSeconds: number,
    private readonly prefix = "simon:v1",
  ) {}

  async create(room: PersistedRoom): Promise<boolean> {
    const created = await this.client.set(
      this.roomKey(room.code),
      JSON.stringify(room),
      {
        EX: this.ttlSeconds,
        NX: true,
      },
    );
    if (created === "OK") {
      await this.client.sAdd(this.indexKey, room.code);
      return true;
    }
    return false;
  }

  async delete(code: string): Promise<void> {
    await Promise.all([
      this.client.del(this.roomKey(code)),
      this.client.sRem(this.indexKey, code),
    ]);
  }

  async health(): Promise<boolean> {
    try {
      return (await this.client.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async load(code: string): Promise<PersistedRoom | null> {
    const raw = await this.client.get(this.roomKey(code));
    return raw ? parseRoom(JSON.parse(raw)) : null;
  }

  async loadAll(): Promise<PersistedRoom[]> {
    const codes = await this.client.sMembers(this.indexKey);
    const rooms = await Promise.all(codes.map((code) => this.load(code)));
    const missingCodes = codes.filter((_, index) => rooms[index] === null);
    if (missingCodes.length > 0) {
      await this.client.sRem(this.indexKey, missingCodes);
    }
    return rooms.filter((room): room is PersistedRoom => room !== null);
  }

  async save(room: PersistedRoom): Promise<void> {
    await Promise.all([
      this.client.set(this.roomKey(room.code), JSON.stringify(room), {
        EX: this.ttlSeconds,
      }),
      this.client.sAdd(this.indexKey, room.code),
    ]);
  }

  async withRoomLock<T>(code: string, task: () => Promise<T>): Promise<T> {
    const lockKey = `${this.prefix}:lock:${code}`;
    const token = randomUUID();
    const expiresAt = Date.now() + 1_500;
    let acquired = false;

    while (!acquired && Date.now() < expiresAt) {
      acquired =
        (await this.client.set(lockKey, token, { NX: true, PX: 5_000 })) ===
        "OK";
      if (!acquired) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    if (!acquired) {
      throw new Error(`No se pudo adquirir el bloqueo de la sala ${code}.`);
    }

    try {
      return await task();
    } finally {
      await this.client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        { keys: [lockKey], arguments: [token] },
      );
    }
  }

  private get indexKey(): string {
    return `${this.prefix}:rooms`;
  }

  private roomKey(code: string): string {
    return `${this.prefix}:room:${code}`;
  }
}
