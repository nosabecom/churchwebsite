import {BreezeReadOnlyClient} from "@churchwebsite/breeze-discovery";
import {createClient, type SanityClient} from "@sanity/client";
import {scheduledEventHandler, type ScheduledFunctionContext} from "@sanity/functions";

import {
  buildSyncPlan,
  normalizeBreezeEvents,
  recordsFrom,
  selectCalendar,
  slugForEvent,
  type ExistingEvent,
  type MirroredEvent,
} from "./sync.js";

const API_VERSION = "2026-08-22";
const SITE = "churchMain";
const STATE_ID = "eventSyncState-churchMain";
const LEASE_MS = 3 * 60_000;

interface SyncState {
  _rev: string;
  status?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function getClient(context: ScheduledFunctionContext, env: NodeJS.ProcessEnv) {
  const projectId = context.clientOptions?.projectId ?? env.SANITY_PROJECT_ID;
  const dataset = context.clientOptions?.dataset ?? env.SANITY_DATASET;
  const token = context.clientOptions?.token ?? env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !dataset || !token) {
    throw new Error("The sync requires Sanity project, dataset, and write-token credentials.");
  }
  if (dataset !== "development" && env.BREEZE_SYNC_ALLOW_PRODUCTION !== "true") {
    throw new Error(`Refusing to sync Breeze into dataset ${dataset}; development is the safe default.`);
  }
  return {
    client: createClient({projectId, dataset, token, apiVersion: API_VERSION, useCdn: false}),
    dataset,
  };
}

async function retry<T>(operation: () => Promise<T>) {
  let failure: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      failure = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  throw failure;
}

async function sendFailureAlert(env: NodeJS.ProcessEnv, payload: Record<string, string>) {
  if (!env.BREEZE_SYNC_ALERT_WEBHOOK_URL) return false;
  const url = new URL(env.BREEZE_SYNC_ALERT_WEBHOOK_URL);
  if (url.protocol !== "https:") throw new Error("BREEZE_SYNC_ALERT_WEBHOOK_URL must use HTTPS.");
  const response = await fetch(url, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) throw new Error(`Breeze sync alert returned HTTP ${response.status}.`);
  return true;
}

async function acquireSyncLease(client: SanityClient, runId: string, now: Date) {
  await client.createIfNotExists({_id: STATE_ID, _type: "eventSyncState", site: SITE});
  const state = await client.fetch<SyncState>(
    `*[_id == $stateId][0]{_rev, status, leaseToken, leaseExpiresAt}`,
    {stateId: STATE_ID},
  );
  if (!state) throw new Error("The Breeze event sync state could not be loaded.");
  if (
    state.status === "syncing" &&
    state.leaseExpiresAt &&
    Date.parse(state.leaseExpiresAt) > now.getTime()
  ) {
    throw new Error("Another Breeze event sync still holds the development lease.");
  }
  await client
    .patch(STATE_ID)
    .ifRevisionId(state._rev)
    .set({
      status: "syncing",
      leaseToken: runId,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS).toISOString(),
      startedAt: now.toISOString(),
    })
    .commit({returnDocuments: false});
}

async function patchStateIfLeaseIsCurrent(
  client: SanityClient,
  runId: string,
  set: Record<string, unknown>,
  unset: string[],
) {
  const state = await client.fetch<SyncState>(
    `*[_id == $stateId][0]{_rev, leaseToken}`,
    {stateId: STATE_ID},
  );
  if (!state || state.leaseToken !== runId) return false;
  await client.patch(STATE_ID).ifRevisionId(state._rev).set(set).unset(unset).commit({returnDocuments: false});
  return true;
}

function mirrorFields(event: MirroredEvent, runId: string, changedAt: string) {
  return {
    site: SITE,
    title: event.title,
    ...(event.description ? {description: event.description} : {}),
    startsAt: event.startsAt,
    ...(event.endsAt ? {endsAt: event.endsAt} : {}),
    allDay: event.allDay,
    ...(event.operationalLocation ? {operationalLocation: event.operationalLocation} : {}),
    ...(event.sourceUrl ? {sourceUrl: event.sourceUrl} : {}),
    calendarName: event.calendarName,
    source: {...event.source, lastChangedAt: changedAt, lastSyncRunId: runId},
  };
}

async function applyPlan(
  client: SanityClient,
  plan: ReturnType<typeof buildSyncPlan>,
  runId: string,
) {
  let transaction = client.transaction();
  for (const event of plan.creates) {
    transaction = transaction.create({
      _type: "event",
      ...mirrorFields(event, runId, plan.generatedAt),
      slug: {current: slugForEvent(event)},
    });
  }
  for (const {existing, event} of plan.updates) {
    let patch = client
      .patch(existing._id)
      .ifRevisionId(existing._rev)
      .set(mirrorFields(event, runId, plan.generatedAt));
    const removedFields = [
      !event.description ? "description" : undefined,
      !event.endsAt ? "endsAt" : undefined,
      !event.operationalLocation ? "operationalLocation" : undefined,
      !event.sourceUrl ? "sourceUrl" : undefined,
    ].filter((field): field is string => Boolean(field));
    if (removedFields.length > 0) patch = patch.unset(removedFields);
    transaction = transaction.patch(
      patch,
    );
  }
  for (const existing of plan.suspects) {
    transaction = transaction.patch(
      client.patch(existing._id).ifRevisionId(existing._rev).set({
        "source.status": "suspect",
        "source.missingSince": plan.generatedAt,
        "source.lastSyncRunId": runId,
      }),
    );
  }
  for (const existing of plan.archives) {
    transaction = transaction.patch(
      client.patch(existing._id).ifRevisionId(existing._rev).set({
        "source.status": "archived",
        "source.archivedAt": plan.generatedAt,
        "source.lastSyncRunId": runId,
      }),
    );
  }
  const mutationCount = plan.creates.length + plan.updates.length + plan.suspects.length + plan.archives.length;
  if (mutationCount > 0) await transaction.commit({returnDocuments: false});
  return mutationCount;
}

export async function syncBreezeEvents(options: {
  context: ScheduledFunctionContext;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}) {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const dryRun = options.context.local === true || env.BREEZE_SYNC_DRY_RUN === "true";
  const {client, dataset} = getClient(options.context, env);
  const subdomain = env.BREEZE_ACCOUNT_SUBDOMAIN;
  const apiKey = env.BREEZE_API_KEY;
  if (!subdomain || !apiKey) throw new Error("BREEZE_ACCOUNT_SUBDOMAIN and BREEZE_API_KEY are required.");
  const runId = `breeze-${now.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  const breeze = new BreezeReadOnlyClient({
    subdomain,
    apiKey,
    minimumIntervalMs: 1_000,
    maximumRequests: 18,
    maximumRequestsPerMinute: 18,
  });
  const start = dateKey(addDays(now, -30));
  const end = dateKey(addDays(now, 335));

  try {
    if (!dryRun) await acquireSyncLease(client, runId, now);
    const [accountResponse, calendarResponse, locationResponse, eventResponse] = await Promise.all([
      retry(() => breeze.accountSummary()),
      retry(() => breeze.calendars()),
      retry(() => breeze.locations()),
      retry(() => breeze.events({start, end, limit: 1_000})),
    ]);
    const account = recordsFrom(accountResponse, ["account", "data"])[0];
    const timeZone =
      (account?.details && typeof account.details === "object" && !Array.isArray(account.details)
        ? String((account.details as Record<string, unknown>).timezone ?? "")
        : "") || env.BREEZE_ACCOUNT_TIME_ZONE;
    if (!timeZone) throw new Error("Breeze did not return an account timezone.");
    new Intl.DateTimeFormat("en", {timeZone}).format(now);
    const calendar = selectCalendar(
      recordsFrom(calendarResponse, ["calendars", "data"]),
      env.BREEZE_CALENDAR_ID,
    );
    const sourceEvents = normalizeBreezeEvents({
      events: recordsFrom(eventResponse, ["events", "data"]),
      calendar,
      locations: recordsFrom(locationResponse, ["locations", "data"]),
      timeZone,
    });
    const existingEvents = await client.fetch<ExistingEvent[]>(
      `*[_type == "event" && site == $site && source.system == "breeze" && startsAt >= $start && startsAt <= $end]{...}`,
      {site: SITE, start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z`},
    );
    const plan = buildSyncPlan(sourceEvents, existingEvents, now);
    const summary = {
      runId,
      dataset,
      dryRun,
      sourceEvents: sourceEvents.length,
      creates: plan.creates.length,
      updates: plan.updates.length,
      suspects: plan.suspects.length,
      archives: plan.archives.length,
      breezeRequests: breeze.requestCount,
    };
    if (!dryRun) {
      await applyPlan(client, plan, runId);
      await patchStateIfLeaseIsCurrent(
        client,
        runId,
        {status: "succeeded", lastRunAt: now.toISOString(), lastRunId: runId, lastSummary: summary},
        ["failedAt", "lastError", "leaseToken", "leaseExpiresAt", "startedAt"],
      );
    }
    console.info(JSON.stringify({message: "Breeze event sync completed.", ...summary}));
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!dryRun) {
      try {
        await patchStateIfLeaseIsCurrent(
          client,
          runId,
          {status: "failed", failedAt: new Date().toISOString(), lastError: message},
          ["leaseToken", "leaseExpiresAt", "startedAt"],
        );
      } catch (stateError) {
        console.error(JSON.stringify({message: "Could not record Breeze sync failure state.", error: stateError instanceof Error ? stateError.message : String(stateError)}));
      }
      try {
        await sendFailureAlert(env, {service: "breeze-event-sync", runId, dataset, status: "failed", error: message});
      } catch (alertError) {
        console.error(JSON.stringify({message: "Could not send Breeze sync failure alert.", error: alertError instanceof Error ? alertError.message : String(alertError)}));
      }
    }
    console.error(JSON.stringify({message: "Breeze event sync failed.", runId, dataset, error: message}));
    throw error;
  }
}

export default scheduledEventHandler(async ({context}) => {
  await syncBreezeEvents({context});
});
