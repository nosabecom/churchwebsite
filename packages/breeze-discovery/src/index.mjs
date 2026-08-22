import { isIP } from "node:net";

const DEFAULT_MINIMUM_INTERVAL_MS = 3_500;
const DEFAULT_MAXIMUM_REQUESTS = 20;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAXIMUM_DISCOVERY_DAYS = 366;
const ZERO_DATE_PREFIX = "0000-00-00";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SUBDOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

const endpoints = Object.freeze({
  accountSummary: { path: "/api/account/summary", parameters: new Set() },
  calendars: { path: "/api/events/calendars/list", parameters: new Set() },
  locations: { path: "/api/events/locations", parameters: new Set() },
  events: {
    path: "/api/events",
    parameters: new Set(["start", "end", "details", "eligible", "limit"]),
  },
  event: {
    path: "/api/events/list_event",
    parameters: new Set([
      "instance_id",
      "details",
      "eligible",
      "schedule",
      "schedule_direction",
      "schedule_limit",
    ]),
  },
  accountLog: {
    path: "/api/account/list_log",
    parameters: new Set(["action", "start", "end", "details", "limit"]),
  },
});

const eventLogActions = new Set([
  "event_created",
  "event_updated",
  "event_deleted",
  "event_instance_deleted",
  "event_future_deleted",
  "events_calendar_created",
  "events_calendar_updated",
  "events_calendar_deleted",
]);
const trueValues = new Set(["1", "true"]);

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const asRecords = (value) =>
  Array.isArray(value) ? value.filter(isRecord) : isRecord(value) ? [value] : [];

const scalarKey = (value) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

const isPresent = (value) => scalarKey(value).trim() !== "";

const isTrueLike = (value) =>
  value === true || trueValues.has(scalarKey(value).toLowerCase());

const parseDate = (value, label) => {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`${label} must use the YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a valid calendar date.`);
  }
  return date;
};

export function validateDiscoveryRange(start, end) {
  const startDate = parseDate(start, "start");
  const endDate = parseDate(end, "end");
  const days = Math.floor((endDate.valueOf() - startDate.valueOf()) / 86_400_000) + 1;

  if (days < 1) throw new Error("end must be on or after start.");
  if (days > MAXIMUM_DISCOVERY_DAYS) {
    throw new Error(`The discovery range cannot exceed ${MAXIMUM_DISCOVERY_DAYS} days.`);
  }

  return { start, end, days };
}

const validateSubdomain = (value) => {
  if (typeof value !== "string") {
    throw new Error(
      "BREEZE_ACCOUNT_SUBDOMAIN must be the account subdomain only, such as 'gracechurch'.",
    );
  }
  const subdomain = value.trim().toLowerCase();
  if (
    !SUBDOMAIN_PATTERN.test(subdomain) ||
    isIP(subdomain) !== 0 ||
    subdomain === "www" ||
    subdomain.includes("breezechms")
  ) {
    throw new Error(
      "BREEZE_ACCOUNT_SUBDOMAIN must be the account subdomain only, such as 'gracechurch'.",
    );
  }
  return subdomain;
};

const positiveInteger = (value, label) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
};

const booleanParameter = (value) => (value ? "1" : "0");

export class BreezeReadOnlyClient {
  #apiKey;
  #baseUrl;
  #fetch;
  #minimumIntervalMs;
  #maximumRequests;
  #requestTimeoutMs;
  #maximumResponseBytes;
  #sleep;
  #now;
  #onRequest;
  #lastRequestStartedAt;
  #requestCount = 0;
  #requestQueue = Promise.resolve();

  constructor({
    subdomain,
    apiKey,
    fetchImplementation = globalThis.fetch,
    minimumIntervalMs = DEFAULT_MINIMUM_INTERVAL_MS,
    maximumRequests = DEFAULT_MAXIMUM_REQUESTS,
    requestTimeoutMs = DEFAULT_TIMEOUT_MS,
    maximumResponseBytes = DEFAULT_MAXIMUM_RESPONSE_BYTES,
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = () => Date.now(),
    onRequest = () => {},
  }) {
    if (typeof fetchImplementation !== "function") {
      throw new Error("A fetch implementation is required.");
    }
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new Error("BREEZE_API_KEY is required.");
    }
    if (!Number.isFinite(minimumIntervalMs) || minimumIntervalMs < DEFAULT_MINIMUM_INTERVAL_MS) {
      throw new Error(
        `minimumIntervalMs cannot be lower than ${DEFAULT_MINIMUM_INTERVAL_MS}.`,
      );
    }

    const safeSubdomain = validateSubdomain(subdomain);
    this.#apiKey = apiKey.trim();
    this.#baseUrl = new URL(`https://${safeSubdomain}.breezechms.com`);
    this.#fetch = fetchImplementation;
    this.#minimumIntervalMs = minimumIntervalMs;
    this.#maximumRequests = positiveInteger(maximumRequests, "maximumRequests");
    this.#requestTimeoutMs = positiveInteger(requestTimeoutMs, "requestTimeoutMs");
    this.#maximumResponseBytes = positiveInteger(
      maximumResponseBytes,
      "maximumResponseBytes",
    );
    this.#sleep = sleep;
    this.#now = now;
    this.#onRequest = onRequest;
  }

  get requestCount() {
    return this.#requestCount;
  }

  accountSummary() {
    return this.#request("accountSummary");
  }

  calendars() {
    return this.#request("calendars");
  }

  locations() {
    return this.#request("locations");
  }

  events({ start, end, limit = 1_000 }) {
    validateDiscoveryRange(start, end);
    positiveInteger(limit, "events limit");
    if (limit > 1_000) throw new Error("events limit cannot exceed 1000.");
    return this.#request("events", {
      start,
      end,
      details: "1",
      eligible: "1",
      limit: String(limit),
    });
  }

  event({
    instanceId,
    details = true,
    eligible = true,
    schedule = false,
    scheduleDirection = "before",
    scheduleLimit = 20,
  }) {
    if (!/^\d+$/.test(instanceId)) {
      throw new Error("instanceId must contain digits only.");
    }
    if (!new Set(["before", "after"]).has(scheduleDirection)) {
      throw new Error("scheduleDirection must be 'before' or 'after'.");
    }
    positiveInteger(scheduleLimit, "scheduleLimit");
    if (scheduleLimit > 100) throw new Error("scheduleLimit cannot exceed 100.");

    const parameters = {
      instance_id: instanceId,
      details: booleanParameter(details),
      eligible: booleanParameter(eligible),
    };
    if (schedule) {
      parameters.schedule = "1";
      parameters.schedule_direction = scheduleDirection;
      parameters.schedule_limit = String(scheduleLimit);
    }
    return this.#request("event", parameters);
  }

  accountLog({ action, start, end, limit = 50 }) {
    validateDiscoveryRange(start, end);
    if (!eventLogActions.has(action)) {
      throw new Error(`Unsupported event log action: ${action}`);
    }
    positiveInteger(limit, "account log limit");
    if (limit > 100) throw new Error("account log limit cannot exceed 100 during discovery.");
    return this.#request("accountLog", {
      action,
      start,
      end,
      details: "0",
      limit: String(limit),
    });
  }

  #request(endpointName, parameters = {}) {
    const request = this.#requestQueue.then(() =>
      this.#executeRequest(endpointName, parameters),
    );
    this.#requestQueue = request.catch(() => {});
    return request;
  }

  async #executeRequest(endpointName, parameters) {
    const endpoint = endpoints[endpointName];
    if (!endpoint) throw new Error(`Endpoint is not allowlisted: ${endpointName}`);
    if (this.#requestCount >= this.#maximumRequests) {
      throw new Error(
        `Discovery stopped at the configured ${this.#maximumRequests}-request ceiling.`,
      );
    }

    for (const name of Object.keys(parameters)) {
      if (!endpoint.parameters.has(name)) {
        throw new Error(`Query parameter is not allowlisted for ${endpointName}: ${name}`);
      }
    }

    if (this.#lastRequestStartedAt !== undefined) {
      const elapsed = this.#now() - this.#lastRequestStartedAt;
      if (elapsed < this.#minimumIntervalMs) {
        await this.#sleep(this.#minimumIntervalMs - elapsed);
      }
    }

    const url = new URL(endpoint.path, this.#baseUrl);
    for (const [name, value] of Object.entries(parameters)) {
      url.searchParams.set(name, value);
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== this.#baseUrl.hostname ||
      !url.pathname.startsWith("/api/")
    ) {
      throw new Error("Refusing to send the API key outside the configured Breeze account.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    this.#lastRequestStartedAt = this.#now();
    this.#requestCount += 1;

    try {
      this.#onRequest({ number: this.#requestCount, endpoint: endpointName });
      const response = await this.#fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Api-key": this.#apiKey,
          "User-Agent": "churchwebsite-breeze-discovery/1.0",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        throw new Error(`Breeze returned an unexpected redirect for ${endpointName}.`);
      }
      if (!response.ok) {
        throw new Error(`Breeze ${endpointName} request failed with HTTP ${response.status}.`);
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (declaredLength > this.#maximumResponseBytes) {
        throw new Error(`Breeze ${endpointName} response exceeded the size limit.`);
      }

      const body = await response.text();
      if (Buffer.byteLength(body) > this.#maximumResponseBytes) {
        throw new Error(`Breeze ${endpointName} response exceeded the size limit.`);
      }
      try {
        return JSON.parse(body);
      } catch {
        throw new Error(`Breeze ${endpointName} response was not valid JSON.`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

const valueType = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const collectRecordShape = (value, prefix = "", result = new Map()) => {
  if (!isRecord(value)) return result;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const current = result.get(path) ?? {
      nulls: 0,
      occurrences: 0,
      types: new Set(),
    };
    current.nulls += child === null ? 1 : 0;
    current.occurrences += 1;
    current.types.add(valueType(child));
    result.set(path, current);

    if (isRecord(child)) collectRecordShape(child, path, result);
    if (Array.isArray(child)) {
      for (const item of child.filter(isRecord)) {
        collectRecordShape(item, `${path}[]`, result);
      }
    }
  }
  return result;
};

const shapeReport = (value) => {
  const records = asRecords(value);
  const result = new Map();
  for (const record of records) {
    for (const [path, recordSummary] of collectRecordShape(record)) {
      const summary = result.get(path) ?? {
        present: 0,
        nulls: 0,
        occurrences: 0,
        types: new Set(),
      };
      summary.present += 1;
      summary.nulls += recordSummary.nulls;
      summary.occurrences += recordSummary.occurrences;
      for (const type of recordSummary.types) summary.types.add(type);
      result.set(path, summary);
    }
  }
  return Object.fromEntries(
    [...result.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, summary]) => [
        path,
        {
          present: summary.present,
          missing: records.length - summary.present,
          nulls: summary.nulls,
          occurrences: summary.occurrences,
          types: [...summary.types].sort(),
        },
      ]),
  );
};

const uniqueCount = (values) => new Set(values.filter(isPresent).map(scalarKey)).size;

const duplicateCount = (values) => {
  const present = values.filter(isPresent).map(scalarKey);
  return present.length - new Set(present).size;
};

const identifierSummary = (records, field) => {
  const values = records.map((record) => record[field]);
  return {
    sourceField: field,
    present: values.filter(isPresent).length,
    missing: values.filter((value) => !isPresent(value)).length,
    unique: uniqueCount(values),
    duplicates: duplicateCount(values),
  };
};

const logRecords = (logs) =>
  Object.entries(logs ?? {}).flatMap(([action, value]) =>
    asRecords(value).map((record) => ({ ...record, requestedAction: action })),
  );

const logObjectShape = (record) => {
  if (typeof record.object_json !== "string") return valueType(record.object_json);
  try {
    return valueType(JSON.parse(record.object_json));
  } catch {
    return "invalid-json";
  }
};

const logCounts = (logs) =>
  Object.fromEntries(
    Object.entries(logs ?? {}).map(([action, value]) => [action, asRecords(value).length]),
  );

const collectRelevantTagIds = (value, insideTagStructure = false, ids = new Set()) => {
  if (Array.isArray(value)) {
    for (const item of value) collectRelevantTagIds(item, insideTagStructure, ids);
    return ids;
  }
  if (!isRecord(value)) return ids;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const keyMentionsTag = normalizedKey.includes("tag");
    const childIsInsideTagStructure = insideTagStructure || keyMentionsTag;
    if (
      normalizedKey === "tag_id" ||
      normalizedKey === "tag_ids" ||
      (insideTagStructure && normalizedKey === "id")
    ) {
      const candidates = Array.isArray(child) ? child : [child];
      for (const candidate of candidates) {
        const id = scalarKey(candidate);
        if (/^\d+$/.test(id)) ids.add(id);
      }
    }
    collectRelevantTagIds(child, childIsInsideTagStructure, ids);
  }
  return ids;
};

const dataIssue = (code, count, severity, recommendation) => ({
  code,
  count,
  severity,
  recommendation,
});

const buildFieldMapping = () => [
  {
    target: "source.system",
    source: "constant: breeze",
    authority: "integration",
    rule: "Store as explicit source metadata; do not encode it in the Sanity _id.",
  },
  {
    target: "source.instanceId",
    source: "id",
    authority: "Breeze",
    rule: "Stable occurrence lookup key; unique within the observed event window.",
  },
  {
    target: "source.seriesId",
    source: "event_id",
    authority: "Breeze",
    rule: "Series grouping key; multiple instance IDs may share it.",
  },
  {
    target: "source.calendarId",
    source: "category_id",
    authority: "Breeze",
    rule: "Resolve against the approved calendar allowlist before synchronization.",
  },
  {
    target: "title",
    source: "name",
    authority: "Breeze",
    rule: "Operational title synchronized one way.",
  },
  {
    target: "startsAt",
    source: "start_datetime",
    authority: "Breeze",
    rule: "Interpret as an account-timezone wall clock; never append Z directly.",
  },
  {
    target: "endsAt",
    source: "end_datetime",
    authority: "Breeze",
    rule: "Convert zero-date sentinels to undefined before validation.",
  },
  {
    target: "allDay",
    source: "all_day when present",
    authority: "Breeze",
    rule: "Do not infer all-day solely from a midnight time or a zero end date.",
  },
  {
    target: "source.isModified",
    source: "is_modified",
    authority: "Breeze",
    rule: "Preserve occurrence override state for recurrence diagnostics.",
  },
  {
    target: "operationalLocation",
    source: "observed location ID/name fields",
    authority: "Breeze",
    rule: "Resolve IDs through the location list; keep website directions editorial.",
  },
  {
    target: "source.status",
    source: "event logs plus full-window reconciliation",
    authority: "integration",
    rule: "Mark missing records suspect first; archive only after confirmed reconciliation.",
  },
  {
    target: "slug, summary, image, featured, site, registrationUrl, seo",
    source: "not synchronized",
    authority: "Sanity",
    rule: "Preserve editorial values on every Breeze update.",
  },
];

export function buildDiscoveryReport({
  configuredSubdomain,
  start,
  end,
  account,
  calendars,
  locations,
  events,
  eventDetails = [],
  schedules = [],
  logs = {},
  generatedAt = new Date().toISOString(),
  requestCount = 0,
}) {
  const range = validateDiscoveryRange(start, end);
  const accountRecord = asRecords(account)[0] ?? {};
  const calendarRecords = asRecords(calendars);
  const locationRecords = asRecords(locations);
  const eventRecords = asRecords(events);
  const detailRecords = eventDetails.flatMap(asRecords);
  const allLogRecords = logRecords(logs);

  const seriesIds = eventRecords.map((record) => record.event_id);
  const seriesFrequency = new Map();
  for (const id of seriesIds.filter(isPresent).map(scalarKey)) {
    seriesFrequency.set(id, (seriesFrequency.get(id) ?? 0) + 1);
  }
  const recurringSeries = [...seriesFrequency.values()].filter((count) => count > 1);
  const modifiedRecords = eventRecords.filter(
    (record) => isTrueLike(record.is_modified),
  );
  const zeroStart = eventRecords.filter((record) =>
    scalarKey(record.start_datetime).startsWith(ZERO_DATE_PREFIX),
  );
  const zeroEnd = eventRecords.filter((record) =>
    scalarKey(record.end_datetime).startsWith(ZERO_DATE_PREFIX),
  );
  const explicitAllDayIds = new Set(
    [...eventRecords, ...detailRecords]
      .filter((record) => isTrueLike(record.all_day))
      .map((record, index) => scalarKey(record.id) || `record-${index}`),
  );
  const missingNames = eventRecords.filter((record) => !isPresent(record.name));
  const missingStarts = eventRecords.filter((record) => !isPresent(record.start_datetime));
  const unknownCalendars = eventRecords.filter(
    (record) =>
      isPresent(record.category_id) &&
      !new Set(calendarRecords.map((calendar) => scalarKey(calendar.id))).has(
        scalarKey(record.category_id),
      ),
  );
  const eventLimitReached = eventRecords.length >= 1_000;
  const invalidLogPayloads = allLogRecords.filter(
    (record) => logObjectShape(record) === "invalid-json",
  );
  const configured = validateSubdomain(configuredSubdomain);
  const observedSubdomain = scalarKey(accountRecord.subdomain).toLowerCase();
  const timezone = isRecord(accountRecord.details)
    ? scalarKey(accountRecord.details.timezone)
    : "";
  const deletionCounts = Object.fromEntries(
    [...eventLogActions]
      .filter((action) => action.includes("deleted"))
      .map((action) => [action, asRecords(logs[action]).length]),
  );

  const dataQuality = [
    dataIssue(
      "zero-start-datetime",
      zeroStart.length,
      "error",
      "Quarantine the record; it cannot be placed on the website calendar safely.",
    ),
    dataIssue(
      "zero-end-datetime",
      zeroEnd.length,
      "warning",
      "Treat the end as absent, then apply a documented display fallback.",
    ),
    dataIssue(
      "missing-title",
      missingNames.length,
      "error",
      "Quarantine until the Breeze event has a non-empty name.",
    ),
    dataIssue(
      "missing-start-datetime",
      missingStarts.length,
      "error",
      "Quarantine until Breeze supplies a start date and time.",
    ),
    dataIssue(
      "unknown-calendar",
      unknownCalendars.length,
      "error",
      "Do not synchronize calendars that are absent from the approved calendar list.",
    ),
    dataIssue(
      "event-limit-reached",
      eventLimitReached ? 1 : 0,
      "error",
      "Split the date range and rerun; the report may otherwise be incomplete.",
    ),
    dataIssue(
      "invalid-log-object-json",
      invalidLogPayloads.length,
      "warning",
      "Retain the log cursor but do not automate a destructive transition from this row.",
    ),
  ];

  return {
    metadata: {
      generatedAt,
      range,
      requestCount,
      containsRawResponses: false,
      redaction:
        "Scalar source values are omitted except non-secret counts, booleans, timezone, and numeric calendar/location/tag IDs retained for approval.",
    },
    account: {
      configuredSubdomainMatchesSummary:
        observedSubdomain !== "" && observedSubdomain === configured,
      timezone: timezone || null,
      timezoneConfirmed: timezone !== "",
    },
    counts: {
      calendars: calendarRecords.length,
      locations: locationRecords.length,
      events: eventRecords.length,
      eventDetailSamples: detailRecords.length,
      scheduleSamples: schedules.length,
      accountLogRows: allLogRecords.length,
      accountLogRowsByAction: logCounts(logs),
    },
    inventory: {
      calendars: calendarRecords.map((calendar) => ({
        id: /^\d+$/.test(scalarKey(calendar.id)) ? scalarKey(calendar.id) : "[redacted]",
        kind:
          typeof calendar.address !== "string"
            ? "unknown"
            : calendar.address.startsWith(`https://${configured}.breezechms.com/`)
              ? "internal"
              : "external",
      })),
      locationIds: [
        ...new Set(
          locationRecords
            .map((location) => scalarKey(location.id))
            .filter((id) => /^\d+$/.test(id)),
        ),
      ].sort((left, right) => Number(left) - Number(right)),
      relevantTagIds: [...collectRelevantTagIds([eventRecords, detailRecords])].sort(
        (left, right) => Number(left) - Number(right),
      ),
      note:
        "Names and feed URLs are redacted. Numeric IDs are retained so a human can approve exact calendars, locations, and event-eligibility tags.",
    },
    sourceShape: {
      account: shapeReport(accountRecord),
      calendars: shapeReport(calendarRecords),
      locations: shapeReport(locationRecords),
      events: shapeReport(eventRecords),
      eventDetails: shapeReport(detailRecords),
      accountLogs: shapeReport(allLogRecords),
      schedules: shapeReport(schedules.flatMap((sample) => asRecords(sample.response))),
    },
    identifiers: {
      eventInstance: identifierSummary(eventRecords, "id"),
      eventSeries: identifierSummary(eventRecords, "event_id"),
      eventCalendar: identifierSummary(eventRecords, "category_id"),
      calendar: identifierSummary(calendarRecords, "id"),
      location: identifierSummary(locationRecords, "id"),
      recommendation:
        "Use explicit source.instanceId/source.seriesId fields and look them up when upserting; let Sanity generate document _id values.",
    },
    recurrence: {
      distinctSeries: seriesFrequency.size,
      recurringSeries: recurringSeries.length,
      largestObservedSeries: recurringSeries.length > 0 ? Math.max(...recurringSeries) : 0,
      scheduleSamples: schedules.length,
      recommendation:
        "Sync each occurrence by instance ID, group by series ID, and never replace an occurrence override with a series default.",
    },
    modifications: {
      modifiedOccurrences: modifiedRecords.length,
      recommendation:
        "Treat is_modified=1 as an occurrence override signal and synchronize that instance independently.",
    },
    deletions: {
      rowsByAction: deletionCounts,
      objectJsonShapes: [...new Set(allLogRecords.map(logObjectShape))].sort(),
      listEndpointHasTombstones: false,
      recommendation:
        "Combine overlapped UTC activity-log polling with a full approved-window reconciliation. Mark missing events suspect, then archive after two successful reconciliations at least 30 minutes apart; never hard-delete automatically.",
    },
    dateQuality: {
      explicitAllDayOccurrences: explicitAllDayIds.size,
      zeroStartDatetimes: zeroStart.length,
      zeroEndDatetimes: zeroEnd.length,
      timezone: timezone || null,
      recommendation:
        "Parse Breeze event timestamps as wall-clock values in the account timezone. Activity-log timestamps are UTC. Preserve all-day as a separate semantic flag.",
    },
    dataQuality,
    fieldMapping: buildFieldMapping(),
    pollingRecommendation: {
      incremental:
        "Every 30 minutes, poll each event log action with a 24-hour overlap and deduplicate by log row ID.",
      reconciliation:
        "Daily, fetch the complete approved event window in smaller date slices when any slice reaches 1000 rows.",
      lag:
        "Breeze documents up to 15 minutes of event endpoint cache lag; do not archive a missing occurrence on the first observation.",
      cursor:
        "Persist the last successful log ID and UTC timestamp only after the whole polling batch succeeds.",
      failures:
        "Retry on the next scheduled run; keep the same 3.5-second request interval and require a complete run before reconciling absence.",
    },
    approval: {
      status: "pending",
      requirement:
        "A human must review the account-specific report, approve calendar IDs, and record approval before RCC-59 production sync work begins.",
    },
  };
}

const markdownTable = (headers, rows) => {
  const escape = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
};

export function renderDiscoveryMarkdown(report) {
  const logCounts = report.counts.accountLogRowsByAction;
  const issues = report.dataQuality.filter((issue) => issue.count > 0);
  const shapeRows = Object.entries(report.sourceShape).flatMap(([group, fields]) =>
    Object.entries(fields).map(([field, summary]) => [
      group,
      field,
      summary.types.join(", "),
      summary.present,
      summary.missing,
      summary.nulls,
    ]),
  );
  const calendarRows = report.inventory.calendars.map((calendar) => [
    calendar.id,
    calendar.kind === "external"
      ? "external feed"
      : calendar.kind === "internal"
        ? "internal Breeze calendar"
        : "unknown",
    "pending",
  ]);

  return `# Breeze event discovery report

Generated: ${report.metadata.generatedAt}

This report contains no raw Breeze responses or API credentials. Scalar source values are redacted except for non-secret counts, booleans, the account timezone, and numeric calendar/location/tag IDs retained for approval.

## Safety and completeness

- Requests made: ${report.metadata.requestCount}
- Bounded event/log range: ${report.metadata.range.start} through ${report.metadata.range.end} (${report.metadata.range.days} days)
- Configured subdomain matches account summary: ${report.account.configuredSubdomainMatchesSummary}
- Account timezone confirmed: ${report.account.timezoneConfirmed ? report.account.timezone : "no"}
- Human approval: ${report.approval.status}

## Counts

${markdownTable(
  ["Resource", "Count"],
  [
    ["Calendars", report.counts.calendars],
    ["Locations", report.counts.locations],
    ["Events", report.counts.events],
    ["Event detail samples", report.counts.eventDetailSamples],
    ["Schedule samples", report.counts.scheduleSamples],
    ["Account log rows", report.counts.accountLogRows],
    ...Object.entries(logCounts).map(([action, count]) => [`Log: ${action}`, count]),
  ],
)}

## Account inventory for approval

Names and feed URLs are redacted; numeric IDs are retained so the reviewer can approve the exact source records.

${calendarRows.length > 0
  ? markdownTable(["Calendar ID", "Kind", "Approval"], calendarRows)
  : "No calendars were returned."}

- Location IDs: ${report.inventory.locationIds.length > 0 ? report.inventory.locationIds.join(", ") : "none observed"}
- Relevant eligibility tag IDs: ${report.inventory.relevantTagIds.length > 0 ? report.inventory.relevantTagIds.join(", ") : "none observed"}

## Reliable source keys

${markdownTable(
  ["Identity", "Field", "Present", "Missing", "Unique", "Duplicates"],
  Object.entries(report.identifiers)
    .filter(([, value]) => typeof value === "object")
    .map(([name, value]) => [
      name,
      value.sourceField,
      value.present,
      value.missing,
      value.unique,
      value.duplicates,
    ]),
)}

Recommendation: ${report.identifiers.recommendation}

## Recurrence, modifications, and deletions

- Distinct series: ${report.recurrence.distinctSeries}
- Recurring series in range: ${report.recurrence.recurringSeries}
- Largest observed series: ${report.recurrence.largestObservedSeries}
- Modified occurrences: ${report.modifications.modifiedOccurrences}
- Explicit all-day occurrences: ${report.dateQuality.explicitAllDayOccurrences}
- Zero start datetimes: ${report.dateQuality.zeroStartDatetimes}
- Zero end datetimes: ${report.dateQuality.zeroEndDatetimes}
- Deletion-log rows: ${Object.values(report.deletions.rowsByAction).reduce((sum, count) => sum + count, 0)}

${report.deletions.recommendation}

## Data-quality findings

${issues.length > 0
  ? markdownTable(
      ["Severity", "Code", "Count", "Recommendation"],
      issues.map((issue) => [issue.severity, issue.code, issue.count, issue.recommendation]),
    )
  : "No modeled data-quality issue was observed in this bounded sample."}

## Source shape (values redacted)

${markdownTable(
  ["Resource", "Field path", "Types", "Present", "Missing", "Null"],
  shapeRows,
)}

## Proposed Breeze-to-Sanity mapping

${markdownTable(
  ["Sanity target", "Breeze source", "Authority", "Rule"],
  report.fieldMapping.map((mapping) => [
    mapping.target,
    mapping.source,
    mapping.authority,
    mapping.rule,
  ]),
)}

## Polling and reconciliation recommendation

- Incremental: ${report.pollingRecommendation.incremental}
- Full reconciliation: ${report.pollingRecommendation.reconciliation}
- API lag: ${report.pollingRecommendation.lag}
- Cursor: ${report.pollingRecommendation.cursor}
- Failures: ${report.pollingRecommendation.failures}

## Approval gate

${report.approval.requirement}

- [ ] Account owner / ministry lead reviewed the account-specific findings.
- [ ] Approved Breeze calendar IDs are recorded for the production sync.
- [ ] Recurrence, deletion, all-day, zero-date, location, and tag behavior is accepted.
- [ ] Approval name, date, and Linear comment/link are recorded here before RCC-59 begins production synchronization.
`;
}
