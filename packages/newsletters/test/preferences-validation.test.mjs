import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseBreezeMatch,
  validatePreferenceSubmission,
} from "../src/preferences-server.mjs";

test("normalizes and validates an explicit preference request", () => {
  const result = validatePreferenceSubmission({
    firstName: "  Ada  ",
    lastName: "  Lovelace ",
    email: " ADA@Example.COM ",
    preference: "subscribe",
    consent: "yes",
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    preference: "subscribe",
  });
});

test("reports field-specific validation errors", () => {
  const result = validatePreferenceSubmission({
    firstName: "",
    lastName: "",
    email: "not-an-email",
    preference: "anything",
  });

  assert.equal(result.success, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    "consent",
    "email",
    "firstName",
    "lastName",
    "preference",
  ]);
});

test("matches one email result directly and never guesses between shared addresses", () => {
  const ada = { id: "1", first_name: "Ada", last_name: "Lovelace" };
  const grace = { id: "2", first_name: "Grace", last_name: "Hopper" };

  assert.deepEqual(chooseBreezeMatch([ada], "Wrong", "Name"), {
    kind: "match",
    person: ada,
    matchedBy: "email",
  });
  assert.deepEqual(chooseBreezeMatch([ada, grace], "Grace", "Hopper"), {
    kind: "ambiguous",
    count: 2,
  });
  assert.deepEqual(chooseBreezeMatch([], "Nobody", "Here"), { kind: "none" });
});
