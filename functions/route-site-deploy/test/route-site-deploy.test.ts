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

function createClientStub() {
  const patches: Array<{
    id: string;
    revision?: string;
    set?: Record<string, unknown>;
    unset?: string[];
  }> = [];
  const state: Record<string, unknown> = {
    _id: "deploy.state-churchMain",
    _rev: "state-revision",
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

  return { client: client as unknown as SanityClient, patches };
}

test("routes newsletter changes to the owning site", () => {
  assert.equal(
    getDeploymentRoute({
      _id: "breeze-event",
      _type: "event",
      operation: "update",
      site: "churchMain",
    })?.hookEnvironmentVariable,
    "CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL",
  );
  assert.equal(
    getDeploymentRoute({
      _id: "church-issue",
      _type: "newsletterIssue",
      operation: "update",
      site: "churchMain",
    })?.hookEnvironmentVariable,
    "CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL",
  );
  assert.equal(
    getDeploymentRoute({
      _id: "woman-issue",
      _type: "newsletterIssue",
      operation: "update",
      site: "womanExcel",
    })?.hookEnvironmentVariable,
    "WOMAN_EXCEL_VERCEL_DEPLOY_HOOK_URL",
  );
  assert.equal(
    getDeploymentRoute({
      _id: "asset",
      _type: "sanity.imageAsset",
      operation: "update",
    }),
    null,
  );
});

test("triggers only the selected Vercel hook", async () => {
  const { client, patches } = createClientStub();
  const requests: string[] = [];
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
      fetch: async (input) => {
        requests.push(String(input));
        return new Response(null, { status: 201 });
      },
      now: () => new Date("2026-08-14T12:00:00.000Z"),
      sleep: async () => {},
    },
  );

  assert.equal(result.status, "triggered");
  assert.deepEqual(requests, ["https://api.vercel.test/church"]);
  assert.equal(patches.at(-1)?.set?.status, "succeeded");
});

test("retries a failed deploy hook and records the failure", async () => {
  const { client, patches } = createClientStub();
  let requests = 0;

  await assert.rejects(
    handleDeploymentEvent(
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
          return new Response(null, { status: 503 });
        },
        now: () => new Date("2026-08-14T12:00:00.000Z"),
        sleep: async () => {},
      },
    ),
    /failed after 3 attempts/,
  );

  assert.equal(requests, 3);
  assert.equal(patches.at(-1)?.set?.status, "failed");
});
