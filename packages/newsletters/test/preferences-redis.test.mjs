import assert from "node:assert/strict";
import test from "node:test";

import { createRedisStore } from "../src/preferences-server.mjs";

test("uses atomic expiring token, consume, rate-limit, and lock commands", async () => {
  const commands = [];
  const results = ["OK", "encrypted", 2, 1];
  const redis = createRedisStore({
    url: "https://redis.example/",
    token: "secret",
    fetchImpl: async (_url, options) => {
      commands.push(JSON.parse(options.body));
      return Response.json({ result: results.shift() });
    },
  });

  assert.equal(await redis.setOnce("token-key", "encrypted", 900), true);
  assert.equal(await redis.consume("token-key"), "encrypted");
  assert.equal(await redis.incrementWithExpiry("rate-key", 60), 2);
  assert.equal(await redis.releaseLock("lock-key", "owner"), 1);

  assert.deepEqual(commands[0], ["SET", "token-key", "encrypted", "EX", 900, "NX"]);
  assert.deepEqual(commands[1], ["GETDEL", "token-key"]);
  assert.equal(commands[2][0], "EVAL");
  assert.deepEqual(commands[2].slice(2), ["1", "rate-key", "60"]);
  assert.equal(commands[3][0], "EVAL");
  assert.deepEqual(commands[3].slice(2), ["1", "lock-key", "owner"]);
});

test("fails closed when Redis returns an error", async () => {
  const redis = createRedisStore({
    url: "https://redis.example",
    token: "secret",
    fetchImpl: async () => Response.json({ error: "nope" }),
  });

  await assert.rejects(() => redis.consume("key"), /Redis command failed/);
});
