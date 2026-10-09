export type UnknownRecord = Record<string, unknown>;

export interface MirroredEvent {
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  operationalLocation?: string;
  sourceUrl?: string;
  calendarName: string;
  source: {
    system: "breeze";
    instanceId: string;
    seriesId?: string;
    calendarId: string;
    locationId?: string;
    isModified: boolean;
    status: "active";
  };
}

export type ExistingEvent = Omit<MirroredEvent, "source"> & {
  _id: string;
  _rev: string;
  slug?: {current?: string};
  source: Omit<MirroredEvent["source"], "status"> & {
    status: "active" | "suspect" | "archived";
    missingSince?: string;
  };
};

const asString = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function recordsFrom(value: unknown, collectionNames: string[] = []): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const name of collectionNames) {
    if (name in value) {
      const records = recordsFrom(value[name]);
      if (records.length > 0) return records;
    }
  }
  const nested = Object.values(value).filter(isRecord);
  return nested.length > 0 ? nested : [value];
}

function booleanValue(value: unknown) {
  if (value === true || value === 1) return true;
  return ["1", "true", "yes"].includes(asString(value).toLowerCase());
}

function decodeText(value: unknown) {
  const text = asString(value);
  if (!text) return undefined;
  return text
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || undefined;
}

function safeSourceUrl(event: UnknownRecord) {
  const direct = asString(event.registration_url ?? event.url ?? event.link);
  const description = asString(event.description ?? event.details ?? event.event_description);
  const href = description.match(/href=["'](https:\/\/[^"']+)["']/i)?.[1];
  const plain = description.match(/https:\/\/[^\s<"']+/i)?.[0];
  const candidate = direct || href || plain;
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate.replace(/&amp;/g, "&"));
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function wallClockParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match || value.startsWith("0000-00-00")) return undefined;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  };
}

export function breezeWallClockToIso(value: unknown, timeZone: string) {
  const parts = wallClockParts(asString(value));
  if (!parts) return undefined;
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let result = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = Object.fromEntries(
      formatter.formatToParts(new Date(result)).map(({type, value: part}) => [type, part]),
    );
    const renderedWallClock = Date.UTC(
      Number(rendered.year),
      Number(rendered.month) - 1,
      Number(rendered.day),
      Number(rendered.hour),
      Number(rendered.minute),
      Number(rendered.second),
    );
    const correction = desired - renderedWallClock;
    result += correction;
    if (correction === 0) break;
  }
  const date = new Date(result);
  if (Number.isNaN(date.valueOf())) return undefined;
  return date.toISOString();
}

export function selectCalendar(calendars: UnknownRecord[], configuredId?: string) {
  if (configuredId) {
    const selected = calendars.find((calendar) => asString(calendar.id) === configuredId);
    if (!selected) throw new Error(`Configured Breeze calendar ${configuredId} was not returned.`);
    return selected;
  }
  if (calendars.length !== 1) {
    throw new Error(
      `Expected exactly one Breeze calendar, but received ${calendars.length}. Set BREEZE_CALENDAR_ID before syncing.`,
    );
  }
  return calendars[0];
}

export function normalizeBreezeEvents(options: {
  events: UnknownRecord[];
  calendar: UnknownRecord;
  locations: UnknownRecord[];
  timeZone: string;
}) {
  const calendarId = asString(options.calendar.id);
  const calendarName = asString(options.calendar.name) || "Church calendar";
  if (!calendarId) throw new Error("The selected Breeze calendar has no ID.");
  const locations = new Map(
    options.locations.map((location) => [asString(location.id), asString(location.name)]),
  );
  const normalized: MirroredEvent[] = [];
  const instanceIds = new Set<string>();

  for (const sourceEvent of options.events) {
    if (asString(sourceEvent.category_id) !== calendarId) continue;
    const instanceId = asString(sourceEvent.id);
    const title = asString(sourceEvent.name);
    const startsAt = breezeWallClockToIso(sourceEvent.start_datetime, options.timeZone);
    if (!instanceId || !title || !startsAt) continue;
    if (instanceIds.has(instanceId)) throw new Error(`Breeze returned duplicate instance ID ${instanceId}.`);
    instanceIds.add(instanceId);
    const locationId = asString(
      sourceEvent.location_id ?? sourceEvent.event_location_id ?? sourceEvent.address_id,
    );
    const inlineLocation = asString(
      sourceEvent.location_name ?? sourceEvent.location ?? sourceEvent.address_name,
    );
    const description = decodeText(
      sourceEvent.description ?? sourceEvent.details ?? sourceEvent.event_description,
    );
    normalized.push({
      title,
      ...(description ? {description} : {}),
      startsAt,
      ...(breezeWallClockToIso(sourceEvent.end_datetime, options.timeZone)
        ? {endsAt: breezeWallClockToIso(sourceEvent.end_datetime, options.timeZone)}
        : {}),
      allDay: booleanValue(sourceEvent.all_day),
      ...(inlineLocation || locations.get(locationId)
        ? {operationalLocation: inlineLocation || locations.get(locationId)}
        : {}),
      ...(safeSourceUrl(sourceEvent) ? {sourceUrl: safeSourceUrl(sourceEvent)} : {}),
      calendarName,
      source: {
        system: "breeze",
        instanceId,
        ...(asString(sourceEvent.event_id) ? {seriesId: asString(sourceEvent.event_id)} : {}),
        calendarId,
        ...(locationId ? {locationId} : {}),
        isModified: booleanValue(sourceEvent.is_modified),
        status: "active",
      },
    });
  }
  return normalized.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

export function slugForEvent(event: MirroredEvent) {
  const title = event.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "event";
  return `${title}-${event.startsAt.slice(0, 10)}-${event.source.instanceId}`;
}

function comparable(event: MirroredEvent | ExistingEvent) {
  return {
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    operationalLocation: event.operationalLocation,
    sourceUrl: event.sourceUrl,
    calendarName: event.calendarName,
    source: {
      system: event.source.system,
      instanceId: event.source.instanceId,
      seriesId: event.source.seriesId,
      calendarId: event.source.calendarId,
      locationId: event.source.locationId,
      isModified: event.source.isModified,
      status: event.source.status,
    },
  };
}

export function buildSyncPlan(sourceEvents: MirroredEvent[], existingEvents: ExistingEvent[], now: Date) {
  const existingByInstance = new Map<string, ExistingEvent>();
  for (const event of existingEvents) {
    const id = event.source.instanceId;
    if (existingByInstance.has(id)) throw new Error(`Sanity contains duplicate Breeze instance ID ${id}.`);
    existingByInstance.set(id, event);
  }
  const creates: MirroredEvent[] = [];
  const updates: Array<{existing: ExistingEvent; event: MirroredEvent}> = [];
  const suspects: ExistingEvent[] = [];
  const archives: ExistingEvent[] = [];

  for (const event of sourceEvents) {
    const existing = existingByInstance.get(event.source.instanceId);
    if (!existing) creates.push(event);
    else {
      existingByInstance.delete(event.source.instanceId);
      if (JSON.stringify(comparable(existing)) !== JSON.stringify(comparable(event))) {
        updates.push({existing, event});
      }
    }
  }
  for (const existing of existingByInstance.values()) {
    if (existing.source.status === "archived") continue;
    if (existing.source.missingSince || existing.source.status === "suspect") archives.push(existing);
    else suspects.push(existing);
  }
  return {creates, updates, suspects, archives, generatedAt: now.toISOString()};
}
