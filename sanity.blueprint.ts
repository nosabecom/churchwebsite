import {
  defineBlueprint,
  defineDocumentFunction,
  defineScheduledFunction,
} from "@sanity/blueprints";

import {
  SITE_DEPLOY_ROUTES,
  SITE_OWNED_DOCUMENT_TYPES,
} from "./functions/route-site-deploy/routing.js";

const projectId = process.env.SANITY_PROJECT_ID ?? "";
const dataset = process.env.SANITY_DATASET ?? "";
if (!projectId || !dataset) {
  throw new Error(
    "SANITY_PROJECT_ID and SANITY_DATASET are required to evaluate the Blueprint.",
  );
}
const quotedTypes = SITE_OWNED_DOCUMENT_TYPES.map((type) =>
  JSON.stringify(type),
).join(", ");
const quotedSites = Object.keys(SITE_DEPLOY_ROUTES)
  .map((site) => JSON.stringify(site))
  .join(", ");

export default defineBlueprint({
  values: {
    datasetResource: projectId && dataset ? `${projectId}.${dataset}` : "",
  },
  resources: [
    defineScheduledFunction({
      name: "sync-breeze-events",
      displayName: "Sync Breeze events to Sanity",
      src: "functions/sync-breeze-events",
      runtime: "nodejs24.x",
      timeout: 120,
      event: { expression: "*/30 * * * *" },
    }),
    defineDocumentFunction({
      name: "route-site-deploy",
      displayName: "Route site content deployments",
      src: "functions/route-site-deploy",
      runtime: "nodejs24.x",
      timeout: 30,
      event: {
        on: ["create", "update", "delete"],
        filter: `sanity::dataset() == ${JSON.stringify(dataset)} && _type in [${quotedTypes}] && site in [${quotedSites}]`,
        projection: '{_id, _rev, _type, site, "operation": delta::operation()}',
        includeDrafts: false,
        resource: { type: "dataset", id: "$.values.datasetResource" },
      },
    }),
  ],
});
