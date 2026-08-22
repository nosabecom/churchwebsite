import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseBreezeMatch,
  createNewsletterPreferenceService,
} from "../src/preferences-server.mjs";

const baseEnv = {
  NEWSLETTER_ALLOWED_ORIGINS: "https://church.example,https://women.example",
  NEWSLETTER_VERIFICATION_SECRET:
    "a-development-secret-that-is-longer-than-32-characters",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  RESEND_API_KEY: "resend-token",
  NEWSLETTER_FROM_EMAIL: "Church <news@example.com>",
  NEWSLETTER_REVIEW_EMAIL: "review@example.com",
  BREEZE_SUBDOMAIN: "cornerstone",
  BREEZE_API_KEY: "breeze-token",
  BREEZE_EMAIL_FIELD_ID: "101",
  BREEZE_NEWSLETTER_PREFERENCE_FIELD_ID: "202",
  BREEZE_NEWSLETTER_SUBSCRIBE_OPTION_ID: "303",
  BREEZE_NEWSLETTER_UNSUBSCRIBE_OPTION_ID: "304",
};

function createDependencies(people = []) {
  const values = new Map();
  const sent = [];
  const updates = [];
  const created = [];
  return {
    values,
    sent,
    updates,
    created,
    dependencies: {
      redis: {
        async incrementWithExpiry() {
          return 1;
        },
        async setOnce(key, value) {
          if (values.has(key)) return false;
          values.set(key, value);
          return true;
        },
        async consume(key) {
          const value = values.get(key);
          values.delete(key);
          return value;
        },
        async set(key, value) {
          values.set(key, value);
          return true;
        },
        async releaseLock(key, value) {
          if (values.get(key) !== value) return 0;
          values.delete(key);
          return 1;
        },
      },
      mailer: {
        async sendVerification(message) {
          sent.push({ type: "verification", ...message });
        },
        async sendReviewNotice(message) {
          sent.push({ type: "review", ...message });
        },
      },
      breeze: {
        async lookupPeopleByEmail() {
          return people;
        },
        chooseMatch: chooseBreezeMatch,
        async updatePreference(personId, preference) {
          updates.push({ personId, preference });
        },
        async addSubscriber(payload) {
          created.push(payload);
          return [{ id: "new-person" }];
        },
      },
    },
  };
}

const submission = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  preference: "subscribe",
};

test("uses a single-use email token before updating one Breeze match", async () => {
  const state = createDependencies([
    { id: "7", first_name: "Ada", last_name: "Lovelace" },
  ]);
  const service = createNewsletterPreferenceService({
    env: baseEnv,
    dependencies: state.dependencies,
    idFactory: () => "request-1",
    tokenFactory: () => "a".repeat(43),
    now: () => 1_000,
  });

  const requested = await service.requestVerification({
    submission,
    clientIp: "192.0.2.1",
    origin: "https://church.example",
  });
  const firstResult = await service.verify("a".repeat(43));
  const replayResult = await service.verify("a".repeat(43));

  assert.equal(requested.status, "sent");
  assert.match(state.sent[0].verificationUrl, /token=a{43}$/);
  assert.deepEqual(firstResult, {
    status: "updated",
    requestId: "request-1",
    personId: "7",
    matchedBy: "email",
    origin: "https://church.example",
  });
  assert.deepEqual(state.updates, [{ personId: "7", preference: "subscribe" }]);
  assert.deepEqual(replayResult, { status: "invalid" });
});

test("routes an unresolved shared email to encrypted staff review", async () => {
  const state = createDependencies([
    { id: "7", first_name: "One", last_name: "Person" },
    { id: "8", first_name: "Another", last_name: "Person" },
  ]);
  const service = createNewsletterPreferenceService({
    env: baseEnv,
    dependencies: state.dependencies,
    idFactory: () => "request-2",
    tokenFactory: () => "b".repeat(43),
  });

  await service.requestVerification({
    submission,
    clientIp: "192.0.2.2",
    origin: "https://church.example",
  });
  const result = await service.verify("b".repeat(43));

  assert.deepEqual(result, {
    status: "review",
    requestId: "request-2",
    reason: "shared-or-ambiguous-email",
    origin: "https://church.example",
  });
  assert.equal(state.sent.at(-1).type, "review");
  const storedReview = state.values.get("newsletter:review:request-2");
  assert.ok(storedReview);
  assert.doesNotMatch(storedReview, /ada@example\.com/);
});

test("creates a missing verified subscriber only when explicitly enabled", async () => {
  const state = createDependencies([]);
  const service = createNewsletterPreferenceService({
    env: { ...baseEnv, BREEZE_CREATE_MISSING_SUBSCRIBERS: "true" },
    dependencies: state.dependencies,
    idFactory: () => "request-3",
    tokenFactory: () => "c".repeat(43),
  });

  await service.requestVerification({
    submission,
    clientIp: "192.0.2.3",
    origin: "https://church.example",
  });
  const result = await service.verify("c".repeat(43));

  assert.equal(result.status, "created");
  assert.equal(state.created.length, 1);
  assert.equal(state.created[0].email, "ada@example.com");
});

test("returns a neutral rate-limited result without sending email", async () => {
  const state = createDependencies([]);
  state.dependencies.redis.incrementWithExpiry = async () => 100;
  const service = createNewsletterPreferenceService({
    env: baseEnv,
    dependencies: state.dependencies,
  });

  assert.deepEqual(
    await service.requestVerification({
      submission,
      clientIp: "192.0.2.4",
      origin: "https://church.example",
    }),
    { status: "rate-limited" },
  );
  assert.equal(state.sent.length, 0);
});

test("routes verified overflow to review before exceeding the Breeze account limit", async () => {
  const state = createDependencies([
    { id: "7", first_name: "Ada", last_name: "Lovelace" },
  ]);
  const counts = [1, 1, 9];
  state.dependencies.redis.incrementWithExpiry = async () => counts.shift();
  const service = createNewsletterPreferenceService({
    env: baseEnv,
    dependencies: state.dependencies,
    idFactory: () => "request-4",
    tokenFactory: () => "d".repeat(43),
  });

  await service.requestVerification({
    submission,
    clientIp: "192.0.2.5",
    origin: "https://church.example",
  });
  const result = await service.verify("d".repeat(43));

  assert.equal(result.status, "review");
  assert.equal(result.reason, "breeze-rate-limit");
  assert.equal(state.updates.length, 0);
});
