export const SITE_DEPLOY_ROUTES = {
  churchMain: {
    label: "Church Main",
    hookEnvironmentVariable: "CHURCH_MAIN_VERCEL_DEPLOY_HOOK_URL",
  },
  womanExcel: {
    label: "Woman Excel",
    hookEnvironmentVariable: "WOMAN_EXCEL_VERCEL_DEPLOY_HOOK_URL",
  },
} as const;

export const SITE_OWNED_DOCUMENT_TYPES = ["newsletterIssue", "event"] as const;

export type SiteId = keyof typeof SITE_DEPLOY_ROUTES;

export interface DeployableDocument {
  _id: string;
  _rev?: string;
  _type: string;
  operation: "create" | "update" | "delete";
  site?: string;
}

export function getDeploymentRoute(document: DeployableDocument) {
  if (
    !(SITE_OWNED_DOCUMENT_TYPES as readonly string[]).includes(document._type)
  )
    return null;
  if (!document.site || !(document.site in SITE_DEPLOY_ROUTES)) {
    throw new Error(
      `Cannot route ${document._type} ${document._id}: owning site is missing or invalid.`,
    );
  }

  const site = document.site as SiteId;
  return { site, ...SITE_DEPLOY_ROUTES[site] };
}
