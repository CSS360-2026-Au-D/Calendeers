import { expect } from "chai";
import axios from "axios";
import { getUpcomingEvents } from "../src/services/canvasFeed.js";

describe("getUpcomingEvents tomorrowOnly", () => {
  const feedURL =
    "https://canvas.uw.edu/feeds/calendars/user_test.ics";

  const now = new Date("2026-11-26T20:00:00Z");

  const calendarICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
SUMMARY:Today event
DTSTART:20261127T075900Z
END:VEVENT
BEGIN:VEVENT
UID:2
SUMMARY:Tomorrow event
DTSTART:20261127T180000Z
END:VEVENT
BEGIN:VEVENT
UID:3
SUMMARY:All-day event
DTSTART;VALUE=DATE:20261127
DTEND;VALUE=DATE:20261128
END:VEVENT
BEGIN:VEVENT
UID:4
SUMMARY:Late tomorrow event
DTSTART:20261128T075900Z
END:VEVENT
BEGIN:VEVENT
UID:5
SUMMARY:Next day event
DTSTART:20261128T080000Z
END:VEVENT
BEGIN:VEVENT
UID:6
SUMMARY:Outside date range
DTSTART:20261201T180000Z
END:VEVENT
END:VCALENDAR`;

  let originalGet;

  beforeEach(() => {
    originalGet = axios.get;
    axios.get = async () => ({ data: calendarICS });
  });

  afterEach(() => {
    axios.get = originalGet;
  });

  it("returns only tomorrow's events", async () => {
    const result = await getUpcomingEvents(feedURL, {
      tomorrowOnly: true,
      now
    });

    const titles = result.map(event => event.title);

    expect(titles).to.have.members([
      "Tomorrow event",
      "All-day event",
      "Late tomorrow event"
    ]);
  });

  it("returns events within the selected date range", async () => {
    const result = await getUpcomingEvents(feedURL, {
      tomorrowOnly: false,
      numberOfDays: 3,
      now
    });

    expect(result.map(event => event.title)).to.have.members([
      "Today event",
      "Tomorrow event",
      "All-day event",
      "Late tomorrow event",
      "Next day event"
    ]);
  });

  it("includes all-day events scheduled for tomorrow", async () => {
    const result = await getUpcomingEvents(feedURL, {
      tomorrowOnly: true,
      now
    });

    const event = result.find(e => e.title === "All-day event");

    expect(event).to.exist;
    expect(event.allDay).to.equal(true);
  });

  it("handles Seattle timezone boundaries", async () => {
    const result = await getUpcomingEvents(feedURL, {
      tomorrowOnly: true,
      now
    });

    const titles = result.map(event => event.title);

    expect(titles).to.include("Late tomorrow event");
    expect(titles).to.not.include("Today event");
    expect(titles).to.not.include("Next day event");
  });
});