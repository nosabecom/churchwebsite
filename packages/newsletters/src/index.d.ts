export function getSafeNewsletterHref(href: unknown): string | undefined;
export function isExternalNewsletterHref(href: string): boolean;

interface NewsletterSourceOptions<T> {
  enabled: boolean;
  configured: boolean;
  loadSanity: () => Promise<T>;
  loadMarkdown: () => Promise<T>;
  missingConfigurationMessage: string;
  fetchFailureMessage: string;
}

export function loadNewsletterSource<T>(
  options: NewsletterSourceOptions<T>,
): Promise<T>;
export function memoizePromise<T>(loader: () => Promise<T>): () => Promise<T>;
export function enforceSanityProductionConfig(options: {
  enabled: boolean;
  deployment?: string;
  projectId?: string;
  dataset?: string;
  token?: string;
  label: string;
}): boolean;

interface SanityListenSubscription {
  unsubscribe(): void;
}

interface SanityListenClient {
  listen(
    query: string,
    params: Record<string, unknown>,
    options: Record<string, unknown>,
  ): {
    subscribe(observer: {
      next(): void;
      error(error: unknown): void;
    }): SanityListenSubscription;
  };
}

interface SanityDevReloadPluginOptions {
  enabled: boolean;
  client?: SanityListenClient;
  query: string;
  params?: Record<string, unknown>;
  label: string;
  debounceMs?: number;
}

export function createSanityDevReloadPlugin(
  options: SanityDevReloadPluginOptions,
): {
  name: string;
  apply: "serve";
  configureServer(server: {
    config: {
      logger: {
        info(message: string): void;
        error(message: string): void;
      };
    };
    environments?: {
      ssr?: {
        hot: { send(event: string, payload?: Record<string, unknown>): void };
      };
      client?: {
        hot: {
          send(payload: { type: "full-reload"; path: string }): void;
        };
      };
    };
    ws: { send(payload: { type: "full-reload"; path: string }): void };
    httpServer?: { once(event: "close", callback: () => void): void } | null;
  }): void;
};
