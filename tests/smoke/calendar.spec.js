import { expect } from "chai";

import {
    validateFeedURL,
    findMissingAssignments
} from "../../src/services/canvasFeed.js";

import {
    parseClassSchedule,
    formatClassSchedule
} from "../../src/services/classSchedule.js";

import ical from "node-ical";

describe("Calendeers Calendar Smoke Tests", function () {

    describe("Canvas Calendar", function () {

        it("should accept a valid UW Canvas calendar URL", function () {
            const url =
                "https://canvas.uw.edu/feeds/calendars/user_test123.ics";

            expect(validateFeedURL(url)).to.equal(url);
        });

        it("should reject an invalid calendar URL", function () {
            expect(() =>
                validateFeedURL("https://example.com/calendar.ics")
            ).to.throw();
        });

        it("should accept webcal URLs", function () {
            const url =
                "webcal://canvas.uw.edu/feeds/calendars/user_test123.ics";

            expect(validateFeedURL(url)).to.include("https://");
        });

    });

    describe("Register.UW Schedule Parsing", function () {

        const sampleICS = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "BEGIN:VEVENT",
            "UID:test-class-1",
            "SUMMARY:CSS 360",
            "DTSTART:20261116T180000Z",
            "DTEND:20261116T190000Z",
            "LOCATION:Odegaard Library",
            "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\r\n");

        it("should parse a valid ICS schedule", function () {
            const result = parseClassSchedule(sampleICS);

            expect(result).to.have.property("courses");
            expect(result.courses).to.have.length.greaterThan(0);
        });

        it("should identify the course name", function () {
            const result = parseClassSchedule(sampleICS);

            expect(result.courses[0].name).to.equal("CSS 360");
        });

        it("should identify recurring meeting days", function () {
            const result = parseClassSchedule(sampleICS);

            const meeting = result.courses[0].meetings[0];

            expect(meeting.days).to.include("MO");
            expect(meeting.days).to.include("WE");
        });

        it("should format the schedule for Discord", function () {
            const result = parseClassSchedule(sampleICS);
            const formatted = formatClassSchedule(result);

            expect(formatted).to.include("CSS 360");
            expect(formatted).to.include("Odegaard Library");
        });

        it("should reject invalid ICS data", function () {
            expect(() =>
                parseClassSchedule("not a calendar")
            ).to.throw();
        });

    });

    describe("Assignment Parsing", function () {

        it("should identify overdue assignments", function () {

            const calendar = ical.sync.parseICS([
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "BEGIN:VEVENT",
                "UID:assignment-123",
                "SUMMARY:Assignment: Smoke Test",
                "DTSTART:20261110T120000Z",
                "URL:https://canvas.uw.edu/courses/1/assignments/123",
                "END:VEVENT",
                "END:VCALENDAR"
            ].join("\r\n"));

            const result = findMissingAssignments(calendar, {
                now: new Date("2026-11-13T20:00:00Z"),
                lookbackDays: 14
            });

            expect(result).to.have.length(1);
            expect(result[0].id).to.equal("assignment-123");
        });

    });

});
