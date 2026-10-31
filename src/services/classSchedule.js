import axios from "axios";
import ical from "node-ical";

const TIME_ZONE = "America/Los_Angeles";
const MAX_FILE_BYTES = 512 * 1024;
const DISCORD_CDN_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];
const DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const DAY_NAMES = {
    MO: "Mon",
    TU: "Tue",
    WE: "Wed",
    TH: "Thu",
    FR: "Fri",
    SA: "Sat",
    SU: "Sun"
};

export class ScheduleError extends Error {}

export async function downloadScheduleFile(attachment) {
    const hasIcsName = /\.ics$/i.test(attachment.name || "");
    const host = new URL(attachment.url).hostname;

    if (!hasIcsName) {
        throw new ScheduleError("The Register.UW file must be an .ics file.");
    }

    if (!DISCORD_CDN_HOSTS.includes(host)) {
        throw new ScheduleError("The uploaded file could not be verified.");
    }

    if (attachment.size > MAX_FILE_BYTES) {
        throw new ScheduleError("The .ics file is too large.");
    }

    const response = await axios.get(attachment.url, {
        responseType: "text",
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: MAX_FILE_BYTES
    });

    return response.data;
}

function getMinutes(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        hourCycle: "h23",
        hour: "numeric",
        minute: "numeric"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return Number(values.hour) * 60 + Number(values.minute);
}

function getWeekday(date) {
    const name = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        weekday: "short"
    }).format(date);

    return DAY_CODES.find(code => DAY_NAMES[code] === name);
}

function getMeetingDays(event) {
    const rule = event.rrule?.origOptions;
    const ruleDays = rule?.byDay || rule?.byweekday;

    if (ruleDays) {
        const days = [].concat(ruleDays)
            .map(day => String(day).match(/(MO|TU|WE|TH|FR|SA|SU)/)?.[1])
            .filter(Boolean);

        if (days.length > 0) return [...new Set(days)];
    }

    return [getWeekday(new Date(event.start))];
}

export function parseClassSchedule(text) {
    if (typeof text !== "string" || !text.includes("BEGIN:VCALENDAR")) {
        throw new ScheduleError("That doesn't look like a valid .ics file.");
    }

    const calendar = ical.sync.parseICS(text);
    const courses = new Map();

    for (const event of Object.values(calendar)) {
        if (event.type !== "VEVENT" || !event.start || !event.end) continue;
        if (event.start.dateOnly || event.datetype === "date") continue;

        const name = String(event.summary || "").replace(/\s+/g, " ").trim();
        if (!name) continue;

        const key = name.toLowerCase();
        const course = courses.get(key) || { name, meetings: [] };

        const meeting = {
            days: getMeetingDays(event).filter(Boolean),
            start: getMinutes(new Date(event.start)),
            end: getMinutes(new Date(event.end)),
            location: String(event.location || "").replace(/\s+/g, " ").trim()
        };

        const duplicate = course.meetings.some(item =>
            item.start === meeting.start &&
            item.end === meeting.end &&
            item.location === meeting.location &&
            item.days.join() === meeting.days.join()
        );

        if (meeting.days.length > 0 && !duplicate) {
            course.meetings.push(meeting);
        }

        courses.set(key, course);
    }

    const list = [...courses.values()]
        .filter(course => course.meetings.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (list.length === 0) {
        throw new ScheduleError(
            "No class meetings were found in that .ics file."
        );
    }

    for (const course of list) {
        course.meetings.sort((a, b) =>
            DAY_CODES.indexOf(a.days[0]) - DAY_CODES.indexOf(b.days[0]) ||
            a.start - b.start
        );
    }

    return { courses: list, updatedAt: Date.now() };
}

function formatTime(minutes) {
    const hour = Math.floor(minutes / 60);
    const minute = String(minutes % 60).padStart(2, "0");
    const suffix = hour >= 12 ? "PM" : "AM";

    return `${hour % 12 || 12}:${minute} ${suffix}`;
}

function safeText(value, maxLength = 100) {
    return String(value || "")
        .replace(/[\r\n`*_~|<>@]/g, " ")
        .slice(0, maxLength);
}

export function formatClassSchedule(schedule) {
    const total = schedule.courses.length;

    const lines = schedule.courses.map(course => {
        const meetings = course.meetings.map(meeting => {
            const days = meeting.days.map(day => DAY_NAMES[day]).join("/");
            const location = meeting.location
                ? ` — 📍 ${safeText(meeting.location, 60)}`
                : "";

            return `🕒 ${days} ${formatTime(meeting.start)}–${formatTime(meeting.end)}${location}`;
        });

        return `📚 **${safeText(course.name)}**\n${meetings.join("\n")}`;
    });

    const header =
        `🦌 **Your Classes** — ${total} ${total === 1 ? "class" : "classes"}\n\n`;
    const content = header + lines.join("\n\n");

    return content.length > 1950
        ? content.slice(0, 1900) + "\n\n…(truncated)"
        : content;
}
