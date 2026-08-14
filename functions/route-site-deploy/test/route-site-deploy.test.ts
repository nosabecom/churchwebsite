import assert from "node:assert/strict";
import test from "node:test";

import type { SanityClient } from "@sanity/client";
import type { FunctionContext } from "@sanity/functions";

import { handleDeploymentEvent } from "../index.js";
import { getDeploymentRoute } from "../routing.js";

const context = {
  clientOptions: {
    dataset: "development",
    projectId: "project",
    token: "robot-token",
  },
} as FunctionContext;

function createClientStub(initialState: Record<string, unknown> = {}) {
  const patches: Array<{
    id: string;
    revision?: string;
    set?: Record<string, unknown>;
    unset?: string[];
  }> = [];
  const state: Record<string, unknown> = {
    _id: "deploy.state-churchMain",
    _rev: "state-revision",
    ...initialState,
  };

  const client = {
    async createIfNotExists() {},
    async fetch() {
      return { ...state };
    },
    patch(id: string) {
      const operation = { id } as (typeof patches)[number];
      patches.push(operation);
      const builder = {
        ifRevisionId(revision: string) {
          operation.revision = revision;
          return builder;
        },
        set(value: Record<string, unknown>) {
          operation.set = value;
          return builder;
        },
        unset(value: string[]) {
          operation.unset = value;
          return builder;
        },
        async commit() {
          Object.assign(state, operation.set);
          for (const field of operation.unset ?? []) delete state[field];
          state._rev = `revision-${patches.length}`;
          return { ...state };
        },
      };
      return builder;
    },
  };

  return { client: client as unknown as SanityClient, patches, state };
}

test("routes each supported document only to its owning site", () => {
  assert.deepEqual(
    getDeploymentRoute({
      _id: "church-issue",
      _type: "newsletterIssue",
      operation: "update",
      site: "churchMain",
    }),
    {
      site: "churchMain",
      label: "Church Main",
      hookEnvironmentVariable: "CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL",
    },
  );
  assert.deepEqual(
    getDeploymentRoute({
      _id: "woman-issue",
      _type: "newsletterIssue",
      operation: "update",
      site: "womanExcel",
    }),
    {
      site: "womanExcel",
      label: "Woman Excel",
      hookEnvironmentVariable: "WOMAN_EXCEL_VERCEL_DEPLOY_HOOK_URL",
    },
  );
  assert.equal(
    getDeploymentRoute({
      _id: "asset",
      _type: "sanity.imageAsset",
      operation: "update",
    }),
    null,
  );
  assert.throws(
    () =>
      getDeploymentRoute({
        _id: "ownerless",
        _type: "newsletterIssue",
        operation: "update",
      }),
    /owning site is missing or invalid/,
  );
});

test("triggers only the selected Vercel hook and records success", async () => {
  const { client, patches } = createClientStub();
  const requests: Array<{ url: string; body: unknown }> = [];
  const result = await handleDeploymentEvent(
    {
      context,
      event: {
        data: {
          _id: "issue-1",
          _rev: "issue-revision-1",
          _type: "newsletterIssue",
          operation: "update",
          site: "churchMain",
        },
      },
    },
    {
      createClient: () => client,
      env: {
        CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/church",
        WOMAN_EXCEL_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/woman",
      },
      fetch: async (input, init) => {
        assert.ok(init?.signal instanceof AbortSignal);
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
        });
        return new Response(null, { status: 201 });
      },
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      sleep: async () => {},
    },
  );

  assert.deepEqual(result, {
    status: "triggered",
    site: "churchMain",
    responseStatus: 201,
  });
  assert.deepEqual(requests, [
    {
      url: "https://api.vercel.test/church",
      body: {
        documentId: "issue-1",
        documentType: "newsletterIssue",
        operation: "update",
        site: "churchMain",
      },
    },
  ]);
  assert.equal(patches.length, 3);
  assert.equal(patches[0].set?.pendingToken, "update:issue-1:issue-revision-1");
  assert.equal(patches[1].revision, "revision-1");
  assert.equal(patches[2].revision, "revision-2");
  assert.equal(patches[2].set?.status, "succeeded");
});

test("a delete event deploys after the same published revision", async () => {
  const { client, state } = createClientStub();
  const operations: string[] = [];
  const options = {
    createClient: () => client,
    env: {
      CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/church",
    },
    fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { operation: string };
      operations.push(body.operation);
      return new Response(null, { status: 201 });
    },
    now: () => new Date("2026-08-14T12:00:00.000Z"),
    sleep: async () => {},
  };

  for (const operation of ["update", "delete"] as const) {
    await handleDeploymentEvent(
      {
        context,
        event: {
          data: {
            _id: "issue-unpublish",
            _rev: "same-revision",
            _type: "newsletterIssue",
            operation,
            site: "churchMain",
          },
        },
      },
      options,
    );
  }

  assert.deepEqual(operations, ["update", "delete"]);
  assert.equal(state.lastEventKey, "delete:issue-unpublish:same-revision");
});

test("an older success cannot overwrite a newer event state", async () => {
  const { client, patches, state } = createClientStub();
  const result = await handleDeploymentEvent(
    {
      context,
      event: {
        data: {
          _id: "older-issue",
          _rev: "older-revision",
          _type: "newsletterIssue",
          operation: "update",
          site: "churchMain",
        },
      },
    },
    {
      createClient: () => client,
      env: {
        CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/church",
      },
      fetch: async () => {
        state.lastEventKey = "update:newer-issue:newer-revision";
        state.status = "failed";
        state._rev = "newer-event-revision";
        return new Response(null, { status: 201 });
      },
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      sleep: async () => {},
    },
  );

  assert.deepEqual(result, {
    status: "triggered",
    site: "churchMain",
    responseStatus: 201,
  });
  assert.equal(state.lastEventKey, "update:newer-issue:newer-revision");
  assert.equal(state.status, "failed");
  assert.equal(patches.length, 2);
});

test("deduplicates rapid events for one site without calling a deploy hook", async () => {
  const { client, patches, state } = createClientStub();
  let requests = 0;
  const result = await handleDeploymentEvent(
    {
      context,
      event: {
        data: {
          _id: "issue-2",
          _rev: "issue-revision-2",
          _type: "newsletterIssue",
          operation: "update",
          site: "churchMain",
        },
      },
    },
    {
      createClient: () => client,
      env: {
        CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/church",
      },
      fetch: async () => {
        requests += 1;
        return new Response(null, { status: 201 });
      },
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      sleep: async () => {
        state.pendingToken = "newer-event-token";
        state._rev = "newer-event-revision";
      },
    },
  );

  assert.deepEqual(result, { status: "deduplicated", site: "churchMain" });
  assert.equal(requests, 0);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].set?.pendingToken, "update:issue-2:issue-revision-2");
});

test("deduplicates a retried event after its deployment succeeded", async () => {
  const { client, patches } = createClientStub({
    lastEventKey: "update:issue-2:issue-revision-2",
    status: "succeeded",
  });
  let requests = 0;
  const result = await handleDeploymentEvent(
    {
      context,
      event: {
        data: {
          _id: "issue-2",
          _rev: "issue-revision-2",
          _type: "newsletterIssue",
          operation: "update",
          site: "churchMain",
        },
      },
    },
    {
      createClient: () => client,
      env: {
        CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/church",
      },
      fetch: async () => {
        requests += 1;
        return new Response(null, { status: 201 });
      },
      sleep: async () => {},
    },
  );

  assert.deepEqual(result, { status: "deduplicated", site: "churchMain" });
  assert.equal(requests, 0);
  assert.equal(patches.length, 0);
});

test("retries a stale triggering lease left by a timed-out invocation", async () => {
  const { client, patches } = createClientStub({
    lastEventKey: "update:issue-stale:issue-revision-stale",
    lastTriggeredAt: "2026-08-14T11:59:30.000Z",
    status: "triggering",
  });
  let requests = 0;
  const result = await handleDeploymentEvent(
    {
      context,
      event: {
        data: {
          _id: "issue-stale",
          _rev: "issue-revision-stale",
          _type: "newsletterIssue",
          operation: "update",
          site: "churchMain",
        },
      },
    },
    {
      createClient: () => client,
      env: {
        CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/church",
      },
      fetch: async () => {
        requests += 1;
        return new Response(null, { status: 201 });
      },
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      sleep: async () => {},
    },
  );

  assert.equal(result.status, "triggered");
  assert.equal(requests, 1);
  assert.equal(patches.length, 3);
});

test("retries failed hooks and releases the lease after the final failure", async () => {
  const { client, patches } = createClientStub();
  let requests = 0;
  await assert.rejects(
    handleDeploymentEvent(
      {
        context,
        event: {
          data: {
            _id: "issue-3",
            _rev: "issue-revision-3",
            _type: "newsletterIssue",
            operation: "update",
            site: "churchMain",
          },
        },
      },
      {
        createClient: () => client,
        env: {
          CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.test/church",
        },
        fetch: async () => {
          requests += 1;
          return new Response(null, { status: 503 });
        },
        sleep: async () => {},
        now: () => new Date("2026-08-14T12:00:00.000Z"),
      },
    ),
    /failed after 3 attempts/,
  );

  assert.equal(requests, 3);
  assert.deepEqual(patches[2].unset, ["lastTriggeredAt"]);
  assert.equal(patches[2].set?.status, "failed");
});

test("fails before mutation when the selected site hook secret is missing", async () => {
  const { client, patches } = createClientStub();
  await assert.rejects(
    handleDeploymentEvent(
      {
        context,
        event: {
          data: {
            _id: "issue-4",
            _type: "newsletterIssue",
            operation: "update",
            site: "womanExcel",
          },
        },
      },
      { createClient: () => client, env: {} },
    ),
    /WOMAN_EXCEL_VERCEL_DEPLOY_HOOK_URL is required/,
  );
  assert.equal(patches.length, 0);
});
