import axios from "axios";
import ical from "node-ical";

export function validateFeedURL(input) {
    const cleaned = input.trim().replace(/^webcal:\/\//i, "https://");

    const url = new URL(cleaned);

    const valid = 
        url.protocol === "https:" &&
        url.hostname === "canvas.uw.edu" &&
        !url.port &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        /^\/feeds\/calendars\/user_[a-zA-Z0-9_-]+\.ics$/.test(url.pathname);

    if (!valid) {
        throw new Error("Invalid UW Canvas Calendar Feed URL");
    }

    return url.toString();
}

function getDateKey(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
}

function getTomorrowDateKey(now) {
    const [year, month, day] = getDateKey(now, "America/Los_Angeles")
        .split("-")
        .map(Number);
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));

    return tomorrow.toISOString().slice(0, 10);
}

export async function getUpcomingEvents(
    feedURL,
    { excludeAssignments = false,
         tomorrowOnly = false, 
         numberOfDays = 14,
        } = {}
) {
    const response = await axios.get(feedURL, {
        responseType: "text",
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        headers: { Accept: "text/calendar" }
    });

    const text = response.data;

    if (typeof text !== "string" || !text.includes("BEGIN:VCALENDAR")) {
        throw new Error("Invalid calendar feed");
    }

    const calendar = ical.sync.parseICS(text);

    const now = new Date();
    
    if (!Number.isInteger(numberOfDays) || numberOfDays < 1) {
        throw new Error("numberOfDays must be a positive integer");
    }
    const end = new Date(
        now.getTime() + numberOfDays * 86400000
    );

    const tomorrowDateKey = tomorrowOnly ? getTomorrowDateKey(now) : null;
    const upcoming = [];

    for (const event of Object.values(calendar)) {
        if (event.type !== "VEVENT" || !event.start) continue;

        const title = String(event.summary || "");
        const eventURL = String(event.url || "");
        const isAssignment =
            /^assignment\s*:/i.test(title) ||
            /\/(?:assignments|quizzes)\//i.test(eventURL);

        if (excludeAssignments && isAssignment) continue;

        const occurrences = event.rrule ? ical.expandRecurringEvent(event, {
            from: now,
            to: end
        }) : [event];

        for (const occurrence of occurrences) {
            const start = occurrence.start || event.start;
            const timestamp = new Date(start).getTime();

            if (timestamp < now.getTime() || timestamp > end.getTime()) continue;

            const allDay = Boolean(occurrence.isFullDay || start.dateOnly);
            if (
                tomorrowOnly &&
                getDateKey(
                    new Date(timestamp),
                    allDay ? "UTC" : "America/Los_Angeles"
                ) !== tomorrowDateKey
            ) {
                continue;
            }

            upcoming.push({
                title: occurrence.summary || event.summary || "Untitled event",
                location: occurrence.location || event.location || "",
                start: timestamp,
                allDay
            });
        }
    }

    const sorted = upcoming.sort((a, b) => a.start - b.start);
    return tomorrowOnly ? sorted : sorted;
}
