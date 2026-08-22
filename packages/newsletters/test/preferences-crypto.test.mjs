import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptPreferencePayload,
  encryptPreferencePayload,
  hashOpaqueValue,
} from "../src/preferences-server.mjs";

const secret = "a-development-secret-that-is-longer-than-32-characters";

test("encrypts verification state and rejects tampering", () => {
  const payload = { email: "person@example.com", preference: "subscribe" };
  const encrypted = encryptPreferencePayload(payload, secret);

  assert.doesNotMatch(encrypted, /person@example\.com/);
  assert.deepEqual(decryptPreferencePayload(encrypted, secret), payload);

  const parts = encrypted.split(".");
  parts[2] = `${parts[2][0] === "a" ? "b" : "a"}${parts[2].slice(1)}`;
  const tampered = parts.join(".");
  assert.throws(() => decryptPreferencePayload(tampered, secret));
});

test("creates purpose-separated opaque hashes", () => {
  assert.notEqual(
    hashOpaqueValue("value", secret, "email"),
    hashOpaqueValue("value", secret, "token"),
  );
});
