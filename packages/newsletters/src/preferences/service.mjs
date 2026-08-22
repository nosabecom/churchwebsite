import { randomUUID } from "node:crypto";

import { createBreezeClient } from "./breeze.mjs";
import { loadNewsletterPreferencesConfig } from "./config.mjs";
import {
  createVerificationToken,
  decryptPreferencePayload,
  encryptPreferencePayload,
  hashOpaqueValue,
} from "./crypto.mjs";
import { createResendMailer } from "./email.mjs";
import { createRedisStore } from "./redis.mjs";

function verificationKey(token, secret) {
  return `newsletter:verification:${hashOpaqueValue(token, secret, "verification-token")}`;
}

function rateLimitKey(value, secret, type) {
  return `newsletter:rate:${type}:${hashOpaqueValue(value, secret, `rate-${type}`)}`;
}

export function createNewsletterPreferenceService({
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
  idFactory = randomUUID,
  tokenFactory = createVerificationToken,
  dependencies,
} = {}) {
  const config = loadNewsletterPreferencesConfig(env);
  const redis =
    dependencies?.redis ?? createRedisStore({ ...config.redis, fetchImpl });
  const mailer =
    dependencies?.mailer ?? createResendMailer({ ...config.resend, fetchImpl });
  const breeze =
    dependencies?.breeze ?? createBreezeClient({ ...config.breeze, fetchImpl });

  async function withinRateLimit(type, value, limit, windowSeconds) {
    const count = await redis.incrementWithExpiry(
      rateLimitKey(value, config.verificationSecret, type),
      windowSeconds,
    );
    return count <= limit;
  }

  async function requestVerification({ submission, clientIp, origin }) {
    const ipAllowed = await withinRateLimit(
      "ip",
      clientIp,
      config.ipRateLimit,
      config.ipRateWindowSeconds,
    );
    const emailAllowed = await withinRateLimit(
      "email",
      submission.email,
      config.emailRateLimit,
      config.emailRateWindowSeconds,
    );
    if (!ipAllowed || !emailAllowed) return { status: "rate-limited" };

    const requestId = idFactory();
    const token = tokenFactory();
    const createdAt = now();
    const payload = {
      requestId,
      ...submission,
      createdAt,
      expiresAt: createdAt + config.verificationTtlSeconds * 1_000,
      origin,
    };
    const stored = await redis.setOnce(
      verificationKey(token, config.verificationSecret),
      encryptPreferencePayload(payload, config.verificationSecret),
      config.verificationTtlSeconds,
    );
    if (!stored) throw new Error("Unable to reserve a verification token.");

    const verificationUrl = new URL("/api/newsletter-preferences/verify", origin);
    verificationUrl.searchParams.set("token", token);
    await mailer.sendVerification({
      requestId,
      email: submission.email,
      firstName: submission.firstName,
      verificationUrl: verificationUrl.toString(),
      expiresMinutes: config.verificationExpiresMinutes,
    });
    return { status: "sent", requestId };
  }

  async function queueReview(payload, reason) {
    const reviewKey = `newsletter:review:${payload.requestId}`;
    await redis.set(
      reviewKey,
      encryptPreferencePayload(
        { ...payload, reviewReason: reason, reviewed: false },
        config.verificationSecret,
      ),
      config.reviewTtlSeconds,
    );
    try {
      await mailer.sendReviewNotice({ ...payload, reason });
    } catch (error) {
      console.error("Newsletter review notification failed.", {
        requestId: payload.requestId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return { status: "review", requestId: payload.requestId, reason };
  }

  async function applyVerifiedPreference(payload) {
    const lookup = await breeze.lookupPeopleByEmail(payload.email);
    const people = Array.isArray(lookup) ? lookup : lookup.people;
    const truncated = Array.isArray(lookup) ? false : lookup.truncated;
    const match = breeze.chooseMatch(
      people,
      payload.firstName,
      payload.lastName,
      truncated,
    );

    if (match.kind === "match") {
      await breeze.updatePreference(match.person.id, payload.preference);
      return {
        status: "updated",
        requestId: payload.requestId,
        personId: String(match.person.id),
        matchedBy: match.matchedBy,
      };
    }

    if (match.kind === "none") {
      if (
        payload.preference === "subscribe" &&
        config.createMissingSubscribers
      ) {
        const created = await breeze.addSubscriber(payload);
        const createdPerson = Array.isArray(created) ? created[0] : created;
        return {
          status: "created",
          requestId: payload.requestId,
          personId: createdPerson?.id ? String(createdPerson.id) : undefined,
        };
      }
      if (payload.preference === "unsubscribe") {
        return { status: "no-profile", requestId: payload.requestId };
      }
      return await queueReview(payload, "no-profile");
    }

    return await queueReview(payload, "shared-or-ambiguous-email");
  }

  async function verify(token) {
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
      return { status: "invalid" };
    }
    const encrypted = await redis.consume(
      verificationKey(token, config.verificationSecret),
    );
    if (!encrypted) return { status: "invalid" };

    let payload;
    try {
      payload = decryptPreferencePayload(encrypted, config.verificationSecret);
    } catch {
      return { status: "invalid" };
    }
    if (
      typeof payload?.expiresAt !== "number" ||
      payload.expiresAt < now() ||
      !config.allowedOrigins.has(payload.origin)
    ) {
      return { status: "invalid" };
    }
    const applyLockKey = `newsletter:apply:${hashOpaqueValue(
      payload.email,
      config.verificationSecret,
      "apply-email",
    )}`;
    const acquired = await redis.setOnce(applyLockKey, payload.requestId, 60);
    if (!acquired) {
      return {
        status: "processing",
        requestId: payload.requestId,
        origin: payload.origin,
      };
    }
    try {
      const breezeAllowed = await withinRateLimit(
        "breeze",
        "shared-breeze-account",
        config.breezeOperationRateLimit,
        60,
      );
      if (!breezeAllowed) {
        const result = await queueReview(payload, "breeze-rate-limit");
        return { ...result, origin: payload.origin };
      }
      const result = await applyVerifiedPreference(payload);
      return { ...result, origin: payload.origin };
    } finally {
      try {
        await redis.releaseLock(applyLockKey, payload.requestId);
      } catch (error) {
        console.error("Newsletter apply lock release failed.", {
          requestId: payload.requestId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return {
    config,
    requestVerification,
    verify,
    applyVerifiedPreference,
  };
}
