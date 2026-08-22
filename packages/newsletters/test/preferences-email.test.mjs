import assert from "node:assert/strict";
import test from "node:test";

import { createResendMailer } from "../src/preferences-server.mjs";

test("sends verification email with authentication, idempotency, and escaped HTML", async () => {
  let request;
  const mailer = createResendMailer({
    apiKey: "resend-key",
    from: "Church <news@example.com>",
    reviewEmail: "review@example.com",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return Response.json({ id: "email-1" });
    },
  });

  await mailer.sendVerification({
    requestId: "request-1",
    email: "person@example.com",
    firstName: "<Ada>",
    verificationUrl: "https://church.example/verify?token=a&next=<bad>",
    expiresMinutes: 15,
  });

  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.Authorization, "Bearer resend-key");
  assert.equal(
    request.options.headers["Idempotency-Key"],
    "newsletter-verification-request-1",
  );
  assert.deepEqual(body.to, ["person@example.com"]);
  assert.match(body.html, /&lt;Ada&gt;/);
  assert.doesNotMatch(body.html, /<bad>/);
});
