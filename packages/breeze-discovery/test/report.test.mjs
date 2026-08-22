import assert from "node:assert/strict";
import test from "node:test";
import { buildDiscoveryReport, renderDiscoveryMarkdown } from "../src/index.mjs";

const input = {
  configuredSubdomain: "cornerstone",
  start: "2026-08-01",
  end: "2026-08-31",
  generatedAt: "2026-08-21T12:00:00.000Z",
  requestCount: 12,
  account: {
    id: "account-secret",
    name: "Private Church Name",
    subdomain: "cornerstone",
    details: { timezone: "America/Regina", country: { name: "Canada" } },
  },
  calendars: [
    { id: "0", name: "Main Calendar", address: "https://secret-feed.example" },
    { id: "5", name: "Sensitive Ministry" },
  ],
  locations: [{ id: "7", name: "Private Room" }],
  events: [
    {
      id: "100",
      event_id: "10",
      category_id: "0",
      name: "Member Name at private@example.com",
      start_datetime: "2026-08-02 00:00:00",
      end_datetime: "0000-00-00 00:00:00",
      all_day: "1",
      is_modified: "0",
      nested: { tag_id: "33", tag_name: "Private Tag" },
    },
    {
      id: "101",
      event_id: "10",
      category_id: "0",
      name: "Modified occurrence",
      start_datetime: "2026-08-09 09:00:00",
      end_datetime: "2026-08-09 11:00:00",
      is_modified: "1",
    },
    {
      id: "102",
      event_id: "20",
      category_id: "999",
      name: "",
      start_datetime: "0000-00-00 00:00:00",
      end_datetime: "2026-08-10 12:00:00",
      is_modified: "0",
    },
  ],
  eventDetails: [{ id: "100", all_day: "1", description: "Call 306-555-0100" }],
  schedules: [
    {
      instanceId: "100",
      direction: "after",
      response: [{ id: "101", start_datetime: "2026-08-09 09:00:00" }],
    },
  ],
  logs: {
    event_created: [],
    event_updated: [{ id: "501", object_json: '"101"' }],
    event_deleted: [{ id: "502", object_json: '"10"' }],
    event_instance_deleted: [{ id: "503", object_json: '"102"' }],
    event_future_deleted: [{ id: "504", object_json: "not-json" }],
  },
};

test("reports recurrence, modifications, deletions, all-day, and zero-date cases", () => {
  const report = buildDiscoveryReport(input);

  assert.equal(report.account.configuredSubdomainMatchesSummary, true);
  assert.equal(report.account.timezone, "America/Regina");
  assert.equal(report.identifiers.eventInstance.unique, 3);
  assert.equal(report.identifiers.eventInstance.duplicates, 0);
  assert.equal(report.recurrence.recurringSeries, 1);
  assert.equal(report.recurrence.largestObservedSeries, 2);
  assert.equal(report.modifications.modifiedOccurrences, 1);
  assert.equal(report.dateQuality.explicitAllDayOccurrences, 1);
  assert.equal(report.dateQuality.zeroStartDatetimes, 1);
  assert.equal(report.dateQuality.zeroEndDatetimes, 1);
  assert.deepEqual(report.inventory.calendars, [
    { id: "0", kind: "external" },
    { id: "5", kind: "unknown" },
  ]);
  assert.deepEqual(report.inventory.locationIds, ["7"]);
  assert.deepEqual(report.inventory.relevantTagIds, ["33"]);
  assert.equal(
    Object.values(report.sourceShape.events).every((field) => field.missing >= 0),
    true,
  );
  assert.equal(report.deletions.rowsByAction.event_deleted, 1);
  assert.equal(report.deletions.rowsByAction.event_instance_deleted, 1);
  assert.deepEqual(report.deletions.objectJsonShapes, ["invalid-json", "string"]);
  assert.equal(
    report.dataQuality.find((issue) => issue.code === "unknown-calendar").count,
    1,
  );
});

test("redacts all scalar source values from JSON and Markdown reports", () => {
  const report = buildDiscoveryReport(input);
  const json = JSON.stringify(report);
  const markdown = renderDiscoveryMarkdown(report);
  const output = `${json}\n${markdown}`;

  for (const secret of [
    "Private Church Name",
    "Main Calendar",
    "Sensitive Ministry",
    "Private Room",
    "private@example.com",
    "Private Tag",
    "306-555-0100",
    "secret-feed.example",
    "account-secret",
  ]) {
    assert.equal(output.includes(secret), false, `report leaked: ${secret}`);
  }
  assert.match(markdown, /Human approval: pending/);
  assert.match(markdown, /Calendar ID/);
  assert.match(markdown, /Relevant eligibility tag IDs: 33/);
  assert.match(markdown, /Source shape \(values redacted\)/);
  assert.match(markdown, /Proposed Breeze-to-Sanity mapping/);
});
