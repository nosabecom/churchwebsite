export interface BreezeClientOptions {
  subdomain: string;
  apiKey: string;
  fetchImplementation?: typeof fetch;
  minimumIntervalMs?: number;
  maximumRequests?: number;
  requestTimeoutMs?: number;
  maximumResponseBytes?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  onRequest?: (request: { number: number; endpoint: string }) => void;
}

export interface BreezeEventRange {
  start: string;
  end: string;
  limit?: number;
}

export interface BreezeLogRange extends BreezeEventRange {
  action: string;
}

export interface BreezeListEventOptions {
  instanceId: string;
  details?: boolean;
  eligible?: boolean;
  schedule?: boolean;
  scheduleDirection?: "before" | "after";
  scheduleLimit?: number;
}

export class BreezeReadOnlyClient {
  constructor(options: BreezeClientOptions);
  get requestCount(): number;
  accountSummary(): Promise<unknown>;
  calendars(): Promise<unknown>;
  locations(): Promise<unknown>;
  events(range: BreezeEventRange): Promise<unknown>;
  event(options: BreezeListEventOptions): Promise<unknown>;
  accountLog(range: BreezeLogRange): Promise<unknown>;
}

export interface DiscoveryInput {
  configuredSubdomain: string;
  start: string;
  end: string;
  account: unknown;
  calendars: unknown;
  locations: unknown;
  events: unknown;
  eventDetails?: unknown[];
  schedules?: Array<{
    instanceId: string;
    direction: "before" | "after";
    response: unknown;
  }>;
  logs?: Record<string, unknown>;
  generatedAt?: string;
  requestCount?: number;
}

export interface BreezeDiscoveryReport {
  metadata: Record<string, unknown>;
  account: Record<string, unknown>;
  counts: Record<string, unknown>;
  inventory: Record<string, unknown>;
  sourceShape: Record<string, unknown>;
  identifiers: Record<string, unknown>;
  recurrence: Record<string, unknown>;
  modifications: Record<string, unknown>;
  deletions: Record<string, unknown>;
  dateQuality: Record<string, unknown>;
  dataQuality: Array<Record<string, unknown>>;
  fieldMapping: Array<Record<string, unknown>>;
  pollingRecommendation: Record<string, unknown>;
  approval: Record<string, unknown>;
}

export function validateDiscoveryRange(start: string, end: string): {
  start: string;
  end: string;
  days: number;
};

export function buildDiscoveryReport(input: DiscoveryInput): BreezeDiscoveryReport;
export function renderDiscoveryMarkdown(report: BreezeDiscoveryReport): string;
