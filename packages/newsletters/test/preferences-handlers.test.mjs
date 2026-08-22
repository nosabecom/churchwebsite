import assert from "node:assert/strict";
import test from "node:test";

import { createNewsletterPreferenceHandlers } from "../src/preferences-server.mjs";

function service(overrides = {}) {
  return {
    config: { allowedOrigins: new Set(["https://church.example"]) },
    async requestVerification() {
      return { status: "sent", requestId: "request-1" };
    },
    async verify() {
      return { status: "updated", requestId: "request-1" };
    },
    ...overrides,
  };
}

function validRequest(body = {}) {
  return new Request("https://church.example/api/newsletter-preferences/request", {
    method: "POST",
    headers: {
      Origin: "https://church.example",
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.1",
    },
    body: JSON.stringify({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      preference: "subscribe",
      consent: "yes",
      ...body,
    }),
  });
}

test("accepts a valid request with a neutral response", async () => {
  const handlers = createNewsletterPreferenceHandlers({ service: service() });
  const response = await handlers.request(validRequest());

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    ok: true,
    message: "If this request can be processed, a verification email will arrive shortly.",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects unapproved origins and returns safe field validation", async () => {
  const handlers = createNewsletterPreferenceHandlers({ service: service() });
  const disallowed = validRequest();
  disallowed.headers.set("Origin", "https://attacker.example");
  assert.equal((await handlers.request(disallowed)).status, 403);

  const invalid = await handlers.request(validRequest({ email: "bad" }));
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    error: "Check the highlighted fields.",
    fields: { email: "Enter a valid email address." },
  });
});

test("requires an explicit confirmation before applying a verification token", async () => {
  let verificationCalls = 0;
  const handlers = createNewsletterPreferenceHandlers({
    service: service({
      async verify() {
        verificationCalls += 1;
        return { status: "updated", requestId: "request-1" };
      },
    }),
  });
  const confirmation = await handlers.verify(
    new Request(
      `https://church.example/api/newsletter-preferences/verify?token=${"a".repeat(43)}`,
    ),
  );

  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Confirm my preference/);
  assert.equal(confirmation.headers.get("referrer-policy"), "no-referrer");
  assert.equal(verificationCalls, 0);

  const response = await handlers.verify(
    new Request("https://church.example/api/newsletter-preferences/verify", {
      method: "POST",
      headers: {
        Origin: "https://church.example",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: "a".repeat(43) }),
    }),
  );

  assert.equal(response.status, 303);
  assert.equal(verificationCalls, 1);
  assert.equal(
    response.headers.get("location"),
    "https://church.example/newsletters/?newsletter-preference=verified#newsletter-preferences",
  );
});

test("rejects cross-origin verification posts without consuming the token", async () => {
  let verificationCalls = 0;
  const handlers = createNewsletterPreferenceHandlers({
    service: service({
      async verify() {
        verificationCalls += 1;
        return { status: "updated" };
      },
    }),
  });
  const response = await handlers.verify(
    new Request("https://church.example/api/newsletter-preferences/verify", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: "a".repeat(43) }),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(verificationCalls, 0);
});
