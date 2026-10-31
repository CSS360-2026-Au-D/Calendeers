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

async function fetchCalendar(feedURL) {
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

    return ical.sync.parseICS(text);
}

function isAssignmentEvent(event) {
    const title = String(event.summary || "");
    const eventURL = String(event.url || "");

    return (
        /^assignment\s*:/i.test(title) ||
        /\/(?:assignments|quizzes)\//i.test(eventURL)
    );
}

// Only link back to Canvas itself, never to an arbitrary URL from the feed.
function getCanvasURL(event) {
    try {
        const url = new URL(String(event.url || ""));
        return url.protocol === "https:" && url.hostname === "canvas.uw.edu"
            ? url.toString()
            : "";
    } catch {
        return "";
    }
}

// A Canvas .ics feed has due dates but no submission status, so an
// assignment counts as missing once its due date has passed and the user
// has not marked it done.
export function findMissingAssignments(
    calendar,
    { now = new Date(), completedIds = [], lookbackDays = 14 } = {}
) {
    if (!Number.isInteger(lookbackDays) || lookbackDays < 1) {
        throw new Error("lookbackDays must be a positive integer");
    }

    const completed = new Set(completedIds);
    const start = now.getTime() - lookbackDays * 86400000;
    const missing = [];

    for (const event of Object.values(calendar)) {
        if (event.type !== "VEVENT" || !event.start) continue;
        if (!isAssignmentEvent(event)) continue;

        const id = String(event.uid || "");
        if (!id || completed.has(id)) continue;

        const allDay = Boolean(event.start.dateOnly);
        const dueTimestamp = new Date(event.start).getTime();
        // An all-day assignment is not missing until that whole day is over.
        const deadline = allDay ? dueTimestamp + 86400000 : dueTimestamp;

        if (deadline >= now.getTime() || deadline < start) continue;

        missing.push({
            id,
            title: String(event.summary || "Untitled assignment")
                .replace(/^assignment\s*:\s*/i, ""),
            url: getCanvasURL(event),
            due: dueTimestamp,
            allDay
        });
    }

    return missing.sort((a, b) => a.due - b.due);
}

export async function getMissingAssignments(feedURL, options = {}) {
    const calendar = await fetchCalendar(feedURL);
    return findMissingAssignments(calendar, options);
}

export async function getUpcomingEvents(
    feedURL,
    { excludeAssignments = false,
         tomorrowOnly = false,
         numberOfDays = 14,
        } = {}
) {
    const calendar = await fetchCalendar(feedURL);

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

        if (excludeAssignments && isAssignmentEvent(event)) continue;

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
