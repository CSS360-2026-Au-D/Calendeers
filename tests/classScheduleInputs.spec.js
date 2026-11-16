import { expect } from "chai";
import axios from "axios";
import {
  ScheduleError,
  downloadScheduleFile,
  formatClassSchedule
} from "../src/services/classSchedule.js";

// Every rejection below happens before any network request is made.
async function rejectionOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

describe("downloadScheduleFile input checks", () => {
  // If a check ever regresses, fail fast instead of downloading from Discord.
  const realGet = axios.get;
  before(() => {
    axios.get = async () => {
      throw new Error("Network request made; an input check did not reject first");
    };
  });
  after(() => {
    axios.get = realGet;
  });

  const valid = {
    name: "schedule.ics",
    url: "https://cdn.discordapp.com/attachments/1/2/schedule.ics",
    size: 2048
  };

  it("rejects a file that is not an .ics file", async () => {
    const error = await rejectionOf(downloadScheduleFile({ ...valid, name: "schedule.pdf" }));

    expect(error).to.be.instanceOf(ScheduleError);
    expect(error.message).to.include(".ics");
  });

  it("rejects a file hosted outside Discord's CDN", async () => {
    const error = await rejectionOf(downloadScheduleFile({
      ...valid,
      url: "https://evil.example.com/schedule.ics"
    }));

    expect(error).to.be.instanceOf(ScheduleError);
    expect(error.message).to.equal("The uploaded file could not be verified.");
  });

  it("rejects a look-alike host that only starts with the CDN name", async () => {
    const error = await rejectionOf(downloadScheduleFile({
      ...valid,
      url: "https://cdn.discordapp.com.evil.example.com/schedule.ics"
    }));

    expect(error).to.be.instanceOf(ScheduleError);
  });

  it("rejects a file larger than 512 KB", async () => {
    const error = await rejectionOf(downloadScheduleFile({ ...valid, size: 512 * 1024 + 1 }));

    expect(error).to.be.instanceOf(ScheduleError);
    expect(error.message).to.include("too large");
  });

  it("rejects a malformed attachment URL", async () => {
    const error = await rejectionOf(downloadScheduleFile({ ...valid, url: "not a url" }));

    expect(error).to.be.instanceOf(Error);
  });
});

describe("formatClassSchedule", () => {
  function scheduleOf(...courses) {
    return { courses, updatedAt: 0 };
  }

  it("shows meeting times in 12-hour format, including noon and midnight", () => {
    const content = formatClassSchedule(scheduleOf(
      { name: "CSS 360", meetings: [{ days: ["MO"], start: 0, end: 90, location: "" }] },
      { name: "CSS 430", meetings: [{ days: ["TU"], start: 720, end: 810, location: "" }] }
    ));

    expect(content).to.include("12:00 AM–1:30 AM");
    expect(content).to.include("12:00 PM–1:30 PM");
  });

  it("joins meeting days and shows the location", () => {
    const content = formatClassSchedule(scheduleOf({
      name: "CSS 360",
      meetings: [{ days: ["MO", "WE"], start: 13 * 60 + 15, end: 15 * 60 + 15, location: "UW1 102" }]
    }));

    expect(content).to.include("🕒 Mon/Wed 1:15 PM–3:15 PM — 📍 UW1 102");
  });

  it("uses singular and plural class counts", () => {
    const one = { name: "A", meetings: [{ days: ["MO"], start: 600, end: 660, location: "" }] };
    const two = { ...one, name: "B" };

    expect(formatClassSchedule(scheduleOf(one))).to.include("1 class\n");
    expect(formatClassSchedule(scheduleOf(one, two))).to.include("2 classes\n");
  });

  it("removes Markdown and mention characters from course names and locations", () => {
    const content = formatClassSchedule(scheduleOf({
      name: "**CSS 360** @everyone `x`",
      meetings: [{ days: ["FR"], start: 600, end: 660, location: "<@123> | Room_1" }]
    }));

    expect(content).to.not.include("@everyone");
    expect(content).to.not.include("<@123>");
    expect(content).to.not.include("`");
    expect(content).to.include("CSS 360");
  });

  it("truncates long schedules under Discord's 2000-character limit", () => {
    const courses = Array.from({ length: 40 }, (_, i) => ({
      name: `A long course name for testing truncation ${i}`,
      meetings: [{ days: ["MO", "WE", "FR"], start: 600, end: 660, location: "Discovery Hall 464" }]
    }));
    const content = formatClassSchedule(scheduleOf(...courses));

    expect(content.length).to.be.at.most(2000);
    expect(content.endsWith("…(truncated)")).to.equal(true);
  });
});
