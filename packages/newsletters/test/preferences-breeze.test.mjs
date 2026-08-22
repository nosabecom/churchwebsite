import assert from "node:assert/strict";
import test from "node:test";

import { createBreezeClient } from "../src/preferences-server.mjs";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("queries Breeze by email field and updates the configured preference field", async () => {
  const requests = [];
  const client = createBreezeClient({
    subdomain: "cornerstone",
    apiKey: "secret-api-key",
    emailFieldId: "101",
    preferenceFieldId: "202",
    subscribeOptionId: "303",
    unsubscribeOptionId: "304",
    fetchImpl: async (url, options) => {
      requests.push({ url: new URL(url), options });
      return requests.length === 1
        ? response([{ id: "7", first_name: "Ada", last_name: "Lovelace" }])
        : response([{ id: "7" }]);
    },
  });

  const lookup = await client.lookupPeopleByEmail("ada@example.com");
  await client.updatePreference("7", "subscribe");

  assert.equal(lookup.people.length, 1);
  assert.equal(lookup.truncated, false);
  assert.equal(requests[0].options.headers["Api-Key"], "secret-api-key");
  assert.equal(requests[0].url.pathname, "/api/people");
  assert.deepEqual(JSON.parse(requests[0].url.searchParams.get("filter_json")), {
    101: "ada@example.com",
  });
  assert.equal(requests[1].url.pathname, "/api/people/update");
  assert.deepEqual(JSON.parse(requests[1].url.searchParams.get("fields_json")), [
    { field_id: "202", field_type: "radio", response: "303" },
  ]);
});

test("creates a verified missing subscriber with email and preference fields", async () => {
  let requestUrl;
  const client = createBreezeClient({
    subdomain: "cornerstone",
    apiKey: "secret-api-key",
    emailFieldId: "101",
    preferenceFieldId: "202",
    subscribeOptionId: "303",
    unsubscribeOptionId: "304",
    fetchImpl: async (url) => {
      requestUrl = new URL(url);
      return response([{ id: "8" }]);
    },
  });

  await client.addSubscriber({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    preference: "subscribe",
  });

  assert.equal(requestUrl.pathname, "/api/people/add");
  assert.equal(requestUrl.searchParams.get("first"), "Ada");
  assert.deepEqual(JSON.parse(requestUrl.searchParams.get("fields_json")), [
    {
      field_id: "101",
      field_type: "email",
      response: true,
      details: { address: "ada@example.com" },
    },
    { field_id: "202", field_type: "radio", response: "303" },
  ]);
});

test("discovers unique profile fields and options when IDs are not configured", async () => {
  const client = createBreezeClient({
    subdomain: "cornerstone",
    apiKey: "secret-api-key",
    fetchImpl: async () =>
      response([
        {
          fields: [
            { field_id: "101", field_type: "email", name: "Email", options: [] },
            {
              field_id: "202",
              field_type: "multiple_choice",
              name: "Newsletter communication preference",
              options: [
                { option_id: "303", name: "Subscribe me to church newsletters" },
                { option_id: "304", name: "Do not send me church newsletters" },
              ],
            },
          ],
        },
      ]),
  });

  assert.deepEqual(await client.resolveFields(), {
    emailFieldId: "101",
    preferenceFieldId: "202",
    subscribeOptionId: "303",
    unsubscribeOptionId: "304",
  });
});
