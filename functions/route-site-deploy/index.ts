import { createClient, type SanityClient } from "@sanity/client";
import { documentEventHandler, type FunctionContext } from "@sanity/functions";

import { getDeploymentRoute, type DeployableDocument } from "./routing.js";

const API_VERSION = "2026-08-14";
const DEPLOYMENT_DEBOUNCE_MS = 5_000;
const DEPLOYMENT_ATTEMPTS = 3;
const DEPLOY_HOOK_TIMEOUT_MS = 6_000;
const STALE_TRIGGER_MS = 25_000;

interface DeploymentState {
  _id: string;
  _rev: string;
  lastEventKey?: string;
  lastTriggeredAt?: string;
  pendingToken?: string;
  status?: string;
}

interface HandleDeploymentOptions {
  createClient?: (
    options: FunctionContext["clientOptions"] & {
      apiVersion: string;
      useCdn: false;
    },
  ) => SanityClient;
  fetch?: typeof globalThis.fetch;
  hookTimeoutMs?: number;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  env?: NodeJS.ProcessEnv;
}

function deploymentStateId(site: string) {
  return `deploy.state-${site}`;
}

async function acquireDeploymentLease(
  client: SanityClient,
  site: string,
  document: DeployableDocument,
  now: Date,
  sleep: (milliseconds: number) => Promise<void>,
) {
  const stateId = deploymentStateId(site);
  const eventKey = `${document.operation}:${document._id}:${document._rev ?? "unknown-revision"}`;
  await client.createIfNotExists({
    _id: stateId,
    _type: "deploymentState",
    site,
  });
  const initialState = await client.fetch<DeploymentState>(
    "*[_id == $stateId][0]{_id, _rev, lastEventKey, lastTriggeredAt, status}",
    { stateId },
  );
  if (!initialState)
    throw new Error(`Deployment state ${stateId} could not be loaded.`);
  const triggerAge = initialState.lastTriggeredAt
    ? now.getTime() - Date.parse(initialState.lastTriggeredAt)
    : 0;
  const staleTrigger =
    initialState.status === "triggering" &&
    Number.isFinite(triggerAge) &&
    triggerAge >= STALE_TRIGGER_MS;
  if (
    initialState.lastEventKey === eventKey &&
    initialState.status !== "failed" &&
    !staleTrigger
  )
    return null;

  await client
    .patch(stateId)
    .set({
      pendingAt: now.toISOString(),
      pendingDocumentId: document._id,
      pendingDocumentType: document._type,
      pendingToken: eventKey,
    })
    .commit({ returnDocuments: false });

  await sleep(DEPLOYMENT_DEBOUNCE_MS);

  const state = await client.fetch<DeploymentState>(
    "*[_id == $stateId][0]{_id, _rev, pendingToken}",
    { stateId },
  );

  if (!state)
    throw new Error(`Deployment state ${stateId} could not be loaded.`);
  if (state.pendingToken !== eventKey) return null;

  try {
    return await client
      .patch(stateId)
      .ifRevisionId(state._rev)
      .set({
        lastTriggeredAt: now.toISOString(),
        lastDocumentId: document._id,
        lastDocumentRevision: document._rev ?? "deleted",
        lastDocumentType: document._type,
        lastEventKey: eventKey,
        lastOperation: document.operation,
        status: "triggering",
      })
      .unset([
        "failedAt",
        "lastError",
        "pendingAt",
        "pendingDocumentId",
        "pendingDocumentType",
        "pendingToken",
      ])
      .commit<DeploymentState>({ returnDocuments: true });
  } catch (error) {
    const currentState = await client.fetch<DeploymentState>(
      "*[_id == $stateId][0]{pendingToken}",
      { stateId },
    );
    if (currentState?.pendingToken !== eventKey) return null;
    throw error;
  }
}

async function triggerDeployHook(
  hookUrl: string,
  payload: Record<string, string>,
  fetchImplementation: typeof globalThis.fetch,
  sleep: (milliseconds: number) => Promise<void>,
  timeoutMs: number,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DEPLOYMENT_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImplementation(hookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok)
        throw new Error(`Deploy hook returned HTTP ${response.status}.`);
      return response.status;
    } catch (error) {
      lastError = error;
      if (attempt < DEPLOYMENT_ATTEMPTS) await sleep(250 * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

async function updateDeploymentStateIfCurrent(
  client: SanityClient,
  stateId: string,
  eventKey: string,
  update: (
    patch: ReturnType<SanityClient["patch"]>,
  ) => ReturnType<SanityClient["patch"]>,
) {
  const state = await client.fetch<DeploymentState>(
    "*[_id == $stateId][0]{_id, _rev, lastEventKey}",
    { stateId },
  );
  if (!state || state.lastEventKey !== eventKey) return false;

  try {
    await update(client.patch(stateId).ifRevisionId(state._rev)).commit({
      returnDocuments: false,
    });
    return true;
  } catch (error) {
    const currentState = await client.fetch<DeploymentState>(
      "*[_id == $stateId][0]{lastEventKey}",
      { stateId },
    );
    if (currentState?.lastEventKey !== eventKey) return false;
    throw error;
  }
}

export async function handleDeploymentEvent(
  {
    context,
    event,
  }: { context: FunctionContext; event: { data: DeployableDocument } },
  options: HandleDeploymentOptions = {},
) {
  const route = getDeploymentRoute(event.data);
  if (!route) return { status: "ignored" as const };

  const environment = options.env ?? process.env;
  const hookUrl = environment[route.hookEnvironmentVariable];
  if (!hookUrl) {
    throw new Error(
      `${route.hookEnvironmentVariable} is required to deploy ${route.label}.`,
    );
  }

  const clientFactory = options.createClient ?? createClient;
  const client = clientFactory({
    ...context.clientOptions,
    apiVersion: API_VERSION,
    useCdn: false,
  });
  const now = (options.now ?? (() => new Date()))();
  const sleep =
    options.sleep ??
    ((milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const lease = await acquireDeploymentLease(
    client,
    route.site,
    event.data,
    now,
    sleep,
  );
  if (!lease) return { status: "deduplicated" as const, site: route.site };
  const eventKey = `${event.data.operation}:${event.data._id}:${event.data._rev ?? "unknown-revision"}`;

  try {
    const responseStatus = await triggerDeployHook(
      hookUrl,
      {
        documentId: event.data._id,
        documentType: event.data._type,
        operation: event.data.operation,
        site: route.site,
      },
      options.fetch ?? globalThis.fetch,
      sleep,
      options.hookTimeoutMs ?? DEPLOY_HOOK_TIMEOUT_MS,
    );
    await updateDeploymentStateIfCurrent(client, lease._id, eventKey, (patch) =>
      patch.set({
        lastSucceededAt: now.toISOString(),
        responseStatus,
        status: "succeeded",
      }),
    );
    return { status: "triggered" as const, site: route.site, responseStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureIsCurrent = await updateDeploymentStateIfCurrent(
      client,
      lease._id,
      eventKey,
      (patch) =>
        patch
          .set({
            failedAt: now.toISOString(),
            lastError: message,
            status: "failed",
          })
          .unset(["lastTriggeredAt"]),
    );
    if (!failureIsCurrent) {
      console.warn(
        `${route.label} deploy hook failed for a superseded event: ${message}`,
      );
      return { status: "superseded" as const, site: route.site };
    }
    throw new Error(
      `${route.label} deploy hook failed after ${DEPLOYMENT_ATTEMPTS} attempts: ${message}`,
      {
        cause: error,
      },
    );
  }
}

export const handler = documentEventHandler<DeployableDocument>(
  async (envelope) => {
    await handleDeploymentEvent(envelope);
  },
);
