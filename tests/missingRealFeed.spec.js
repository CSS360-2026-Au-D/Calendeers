import { expect } from "chai";
import ical from "node-ical";
import { findMissingAssignments } from "../src/services/canvasFeed.js";

// Regression tests for /missing against the format a real UW Canvas feed uses.
// A real feed has no "Assignment:" title prefix, marks assignments only through
// the UID (event-assignment-<id>), and writes the URL as URL;VALUE=URI, which
// node-ical parses into an object ({ params, val }) instead of a string.

const NOW = new Date("2026-11-15T20:00:00Z");

function realFeed(...events) {
  return ical.sync.parseICS([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Instructure//Canvas//EN",
    ...events.flatMap(({ uid, summary, start, url }) => [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `SUMMARY:${summary}`,
      `DTSTART:${start}`,
      url ? `URL;VALUE=URI:${url}` : null,
      "END:VEVENT"
    ].filter(Boolean)),
    "END:VCALENDAR"
  ].join("\r\n"));
}

const ASSIGNMENT = {
  uid: "event-assignment-987654",
  summary: "Bot Project Task #5 [CSS 360 A Au 26]",
  start: "20261113T075900Z",
  url: "https://canvas.uw.edu/calendar?include_contexts=course_1234&month=11&year=2026#assignment_987654"
};

describe("findMissingAssignments with a real Canvas feed", () => {
  it("detects an assignment by its event-assignment UID even without an Assignment: prefix", () => {
    const missing = findMissingAssignments(realFeed(ASSIGNMENT), { now: NOW });

    expect(missing.map(item => item.id)).to.deep.equal(["event-assignment-987654"]);
    expect(missing[0].title).to.equal("Bot Project Task #5 [CSS 360 A Au 26]");
  });

  it("does not treat a regular calendar event as an assignment", () => {
    const missing = findMissingAssignments(realFeed({
      uid: "event-calendar-event-555",
      summary: "CSS 360 Lecture",
      start: "20261113T170000Z",
      url: "https://canvas.uw.edu/calendar?include_contexts=course_1234&month=11&year=2026#calendar_event_555"
    }), { now: NOW });

    expect(missing).to.be.empty;
  });

  it("builds a direct assignment link from the calendar URL object", () => {
    const [item] = findMissingAssignments(realFeed(ASSIGNMENT), { now: NOW });

    expect(item.url).to.equal("https://canvas.uw.edu/courses/1234/assignments/987654");
    expect(item.url).to.not.include("[object Object]");
  });

  it("never links to a non-Canvas host from a URL;VALUE=URI field", () => {
    const [item] = findMissingAssignments(realFeed({
      ...ASSIGNMENT,
      url: "https://canvas.uw.edu.example.com/calendar?include_contexts=course_1234#assignment_987654"
    }), { now: NOW });

    expect(item.url).to.equal("");
  });

  it("never links to a Canvas URL with a port or credentials", () => {
    for (const url of [
      "https://canvas.uw.edu:8443/courses/1234/assignments/987654",
      "https://user@canvas.uw.edu/courses/1234/assignments/987654"
    ]) {
      const [item] = findMissingAssignments(realFeed({ ...ASSIGNMENT, url }), { now: NOW });

      expect(item.url).to.equal("");
    }
  });

  it("keeps the calendar-page link when it cannot be turned into an assignment link", () => {
    const url = "https://canvas.uw.edu/calendar?include_contexts=course_1,course_2#assignment_987654";
    const [item] = findMissingAssignments(realFeed({ ...ASSIGNMENT, url }), { now: NOW });

    expect(item.url).to.equal(url);
  });

  it("still detects assignments by title prefix or assignment URL when the UID is generic", () => {
    const missing = findMissingAssignments(realFeed(
      { uid: "other-1", summary: "Assignment: Essay", start: "20261113T075900Z" },
      {
        uid: "other-2",
        summary: "Weekly quiz",
        start: "20261113T075900Z",
        url: "https://canvas.uw.edu/courses/1234/quizzes/42"
      },
      { uid: "other-3", summary: "Club meeting", start: "20261113T075900Z" }
    ), { now: NOW });

    expect(missing.map(item => item.id)).to.have.members(["other-1", "other-2"]);
  });
});
