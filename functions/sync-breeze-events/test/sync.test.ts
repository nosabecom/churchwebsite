import assert from "node:assert/strict";
import test from "node:test";

import {
  breezeWallClockToIso,
  buildSyncPlan,
  normalizeBreezeEvents,
  selectCalendar,
  slugForEvent,
  type ExistingEvent,
} from "../sync.js";

test("interprets Breeze timestamps in the account timezone", () => {
  assert.equal(
    breezeWallClockToIso("2026-08-22 09:30:00", "America/Regina"),
    "2026-08-22T15:30:00.000Z",
  );
  assert.equal(breezeWallClockToIso("0000-00-00 00:00:00", "America/Regina"), undefined);
});

test("requires the configured calendar when more than one exists", () => {
  assert.equal(selectCalendar([{id: "7", name: "Only"}]).id, "7");
  assert.throws(() => selectCalendar([{id: "7"}, {id: "8"}]), /exactly one/);
  assert.equal(selectCalendar([{id: "7"}, {id: "8"}], "8").id, "8");
});

test("normalizes only the selected calendar without carrying Breeze HTML", () => {
  const [event] = normalizeBreezeEvents({
    calendar: {id: "7", name: "Church Calendar"},
    locations: [{id: "2", name: "Main Auditorium"}],
    timeZone: "America/Regina",
    events: [
      {
        id: "101",
        event_id: "55",
        category_id: "7",
        name: "Sunday Service",
        description: '<p>Worship &amp; prayer. <a href="https://example.com/register">Register</a></p>',
        start_datetime: "2026-08-23 09:00:00",
        end_datetime: "2026-08-23 12:00:00",
        location_id: "2",
      },
      {id: "102", category_id: "8", name: "Private", start_datetime: "2026-08-23 10:00:00"},
    ],
  });
  assert.equal(event.title, "Sunday Service");
  assert.equal(event.description, "Worship & prayer. Register");
  assert.equal(event.sourceUrl, "https://example.com/register");
  assert.equal(event.operationalLocation, "Main Auditorium");
  assert.equal(event.source.seriesId, "55");
  assert.match(slugForEvent(event), /^sunday-service-2026-08-23-101$/);
});

test("reconciliation is idempotent and quarantines before archiving", () => {
  const [source] = normalizeBreezeEvents({
    calendar: {id: "7", name: "Calendar"},
    locations: [],
    timeZone: "America/Regina",
    events: [{id: "101", category_id: "7", name: "Service", start_datetime: "2026-08-23 09:00:00"}],
  });
  const existing = {_id: "generated", _rev: "r1", ...source} as ExistingEvent;
  const unchanged = buildSyncPlan([source], [existing], new Date("2026-08-22T12:00:00Z"));
  assert.deepEqual([unchanged.creates.length, unchanged.updates.length], [0, 0]);

  const suspectPlan = buildSyncPlan([], [existing], new Date("2026-08-22T12:00:00Z"));
  assert.equal(suspectPlan.suspects[0]._id, "generated");
  const suspect = {...existing, source: {...existing.source, status: "suspect" as const, missingSince: "2026-08-22T12:00:00Z"}};
  assert.equal(buildSyncPlan([], [suspect], new Date("2026-08-22T12:30:00Z")).archives[0]._id, "generated");
});
