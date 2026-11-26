import { expect } from "chai";
import axios from "axios";
import {
  CanvasFeedError,
  getUpcomingEvents,
  getMissingAssignments,
  getDueReminders
} from "../src/services/canvasFeed.js";
import event from "../src/events/interactionCreate.js";

describe("Canvas error handling", () => {
  const feedURL =
    "https://canvas.uw.edu/feeds/calendars/user_test.ics";

  const emptyCalendar = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;

  let originalGet;

  beforeEach(() => {
    originalGet = axios.get;
  });

  afterEach(() => {
    axios.get = originalGet;
  });

  async function checkError(request, message) {
    try {
      await request();
    } catch (error) {
      expect(error).to.be.instanceOf(CanvasFeedError);
      expect(error.message).to.include(message);
      return;
    }

    expect.fail("Expected a CanvasFeedError");
  }

  it("handles failed Canvas requests", async () => {
    axios.get = async () => {
      throw new Error("Network error");
    };

    await checkError(
      () => getUpcomingEvents(feedURL),
      "Unable to connect to Canvas"
    );
  });

  it("handles connection timeouts", async () => {
    axios.get = async () => {
      const error = new Error("Timeout");
      error.code = "ECONNABORTED";
      throw error;
    };

    await checkError(
      () => getUpcomingEvents(feedURL),
      "Canvas connection timed out"
    );
  });

  it("handles empty responses", async () => {
    axios.get = async () => ({ data: "" });

    await checkError(
      () => getUpcomingEvents(feedURL),
      "Canvas returned an empty response"
    );
  });

  it("handles invalid calendar responses", async () => {
    axios.get = async () => ({
      data: "Invalid calendar data"
    });

    await checkError(
      () => getUpcomingEvents(feedURL),
      "Invalid calendar feed"
    );
  });

  it("accepts a valid calendar with no events", async () => {
    axios.get = async () => ({
      data: emptyCalendar
    });

    const result = await getUpcomingEvents(feedURL);

    expect(result).to.deep.equal([]);
  });

  it("continues working after a failed request", async () => {
    axios.get = async () => {
      throw new Error("Network error");
    };

    await checkError(
      () => getUpcomingEvents(feedURL),
      "Unable to connect to Canvas"
    );

    axios.get = async () => ({
      data: emptyCalendar
    });

    const result = await getUpcomingEvents(feedURL);

    expect(result).to.deep.equal([]);
  });

  it("handles errors in missing assignments and reminders", async () => {
    axios.get = async () => {
      throw new Error("Network error");
    };

    await checkError(
      () => getMissingAssignments(feedURL),
      "Unable to connect to Canvas"
    );

    await checkError(
      () => getDueReminders(feedURL),
      "Unable to connect to Canvas"
    );
  });

  it("shows an error message and still responds to ping", async () => {
    axios.get = async () => {
      throw new Error("Network error");
    };

    let reply;

    await event.execute({
      isChatInputCommand: () => false,
      isStringSelectMenu: () => false,
      isModalSubmit: () => true,
      customId: "connect_calendar",
      deferReply: async () => {},
      fields: {
        getTextInputValue: () => feedURL,
        getUploadedFiles: () => ({
          first: () => ({})
        })
      },
      editReply: async (message) => {
        reply = message;
      }
    });

    expect(reply).to.include("Unable to connect to Canvas");

    await event.execute({
      isChatInputCommand: () => true,
      commandName: "ping",
      reply: async (message) => {
        reply = message;
      }
    });

    expect(reply).to.include("Calendeers is online");
  });
});