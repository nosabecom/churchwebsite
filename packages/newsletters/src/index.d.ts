export function getSafeNewsletterHref(href: unknown): string | undefined;
export function isExternalNewsletterHref(href: string): boolean;

interface NewsletterSourceOptions<T> {
  enabled: boolean;
  configured: boolean;
  loadSanity: () => Promise<T>;
  loadMarkdown: () => Promise<T>;
  warn?: (message: string | undefined, error?: unknown) => void;
  missingConfigurationMessage?: string;
  fetchFailureMessage?: string;
}

export function loadNewsletterSource<T>(
  options: NewsletterSourceOptions<T>,
): Promise<T>;
export function memoizePromise<T>(loader: () => Promise<T>): () => Promise<T>;
