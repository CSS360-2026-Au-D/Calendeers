import { expect } from "chai";
import ical from "node-ical";
import { findMissingAssignments } from "../src/services/canvasFeed";
import { formatMissingAssignments } from "../src/events/interactionCreate";

const NOW = new Date("2026-10-30T20:00:00Z");

function vevent({ uid, summary, start, url = "" }) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    start,
    url ? `URL:${url}` : null,
    "END:VEVENT"
  ].filter(Boolean).join("\r\n");
}

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  vevent({
    uid: "event-assignment-1",
    summary: "Assignment: Bot Project Task #2 [CSS 360]",
    start: "DTSTART:20261028T065900Z",
    url: "https://canvas.uw.edu/courses/1/assignments/1"
  }),
  vevent({
    uid: "event-assignment-2",
    summary: "Reading Quiz",
    start: "DTSTART:20261025T065900Z",
    url: "https://canvas.uw.edu/courses/1/quizzes/2"
  }),
  vevent({
    uid: "event-assignment-3",
    summary: "Assignment: Bot Project Task #4",
    start: "DTSTART:20261106T065900Z"
  }),
  vevent({
    uid: "event-calendar-4",
    summary: "Office hours",
    start: "DTSTART:20261029T200000Z"
  }),
  vevent({
    uid: "event-assignment-5",
    summary: "Assignment: Old homework",
    start: "DTSTART:20260901T065900Z"
  }),
  vevent({
    uid: "event-assignment-6",
    summary: "Assignment: Due today all day",
    start: "DTSTART;VALUE=DATE:20261030"
  }),
  vevent({
    uid: "event-assignment-7",
    summary: "Assignment: Phishing link",
    start: "DTSTART:20261027T065900Z",
    url: "https://evil.example.com/assignments/7"
  }),
  "END:VCALENDAR"
].join("\r\n");

describe("findMissingAssignments", () => {
  const calendar = ical.sync.parseICS(FEED);

  it("returns past-due assignments within the lookback window, oldest first", () => {
    const missing = findMissingAssignments(calendar, { now: NOW });

    expect(missing.map(item => item.id)).to.deep.equal([
      "event-assignment-2",
      "event-assignment-7",
      "event-assignment-1"
    ]);
  });

  it("skips future assignments, non-assignment events, and all-day items due today", () => {
    const ids = findMissingAssignments(calendar, { now: NOW }).map(item => item.id);

    expect(ids).to.not.include("event-assignment-3");
    expect(ids).to.not.include("event-calendar-4");
    expect(ids).to.not.include("event-assignment-6");
  });

  it("skips assignments the user marked done", () => {
    const ids = findMissingAssignments(calendar, {
      now: NOW,
      completedIds: ["event-assignment-1"]
    }).map(item => item.id);

    expect(ids).to.not.include("event-assignment-1");
  });

  it("widens the window with lookbackDays", () => {
    const ids = findMissingAssignments(calendar, {
      now: NOW,
      lookbackDays: 90
    }).map(item => item.id);

    expect(ids).to.include("event-assignment-5");
  });

  it("strips the Assignment: prefix and keeps only Canvas links", () => {
    const missing = findMissingAssignments(calendar, { now: NOW });
    const byId = Object.fromEntries(missing.map(item => [item.id, item]));

    expect(byId["event-assignment-1"].title).to.equal("Bot Project Task #2 [CSS 360]");
    expect(byId["event-assignment-1"].url).to.equal("https://canvas.uw.edu/courses/1/assignments/1");
    expect(byId["event-assignment-7"].url).to.equal("");
  });

  it("rejects an invalid lookbackDays", () => {
    expect(() => findMissingAssignments(calendar, { lookbackDays: 0 })).to.throw();
  });
});

describe("formatMissingAssignments", () => {
  it("lists each assignment with how late it is", () => {
    const content = formatMissingAssignments(
      [{ id: "a", title: "Task #2", url: "", due: NOW.getTime() - 2 * 86400000, allDay: false }],
      14,
      NOW.getTime()
    );

    expect(content).to.include("1 missing assignment");
    expect(content).to.include("Task #2");
    expect(content).to.include("2 days late");
  });

  it("stays under Discord's message limit for long lists", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `a${i}`,
      title: `A fairly long assignment title number ${i}`,
      url: `https://canvas.uw.edu/courses/1/assignments/${i}`,
      due: NOW.getTime() - 86400000,
      allDay: false
    }));
    const content = formatMissingAssignments(many, 14, NOW.getTime());

    expect(content.length).to.be.at.most(2000);
    expect(content).to.match(/…and \d+ more/);
  });
});
