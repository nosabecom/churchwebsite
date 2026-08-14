const allowedHref = /^(?:\/(?!\/)|https?:\/\/|mailto:)/i;

export function getSafeNewsletterHref(href) {
  return typeof href === "string" && allowedHref.test(href) ? href : undefined;
}

export function isExternalNewsletterHref(href) {
  return /^https?:\/\//i.test(href);
}

export async function loadNewsletterSource({
  enabled,
  configured,
  loadSanity,
  loadMarkdown,
  missingConfigurationMessage,
  fetchFailureMessage,
}) {
  if (!enabled) return loadMarkdown();

  if (!configured) {
    throw new Error(missingConfigurationMessage);
  }

  try {
    return await loadSanity();
  } catch (error) {
    throw new Error(fetchFailureMessage, { cause: error });
  }
}

export function memoizePromise(loader) {
  let promise;
  return () => {
    promise ??= loader();
    return promise;
  };
}

export function enforceSanityProductionConfig({
  enabled,
  deployment,
  projectId,
  dataset,
  token,
  label,
}) {
  if (!enabled) return false;

  const production = deployment === "production" || dataset === "production";
  if (!production) return false;

  if (!projectId) {
    throw new Error(
      `PUBLIC_SANITY_PROJECT_ID is required to build ${label} for production.`,
    );
  }
  if (!dataset) {
    throw new Error(
      `PUBLIC_SANITY_DATASET is required to build ${label} for production.`,
    );
  }
  if (deployment === "production" && dataset !== "production") {
    throw new Error(
      `PUBLIC_SANITY_DATASET must be production when deploying ${label} to Vercel production.`,
    );
  }
  if (!token) {
    throw new Error(
      `SANITY_API_READ_TOKEN is required to build ${label} from the private production dataset.`,
    );
  }

  return true;
}

export function createSanityDevReloadPlugin({
  enabled,
  client,
  query,
  params = {},
  label,
  debounceMs = 100,
}) {
  return {
    name: "sanity-newsletter-dev-reload",
    apply: "serve",
    configureServer(server) {
      if (!enabled || !client) return;

      let reloadTimer;
      const subscription = client
        .listen(query, params, {
          events: ["mutation"],
          includeResult: false,
          includeMutations: false,
          visibility: "query",
          tag: "newsletter.dev-reload",
        })
        .subscribe({
          next() {
            clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => {
              server.config.logger.info(
                `[sanity] ${label} newsletter changed; reloading the browser.`,
              );
              server.environments?.ssr?.hot.send("astro:content-changed", {});
              const fullReload = { type: "full-reload", path: "*" };
              const clientHot = server.environments?.client?.hot;
              if (clientHot) clientHot.send(fullReload);
              else server.ws.send(fullReload);
            }, debounceMs);
          },
          error(error) {
            server.config.logger.error(
              `[sanity] ${label} development reload listener failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          },
        });

      server.config.logger.info(
        `[sanity] Watching ${label} newsletters in the development dataset.`,
      );

      server.httpServer?.once("close", () => {
        clearTimeout(reloadTimer);
        subscription.unsubscribe();
      });
    },
  };
}
