import { expect } from "chai";
import { createReminderMessage } from "../src/services/reminderJob.js";

describe("createReminderMessage", () => {
  const assignment = {
    title: "Homework 3",
    courseName: "CSS 342",
    due: Date.parse("2026-11-27T20:00:00Z"),
    allDay: false,
    daysBefore: 1,
    url: "https://canvas.uw.edu/courses/123/assignments/456"
  };

  it("shows assignment information clearly", () => {
    const message = createReminderMessage(assignment);

    expect(message).to.include("**Assignment:** Homework 3");
    expect(message).to.include("**Course:** CSS 342");
    expect(message).to.include("**Due:**");
    expect(message).to.include(assignment.url);
  });

  it("shows tomorrow for assignments due in one day", () => {
    const message = createReminderMessage(assignment);

    expect(message).to.include("**Time remaining:** Tomorrow");
  });

  it("shows the remaining days", () => {
    const message = createReminderMessage({
      ...assignment,
      daysBefore: 3
    });

    expect(message).to.include("**Time remaining:** 3 days");
  });

  it("works without a course name or link", () => {
    const message = createReminderMessage({
      ...assignment,
      courseName: undefined,
      url: undefined
    });

    expect(message).to.not.include("**Course:**");
    expect(message).to.not.include("**Assignment link:**");
    expect(message).to.include("Homework 3");
  });

  it("formats all-day deadlines correctly", () => {
    const message = createReminderMessage({
      ...assignment,
      allDay: true
    });

    expect(message).to.include("Nov 27, 2026");
  });

  it("removes unwanted mention characters", () => {
    const message = createReminderMessage({
      ...assignment,
      title: "Homework @everyone"
    });

    expect(message).to.not.include("@everyone");
  });
});