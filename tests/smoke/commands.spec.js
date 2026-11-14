import { expect } from "chai";
import event from "../../src/events/interactionCreate.js";
import {
    getCompletedAssignments,
    removeCompletedAssignments
} from "../../src/services/calendarStore.js";

// Synthetic user ID used exclusively for these tests.
const TEST_USER_ID = "999999999999999999";

// Creates a mock Discord slash-command interaction.
function createCommandInteraction(commandName, options = {}) {
    let reply;
    let editedReply;
    let modal;
    let deferred = false;

    const interaction = {
        commandName,

        user: {
            id: TEST_USER_ID
        },

        options: {
            getInteger: (name) => options[name] ?? null
        },

        isChatInputCommand: () => true,
        isStringSelectMenu: () => false,
        isModalSubmit: () => false,

        reply: async (response) => {
            reply = response;
        },

        deferReply: async (response) => {
            deferred = true;
        },

        editReply: async (response) => {
            editedReply = response;
        },

        showModal: async (response) => {
            modal = response;
        },

        // Access captured responses for assertions.
        getReply: () => reply,
        getEditedReply: () => editedReply,
        getModal: () => modal,
        wasDeferred: () => deferred
    };

    return interaction;
}

describe("Calendeers Slash Command Smoke Tests", function () {

    // Clean up any test data left behind.
    after(function () {
        removeCompletedAssignments(TEST_USER_ID);
    });

    // ==========================================
    // PING
    // ==========================================

    describe("/ping", function () {

        it("should respond that Calendeers is online", async function () {

            const interaction =
                createCommandInteraction("ping");

            await event.execute(interaction);

            expect(interaction.getReply())
                .to.include("Calendeers is online");

        });

    });

    // ==========================================
    // CONNECT
    // ==========================================

    describe("/connect", function () {

        it("should display the calendar connection modal", async function () {

            const interaction =
                createCommandInteraction("connect");

            await event.execute(interaction);

            const modal = interaction.getModal();

            expect(modal).to.not.equal(undefined);

            const modalData = modal.toJSON();

            expect(modalData.custom_id)
                .to.equal("connect_calendar");

            expect(modalData.title)
                .to.equal("Connect Your Calendars");

        });

    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    describe("/disconnect", function () {

        it("should handle disconnecting an unconnected user", async function () {

            const interaction =
                createCommandInteraction("disconnect");

            await event.execute(interaction);

            expect(interaction.getReply())
                .to.have.property("content")
                .that.includes("don't have a connected calendar");

        });

        it("should respond privately", async function () {

            const interaction =
                createCommandInteraction("disconnect");

            await event.execute(interaction);

            expect(interaction.getReply().ephemeral)
                .to.equal(true);

        });

    });

    // ==========================================
    // SCHEDULE
    // ==========================================

    describe("/schedule", function () {

        it("should defer its response", async function () {

            const interaction =
                createCommandInteraction("schedule");

            await event.execute(interaction);

            expect(interaction.wasDeferred())
                .to.equal(true);

        });

        it("should request a calendar connection if none exists", async function () {

            const interaction =
                createCommandInteraction("schedule");

            await event.execute(interaction);

            expect(interaction.getEditedReply())
                .to.include("Please use `/connect` first");

        });

    });

    // ==========================================
    // CLASSES
    // ==========================================

    describe("/classes", function () {

        it("should defer its response", async function () {

            const interaction =
                createCommandInteraction("classes");

            await event.execute(interaction);

            expect(interaction.wasDeferred())
                .to.equal(true);

        });

        it("should request a schedule upload if none exists", async function () {

            const interaction =
                createCommandInteraction("classes");

            await event.execute(interaction);

            expect(interaction.getEditedReply())
                .to.include("Please use `/connect`");

        });

    });

    // ==========================================
    // UPCOMING ASSIGNMENTS
    // ==========================================

    describe("/upcoming-assignments", function () {

        it("should reject an invalid number of days", async function () {

            const interaction =
                createCommandInteraction("upcoming-assignments", {
                    "number-of-days": 0
                });

            await event.execute(interaction);

            expect(interaction.wasDeferred())
                .to.equal(true);

            expect(interaction.getEditedReply())
                .to.include("Please enter a number between 1 and 30");

        });

        it("should reject a number of days greater than 30", async function () {

            const interaction =
                createCommandInteraction("upcoming-assignments", {
                    "number-of-days": 31
                });

            await event.execute(interaction);

            expect(interaction.getEditedReply())
                .to.include("Please enter a number between 1 and 30");

        });

        it("should request a calendar connection when none exists", async function () {

            const interaction =
                createCommandInteraction("upcoming-assignments", {
                    "number-of-days": 7
                });

            await event.execute(interaction);

            expect(interaction.getEditedReply())
                .to.include("Please use `/connect` first");

        });

    });

    // ==========================================
    // MISSING ASSIGNMENTS
    // ==========================================

    describe("/missing", function () {

        it("should defer its response", async function () {

            const interaction =
                createCommandInteraction("missing");

            await event.execute(interaction);

            expect(interaction.wasDeferred())
                .to.equal(true);

        });

        it("should use the default 14-day lookback", async function () {

            const interaction =
                createCommandInteraction("missing");

            await event.execute(interaction);

            expect(interaction.getEditedReply())
                .to.include("Please use `/connect` first");

        });

        it("should accept a custom lookback period", async function () {

            const interaction =
                createCommandInteraction("missing", {
                    days: 30
                });

            await event.execute(interaction);

            expect(interaction.getEditedReply())
                .to.include("Please use `/connect` first");

        });

    });

    // ==========================================
    // MARK AS DONE SELECT MENU
    // ==========================================

    describe("Missing Assignment Select Menu", function () {

        it("should mark selected assignments as completed", async function () {

            const assignmentIds = [
                "smoke-test-assignment-1",
                "smoke-test-assignment-2"
            ];

            let updatedResponse;

            const interaction = {

                user: {
                    id: TEST_USER_ID
                },

                customId: "missing_mark_done",
                values: assignmentIds,

                isChatInputCommand: () => false,
                isStringSelectMenu: () => true,
                isModalSubmit: () => false,

                update: async (response) => {
                    updatedResponse = response;
                }

            };

            await event.execute(interaction);

            expect(updatedResponse.content)
                .to.include("Marked 2 assignments as done");

            expect(updatedResponse.components)
                .to.have.length(0);

            const completed =
                getCompletedAssignments(TEST_USER_ID);

            expect(completed).to.include(
                "smoke-test-assignment-1"
            );

            expect(completed).to.include(
                "smoke-test-assignment-2"
            );

        });

    });

    // ==========================================
    // CONNECT MODAL SUBMISSION
    // ==========================================

    describe("Connect Calendar Modal", function () {

        it("should reject a submission without an uploaded schedule", async function () {

            let editedResponse;
            let deferred = false;

            const interaction = {

                customId: "connect_calendar",

                user: {
                    id: TEST_USER_ID
                },

                isChatInputCommand: () => false,
                isStringSelectMenu: () => false,
                isModalSubmit: () => true,

                fields: {
                    getTextInputValue: () =>
                        "https://canvas.uw.edu/feeds/test.ics",

                    getUploadedFiles: () => undefined
                },

                deferReply: async () => {
                    deferred = true;
                },

                editReply: async (response) => {
                    editedResponse = response;
                }

            };

            await event.execute(interaction);

            expect(deferred).to.equal(true);

            expect(editedResponse)
                .to.include("Please upload your Register.UW .ics file");

        });

    });

});
