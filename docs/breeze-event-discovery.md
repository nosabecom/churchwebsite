# Breeze event API discovery

RCC-56 is the read-only discovery foundation for the Breeze-to-Sanity event synchronization in RCC-59. The discovery command does not change the Church Main calendar, write to Breeze, or write to Sanity.

## Current status

The safe discovery client, redacted report generator, and development-only mirror implementation are ready. An account-specific report has not been committed because this worktree does not contain Breeze credentials, and no production approval is recorded on RCC-56.

Production synchronization remains blocked until an account owner or ministry lead reviews a locally generated report, approves the calendar IDs, and records that approval in Linear. The sole-calendar invariant allows development testing to stop safely if another calendar is added.

## Official API constraints

The implementation is based on Breeze's official documentation:

- [Breeze API reference](https://app.breezechms.com/api) documents the account summary, event, calendar, location, single-event/schedule, and account-log endpoints.
- [Breeze API advanced custom development](https://support.breezechms.com/hc/en-us/articles/360001324153-API-Advanced-Custom-Development) specifies a 20-request-per-minute limit, recommends roughly 3.5 seconds between calls, and notes synchronization delays.
- [Breeze log of changes](https://support.breezechms.com/hc/en-us/articles/360001192054-Log-of-Changes-Audit-Trail) confirms that log timestamps are UTC and distinguishes series, instance, and future-instance deletion actions.

The event endpoints may be cached for up to 15 minutes. A missing event in one list response is therefore not sufficient evidence for deletion.

## Safety boundary

`BreezeReadOnlyClient` exposes six named read operations. Callers cannot provide an arbitrary URL, path, HTTP method, or query parameter.

| Operation | Breeze path | Purpose |
| --- | --- | --- |
| Account summary | `/api/account/summary` | Confirm subdomain and account timezone |
| Calendars | `/api/events/calendars/list` | Discover internal calendar IDs and external-feed edge cases |
| Locations | `/api/events/locations` | Discover operational location IDs |
| Events | `/api/events` | Fetch a required, bounded date range with details and eligible/tag metadata |
| Event | `/api/events/list_event` | Sample instance details and recurrence schedules |
| Account log | `/api/account/list_log` | Sample event create/update/delete and calendar create/update/delete actions |

Every request:

- is HTTPS GET to exactly `<configured-subdomain>.breezechms.com`;
- carries the API key only in the `Api-key` request header;
- rejects redirects instead of forwarding credentials;
- waits at least one second after the previous request and serializes concurrent callers;
- starts at most 18 requests in any rolling 60-second window, leaving headroom below Breeze's 20-request limit despite using a shorter cadence than its 3.5-second recommendation;
- respects an 18-request run ceiling, a 30-second timeout, and a 10 MiB response ceiling;
- uses a maximum 366-day range, 1,000 event rows, and 50 rows per log action;
- keeps People, attendance, family, contribution, form-entry, and subscriber endpoints unreachable.

The command processes responses in memory and writes only aggregate, value-redacted `report.json` and `report.md` files. It retains numeric calendar, location, and relevant eligibility-tag IDs so a reviewer can approve exact source records, but redacts names, feed URLs, descriptions, and all other scalar source values. It never saves raw responses.

## Run the discovery

1. Copy `.env.example` to the ignored `.env.development` file.
2. Set `BREEZE_ACCOUNT_SUBDOMAIN` to the subdomain only, not a URL.
3. Set the server-only `BREEZE_API_KEY`. Never add a public prefix.
4. Choose a range that includes representative past changes and upcoming recurring events.
5. Run:

   ```sh
   pnpm breeze:discover -- --start 2026-01-01 --end 2026-12-31
   ```

Reports default to `tmp/breeze-discovery/<timestamp>/`, which Git ignores. A custom directory inside this repository is rejected unless it is below `tmp/`; an absolute directory outside the repository is allowed.

The command first compares the account summary with the configured subdomain. It stops before reading events if they do not match.

The rolling guard is process-local. Do not run another client with the same Breeze API key during discovery; the command cannot count requests made by a separate integration.

## What the report establishes

The generated report records counts and field presence/types without retaining source values. It evaluates these identity candidates:

| Meaning | Breeze field | Use in RCC-59 |
| --- | --- | --- |
| Occurrence identity | `id` | `source.instanceId`; expected to be unique per event instance |
| Series identity | `event_id` | `source.seriesId`; shared by recurring instances |
| Calendar identity | `category_id` | `source.calendarId`; must be checked against an explicit approved-calendar allowlist |
| Occurrence override | `is_modified` | Preserve as source metadata and sync that occurrence independently |

Sanity should generate normal document `_id` values. RCC-59 should look up and upsert documents through explicit source metadata rather than copying Breeze IDs into `_id`.

The implemented authority split follows RCC-59 and the one-entry workflow decision:

- Breeze owns title, description, start/end, all-day state, calendar, operational location, event link, recurrence instances, and source status.
- Sanity generates a stable slug and owns optional website-only summary, image, featured state, registration-link override, directions/presentation, and SEO.
- A Breeze update must not overwrite those optional Sanity presentation overrides.

## Edge-case decisions

- Parse event timestamps as wall-clock values in the account timezone returned by `/api/account/summary`; do not append `Z` directly.
- Treat account-log timestamps as UTC.
- Convert `0000-00-00 00:00:00` end values to an absent end. Quarantine a zero or missing start.
- Preserve an explicit `all_day` signal. Do not infer all-day only from midnight or a zero end.
- Treat `is_modified=1` as an occurrence override signal.
- Treat external calendar feeds returned by the calendar list as unsupported until RCC-59 deliberately adds iCalendar ingestion.
- Treat the optional eligibility/tag structure as discovery metadata only. Never fetch people who belong to those tags.
- If an event result contains exactly 1,000 rows, split the range and rerun before approval.

## Polling and reconciliation recommendation

1. Every 30 minutes, poll each event log action with a 24-hour overlap. Deduplicate log rows by their log `id`, and advance the durable cursor only after the whole batch succeeds.
2. Fetch only approved internal calendars for the website window. Use smaller date slices if any response reaches 1,000 events.
3. Upsert each occurrence by `source.instanceId`, retain `source.seriesId`, and preserve Sanity-owned fields.
4. Once daily, run a complete approved-window reconciliation.
5. If an occurrence disappears, mark it suspect. Archive it only after two complete successful reconciliations at least 30 minutes apart or a matching deletion log. Never hard-delete it automatically.
6. On timeout, HTTP failure, invalid JSON, a truncated result, or an incomplete log batch, retain the previous cursor and skip absence reconciliation.

This overlap and confirmation window accommodates the documented 15-minute event cache lag and makes deletion handling reversible.

## Approval record

- [ ] Account-specific report generated and stored outside Git.
- [ ] Account subdomain and timezone confirmed.
- [ ] Internal calendar IDs and locations reviewed.
- [ ] Representative recurring, modified, deleted, all-day, and zero-date behavior reviewed. When a case is not naturally present, its fixture coverage is acknowledged and a deliberate test event is approved before production.
- [ ] Relevant tags reviewed without retrieving People records.
- [ ] Polling and reconciliation strategy approved.
- [ ] Approver name, approval date, and Linear comment/link recorded.

Until every item is complete, the mirror may run only against the guarded development dataset and must not run a production synchronization. See [`breeze-event-sync.md`](breeze-event-sync.md) for the implemented schedule, reconciliation, configuration, and rollback path.
