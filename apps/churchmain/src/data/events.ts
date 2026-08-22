import {enforceSanityProductionConfig, memoizePromise} from "@churchwebsite/newsletters";
import {createClient} from "@sanity/client";
import {defineQuery} from "groq";

import type {CHURCH_MAIN_EVENTS_QUERY_RESULT} from "../sanity.types";

const CALENDAR_TIME_ZONE = "America/Regina";
const SANITY_API_VERSION = "2026-08-22";

export interface ChurchEvent {
  id: string;
  slug: string;
  date: string;
  startsAt: string;
  endsAt?: string;
  startTime: string;
  endTime?: string;
  allDay: boolean;
  title: string;
  location: string;
  description: string;
  category: string;
  categoryStyle: "program";
  registrationUrl?: string;
}

type SanityEvent = CHURCH_MAIN_EVENTS_QUERY_RESULT[number];

export const CHURCH_MAIN_EVENTS_QUERY = defineQuery(/* groq */ `
  *[
    _type == "event" &&
    site == "churchMain" &&
    source.system == "breeze" &&
    source.status in ["active", "suspect"] &&
    startsAt >= $today &&
    startsAt < $end
  ] | order(startsAt asc, title asc) {
    _id,
    title,
    "slug": slug.current,
    description,
    websiteSummary,
    startsAt,
    endsAt,
    allDay,
    operationalLocation,
    calendarName,
    sourceUrl,
    registrationUrl
  }
`);

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", {timeZone: CALENDAR_TIME_ZONE, ...options});

const dateParts = (value: Date | string) => {
  const parts = formatter({year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const timeParts = (value: string) => {
  const parts = formatter({hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(
    new Date(value),
  );
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
};

const addYears = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setUTCFullYear(copy.getUTCFullYear() + amount);
  return copy;
};

function normalizeEvent(event: SanityEvent): ChurchEvent | undefined {
  if (!event.title || !event.startsAt) {
    console.warn(`Skipping incomplete Church Main event ${event._id}.`);
    return undefined;
  }
  return {
    id: event.slug || event._id,
    slug: event.slug || event._id,
    date: dateParts(event.startsAt),
    startsAt: event.startsAt,
    ...(event.endsAt ? {endsAt: event.endsAt} : {}),
    startTime: timeParts(event.startsAt),
    ...(event.endsAt ? {endTime: timeParts(event.endsAt)} : {}),
    allDay: event.allDay ?? false,
    title: event.title,
    location: event.operationalLocation || "RCCG Cornerstone Assembly",
    description: event.websiteSummary || event.description || "See Breeze for event details.",
    category: event.calendarName || "Church calendar",
    categoryStyle: "program",
    ...(event.registrationUrl || event.sourceUrl
      ? {registrationUrl: event.registrationUrl || event.sourceUrl || undefined}
      : {}),
  };
}

async function loadChurchEvents() {
  const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = import.meta.env.PUBLIC_SANITY_DATASET;
  const token = import.meta.env.SANITY_API_READ_TOKEN;
  enforceSanityProductionConfig({
    deployment: import.meta.env.VERCEL_ENV,
    projectId,
    dataset,
    token,
    label: "Church Main",
  });
  if (!projectId || !dataset) {
    throw new Error("Church Main requires PUBLIC_SANITY_PROJECT_ID and PUBLIC_SANITY_DATASET.");
  }
  const now = new Date();
  const client = createClient({
    projectId,
    dataset,
    apiVersion: SANITY_API_VERSION,
    useCdn: false,
    perspective: "published",
    token,
  });
  try {
    const events: CHURCH_MAIN_EVENTS_QUERY_RESULT = await client.fetch(CHURCH_MAIN_EVENTS_QUERY, {
      today: now.toISOString(),
      end: addYears(now, 1).toISOString(),
    });
    return events.map(normalizeEvent).filter((event): event is ChurchEvent => event !== undefined);
  } catch (error) {
    throw new Error("Unable to fetch Church Main events from Sanity.", {cause: error});
  }
}

const getCachedEvents = import.meta.env.DEV ? loadChurchEvents : memoizePromise(loadChurchEvents);

export function getChurchEvents(): Promise<ChurchEvent[]> {
  return getCachedEvents();
}

export const calendarToday = dateParts(new Date());
export const eventDate = (value: string) => new Date(`${value}T12:00:00Z`);

export const formatEventDate = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", {timeZone: "UTC", ...options}).format(eventDate(value));

export const formatEventTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  const displayHour = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
};

export const eventTimeRange = (event: ChurchEvent) => {
  if (event.allDay) return "All day";
  const start = formatEventTime(event.startTime);
  return event.endTime ? `${start}–${formatEventTime(event.endTime)}` : start;
};
