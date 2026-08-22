# Breeze event mirror

RCC-59 implements a one-way, server-side mirror from the single Breeze calendar into Sanity's `development` dataset. Staff schedule the year in Breeze; the website reads only the Sanity mirror and never calls Breeze from a visitor request.

## Ownership

Breeze owns the title, description, start/end time, all-day state, recurrence instances, calendar, operational location, event link, occurrence modifications, and removal. Sanity generates a stable slug and offers optional website-only summary, image, featured, registration-link, and SEO overrides for exceptional presentation needs. A normal event needs no Sanity editing.

The sync stores Breeze occurrence and series IDs in `source.instanceId` and `source.seriesId`. Sanity generates ordinary event document `_id` values; sync identity never depends on a deterministic Sanity ID.

## Schedule and limits

The `sync-breeze-events` Sanity Function runs every 30 minutes and fetches the previous 30 days through the next 335 days. That inclusive 366-day range fits the read-only client's bounded one-year window. Requests are serialized at a minimum one-second cadence and capped at 18 per rolling minute and per run, below Breeze's published 20-request limit.

If `BREEZE_CALENDAR_ID` is unset, the run requires Breeze to return exactly one calendar. It stops without changing Sanity if a second calendar appears. If the ID is set, only matching events are mirrored.

## Reconciliation safety

- Upserts look up occurrences by `source.instanceId` and stop on duplicate Breeze or Sanity identities.
- A revision-checked singleton lease prevents overlapping runs from creating duplicate documents.
- An unchanged source event creates no Sanity mutation and therefore no website deployment.
- A missing event becomes `suspect` on one successful full-window run. It remains visible on the website.
- If it remains missing on the next successful run, it becomes `archived` and disappears from the website.
- Events are never automatically deleted. Sanity document history remains available for rollback.
- A reappearing suspect or archived event is restored to `active`.
- The singleton `eventSyncState-churchMain` records the last successful summary or failure. An optional HTTPS alert webhook receives a credential-free failure payload.

Event mutations route through the existing debounced Church Main deployment Function, so the static Astro site rebuilds only when the mirror changes.

## Function environment

Install these only on the hosted `sync-breeze-events` Function. Never prefix them with `PUBLIC_` or commit their values.

| Key | Required | Purpose |
| --- | --- | --- |
| `BREEZE_ACCOUNT_SUBDOMAIN` | Yes | Breeze account subdomain only |
| `BREEZE_API_KEY` | Yes | Read-only Breeze API key |
| `BREEZE_CALENDAR_ID` | No | Explicit calendar allowlist; omit only while the account has exactly one calendar |
| `BREEZE_ACCOUNT_TIME_ZONE` | No | Fallback if account summary omits its timezone; `America/Regina` in development |
| `BREEZE_SYNC_DRY_RUN` | No | Set `true` to calculate and log a plan without mutations |
| `BREEZE_SYNC_ALLOW_PRODUCTION` | No | Must be exactly `true` before any non-development cutover |
| `BREEZE_SYNC_ALERT_WEBHOOK_URL` | No | HTTPS failure-alert endpoint |

The function also needs a Sanity write token. Hosted context credentials are preferred; local execution can use `SANITY_PROJECT_ID`, `SANITY_DATASET`, and `SANITY_API_WRITE_TOKEN`.

After the Blueprint stack is deployed, install a secret with the Sanity CLI without writing it to disk:

```sh
npx sanity functions env add sync-breeze-events BREEZE_API_KEY "$BREEZE_API_KEY" --stack <stack-id>
```

Repeat for the other configured keys. Start with `BREEZE_SYNC_DRY_RUN=true`, inspect Function logs and `eventSyncState-churchMain`, then remove or set that key to `false` for the development cutover.

## Verification and rollback

Run the normalization/reconciliation suite and all builds:

```sh
pnpm --filter @churchwebsite/sync-breeze-events test
pnpm build
pnpm verify:routes
```

To stop the integration, remove or disable the scheduled Function and redeploy the previous Blueprint. Existing mirror documents remain recoverable. Restore an accidentally changed event from Sanity document history; archived documents can also be returned to `active` after correcting Breeze and running the sync again.
