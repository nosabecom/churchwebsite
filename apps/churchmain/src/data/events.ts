export type EventCategory = "Worship" | "Program" | "Community";

export interface ChurchEvent {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    title: string;
    location: string;
    description: string;
    category: EventCategory;
}

const CALENDAR_TIME_ZONE = "America/Regina";
const MONTHS_TO_PUBLISH = 6;

const dateKey = (date: Date) => [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
].join("-");

const dateFromKey = (value: string) => new Date(`${value}T12:00:00Z`);

const reginaToday = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: CALENDAR_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((item) => item.type === type)?.value);

    return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
};

const addMonths = (date: Date, amount: number) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));

const event = (
    date: Date,
    values: Omit<ChurchEvent, "id" | "date"> & { slug: string },
): ChurchEvent => ({
    id: `${dateKey(date)}-${values.slug}`,
    date: dateKey(date),
    startTime: values.startTime,
    endTime: values.endTime,
    title: values.title,
    location: values.location,
    description: values.description,
    category: values.category,
});

const buildPublishedEvents = () => {
    const today = reginaToday();
    const firstMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const lastMonth = addMonths(firstMonth, MONTHS_TO_PUBLISH - 1);
    const lastDate = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 0));
    const events: ChurchEvent[] = [];

    for (
        let cursor = new Date(firstMonth);
        cursor <= lastDate;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
        const occurrence = new Date(cursor);
        if (occurrence < today) continue;

        if (occurrence.getUTCDay() === 0) {
            events.push(event(occurrence, {
                slug: "sunday-service",
                startTime: "09:00",
                endTime: "12:00",
                title: "Sunday Service",
                location: "Main Auditorium",
                description: "A joyful morning of worship, prayer, fellowship, and a message from God’s word.",
                category: "Worship",
            }));
        }

        if (occurrence.getUTCDay() === 3) {
            events.push(event(occurrence, {
                slug: "mid-week-service",
                startTime: "19:00",
                endTime: "20:30",
                title: "Mid-week Service",
                location: "Main Auditorium",
                description: "Read, discuss, and grow together through a practical study of scripture.",
                category: "Program",
            }));
        }
    }

    for (let monthOffset = 0; monthOffset < MONTHS_TO_PUBLISH; monthOffset += 1) {
        const month = addMonths(firstMonth, monthOffset);
        const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
        const daysSinceFriday = (lastDay.getUTCDay() - 5 + 7) % 7;
        const lastFriday = new Date(lastDay);
        lastFriday.setUTCDate(lastDay.getUTCDate() - daysSinceFriday);

        if (lastFriday >= today) {
            events.push(event(lastFriday, {
                slug: "power-night",
                startTime: "22:00",
                endTime: "01:00",
                title: "Power Night",
                location: "Main Auditorium",
                description: "Our monthly night of focused prayer, worship, and intercession.",
                category: "Worship",
            }));
        }
    }

    return events.sort((left, right) =>
        `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`));
};

export const calendarToday = dateKey(reginaToday());
export const churchEvents = buildPublishedEvents();

export const eventDate = (value: string) => dateFromKey(value);

export const formatEventDate = (
    value: string,
    options: Intl.DateTimeFormatOptions,
) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    ...options,
}).format(dateFromKey(value));

export const formatEventTime = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    const displayHour = hours % 12 || 12;
    const period = hours >= 12 ? "PM" : "AM";
    return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
};
