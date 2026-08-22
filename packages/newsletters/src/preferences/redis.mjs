const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

export function createRedisStore({ url, token, fetchImpl = fetch }) {
  if (!/^https:\/\//.test(url ?? "") || !token) {
    throw new Error("Upstash Redis REST configuration is incomplete.");
  }

  async function command(parts) {
    const response = await fetchImpl(withoutTrailingSlash(url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parts),
      signal: AbortSignal.timeout(5_000),
    });

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("Redis returned an invalid response.");
    }
    if (!response.ok || body?.error) {
      throw new Error("Redis command failed.");
    }
    return body?.result;
  }

  return {
    async setOnce(key, value, ttlSeconds) {
      return (await command(["SET", key, value, "EX", ttlSeconds, "NX"])) === "OK";
    },

    async consume(key) {
      return await command(["GETDEL", key]);
    },

    async set(key, value, ttlSeconds) {
      return (await command(["SET", key, value, "EX", ttlSeconds])) === "OK";
    },

    async incrementWithExpiry(key, ttlSeconds) {
      return Number(
        await command(["EVAL", RATE_LIMIT_SCRIPT, "1", key, String(ttlSeconds)]),
      );
    },

    async releaseLock(key, value) {
      return Number(
        await command(["EVAL", RELEASE_LOCK_SCRIPT, "1", key, value]),
      );
    },
  };
}
