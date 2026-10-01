import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RedisClientType } from "redis";
import { afterEach, describe, expect, it } from "vitest";

import { RoomManager } from "../game/room-manager.js";
import {
  FileRoomRepository,
  MemoryRoomRepository,
  RedisRoomRepository,
} from "./room-repository.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function createRecord() {
  const manager = new RoomManager(
    () => 0,
    () => "ABCDE",
  );
  const room = manager.createRoom("socket-1", "Ada");
  return manager.serialize(room);
}

describe("room repositories", () => {
  it("isolates returned memory records from later mutations", async () => {
    const repository = new MemoryRoomRepository();
    const record = createRecord();
    await repository.save(record);

    const loaded = await repository.load(record.code);
    loaded!.round = 99;

    expect((await repository.load(record.code))?.round).toBe(0);
  });

  it("restores rooms from the local atomic file store", async () => {
    const directory = await mkdtemp(join(tmpdir(), "simon-rooms-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "rooms.json");
    const record = createRecord();

    await new FileRoomRepository(path).save(record);
    const restored = await new FileRoomRepository(path).loadAll();

    expect(restored).toEqual([record]);
    expect((await readFile(path, "utf8")).toString()).not.toContain(
      'reconnectToken"',
    );
  });

  it("creates, refreshes and deletes rooms through the Redis contract", async () => {
    const strings = new Map<string, string>();
    const sets = new Map<string, Set<string>>();
    const redis = {
      async set(key: string, value: string, options?: { NX?: boolean }) {
        if (options?.NX && strings.has(key)) {
          return null;
        }
        strings.set(key, value);
        return "OK";
      },
      async get(key: string) {
        return strings.get(key) ?? null;
      },
      async del(key: string) {
        return strings.delete(key) ? 1 : 0;
      },
      async sAdd(key: string, value: string) {
        const set = sets.get(key) ?? new Set<string>();
        set.add(value);
        sets.set(key, set);
        return 1;
      },
      async sRem(key: string, values: string | string[]) {
        const set = sets.get(key);
        for (const value of Array.isArray(values) ? values : [values]) {
          set?.delete(value);
        }
        return 1;
      },
      async sMembers(key: string) {
        return [...(sets.get(key) ?? [])];
      },
      async ping() {
        return "PONG";
      },
      async eval(
        _script: string,
        input: { keys: string[]; arguments: string[] },
      ) {
        const [key] = input.keys;
        const [owner] = input.arguments;
        if (strings.get(key) === owner) {
          strings.delete(key);
          return 1;
        }
        return 0;
      },
    } as unknown as RedisClientType;
    const repository = new RedisRoomRepository(redis, 3_600, "test");
    const record = createRecord();

    expect(await repository.create(record)).toBe(true);
    expect(await repository.create(record)).toBe(false);
    expect(await repository.loadAll()).toEqual([record]);
    await repository.withRoomLock(record.code, async () => {
      record.round = 2;
      await repository.save(record);
    });
    expect((await repository.load(record.code))?.round).toBe(2);
    await repository.delete(record.code);
    expect(await repository.loadAll()).toEqual([]);
  });
});
