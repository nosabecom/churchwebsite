import assert from "node:assert/strict";
import test from "node:test";
import { BreezeReadOnlyClient, validateDiscoveryRange } from "../src/index.mjs";

const jsonResponse = (value, options = {}) =>
  new Response(JSON.stringify(value), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });

test("uses only GET requests against the configured HTTPS account host", async () => {
  const calls = [];
  const client = new BreezeReadOnlyClient({
    subdomain: "cornerstone",
    apiKey: "secret-key",
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse([]);
    },
    maximumRequests: 1,
  });

  await client.events({ start: "2026-08-01", end: "2026-08-31" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, "https://cornerstone.breezechms.com");
  assert.equal(calls[0].url.pathname, "/api/events");
  assert.equal(calls[0].url.searchParams.get("details"), "1");
  assert.equal(calls[0].url.searchParams.get("eligible"), "1");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[0].options.headers["Api-key"], "secret-key");
});

test("enforces the configured one-second spacing between requests", async () => {
  let clock = 1_000;
  const waits = [];
  const client = new BreezeReadOnlyClient({
    subdomain: "cornerstone",
    apiKey: "secret-key",
    fetchImplementation: async () => jsonResponse({}),
    now: () => clock,
    sleep: async (milliseconds) => {
      waits.push(milliseconds);
      clock += milliseconds;
    },
  });

  await client.accountSummary();
  clock += 500;
  await client.calendars();

  assert.deepEqual(waits, [500]);
});

test("serializes concurrent callers before applying request spacing", async () => {
  let clock = 1_000;
  const starts = [];
  const waits = [];
  const client = new BreezeReadOnlyClient({
    subdomain: "cornerstone",
    apiKey: "secret-key",
    fetchImplementation: async () => {
      starts.push(clock);
      return jsonResponse({});
    },
    now: () => clock,
    sleep: async (milliseconds) => {
      waits.push(milliseconds);
      clock += milliseconds;
    },
  });

  await Promise.all([
    client.accountSummary(),
    client.calendars(),
    client.locations(),
  ]);

  assert.deepEqual(starts, [1_000, 2_000, 3_000]);
  assert.deepEqual(waits, [1_000, 1_000]);
});

test("holds requests that would exceed the rolling per-minute ceiling", async () => {
  let clock = 1_000;
  const starts = [];
  const waits = [];
  const client = new BreezeReadOnlyClient({
    subdomain: "cornerstone",
    apiKey: "secret-key",
    fetchImplementation: async () => {
      starts.push(clock);
      return jsonResponse({});
    },
    maximumRequestsPerMinute: 3,
    now: () => clock,
    sleep: async (milliseconds) => {
      waits.push(milliseconds);
      clock += milliseconds;
    },
  });

  await client.accountSummary();
  await client.calendars();
  await client.locations();
  await client.accountSummary();

  assert.deepEqual(starts, [1_000, 2_000, 3_000, 61_000]);
  assert.deepEqual(waits, [1_000, 1_000, 58_000]);
});

test("rejects redirects without following them", async () => {
  const client = new BreezeReadOnlyClient({
    subdomain: "cornerstone",
    apiKey: "secret-key",
    fetchImplementation: async () =>
      new Response("", { status: 302, headers: { location: "https://example.com" } }),
    maximumRequests: 1,
  });

  await assert.rejects(() => client.accountSummary(), /unexpected redirect/);
});

test("rejects unsafe configuration and unbounded discovery ranges", () => {
  assert.throws(
    () => new BreezeReadOnlyClient({ subdomain: "evil.example.com", apiKey: "key" }),
    /subdomain only/,
  );
  assert.throws(
    () =>
      new BreezeReadOnlyClient({
        subdomain: "cornerstone",
        apiKey: "key",
        minimumIntervalMs: 500,
      }),
    /cannot be lower than 1000/,
  );
  assert.throws(
    () =>
      new BreezeReadOnlyClient({
        subdomain: "cornerstone",
        apiKey: "key",
        maximumRequestsPerMinute: 21,
      }),
    /cannot exceed Breeze's limit of 20/,
  );
  assert.throws(
    () => validateDiscoveryRange("2025-01-01", "2026-12-31"),
    /cannot exceed 366 days/,
  );
  assert.throws(
    () => validateDiscoveryRange("2026-08-31", "2026-08-01"),
    /on or after/,
  );
});

test("allowlists event log actions and caps request volume", async () => {
  const client = new BreezeReadOnlyClient({
    subdomain: "cornerstone",
    apiKey: "secret-key",
    fetchImplementation: async () => jsonResponse([]),
    maximumRequests: 1,
  });

  assert.throws(
    () =>
      client.accountLog({
        action: "person_updated",
        start: "2026-08-01",
        end: "2026-08-31",
      }),
    /Unsupported event log action/,
  );
  await client.locations();
  await assert.rejects(() => client.calendars(), /request ceiling/);
});
