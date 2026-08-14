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
  warn = console.warn,
  missingConfigurationMessage,
  fetchFailureMessage,
}) {
  if (!enabled) return loadMarkdown();

  if (!configured) {
    warn(missingConfigurationMessage);
    return loadMarkdown();
  }

  try {
    return await loadSanity();
  } catch (error) {
    warn(fetchFailureMessage, error);
    return loadMarkdown();
  }
}

export function memoizePromise(loader) {
  let promise;
  return () => {
    promise ??= loader();
    return promise;
  };
}
