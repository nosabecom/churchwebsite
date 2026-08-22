import { createClient } from "@sanity/client";

import { enforceSanityProductionConfig } from "@churchwebsite/newsletters";

export const CHURCH_MAIN_SITE = "churchMain" as const;
export const SANITY_API_VERSION = "2026-08-13";

interface SanityEnv {
  readonly PUBLIC_SANITY_PROJECT_ID?: string;
  readonly PUBLIC_SANITY_DATASET?: string;
  readonly SANITY_API_READ_TOKEN?: string;
}

export function getChurchMainSanityClient(
  env: SanityEnv = import.meta.env,
) {
  const projectId = env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_READ_TOKEN;

  enforceSanityProductionConfig({
    deployment: import.meta.env.VERCEL_ENV,
    projectId,
    dataset,
    token,
    label: "Church Main",
  });

  if (!projectId || !dataset) {
    throw new Error(
      "Church Main requires PUBLIC_SANITY_PROJECT_ID and PUBLIC_SANITY_DATASET.",
    );
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: SANITY_API_VERSION,
    useCdn: false,
    perspective: "published",
    token,
  });
}
