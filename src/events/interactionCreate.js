
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  FileUploadBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} from "discord.js";

import {
  saveCalendar,
  getCalendar,
  removeCalendar,
  saveSchedule,
  getSchedule,
  removeSchedule,
  getCompletedAssignments,
  markAssignmentsCompleted,
  removeCompletedAssignments
} from "../services/calendarStore";

import {
  validateFeedURL,
  getUpcomingEvents,
  getMissingAssignments
} from "../services/canvasFeed";

import {
  ScheduleError,
  downloadScheduleFile,
  parseClassSchedule,
  formatClassSchedule
} from "../services/classSchedule";

function safeText(value, maxLength = 100) {
  return String(value || "")
    .replace(/[\r\n`*_~|<>]/g, " ")
    .slice(0, maxLength);
}

// Discord caps messages at 2000 characters and select menus at 25 options.
const MAX_MESSAGE_LENGTH = 1900;
const MAX_MENU_OPTIONS = 25;

export function formatMissingAssignments(assignments, lookbackDays, now = Date.now()) {
  let content =
    `⚠️ **You have ${assignments.length} missing ` +
    `${assignments.length === 1 ? "assignment" : "assignments"} ` +
    `(past ${lookbackDays} days)**\n\n`;
  const footer =
    "\n\nSubmit them on Canvas (late if allowed) or reach out to your " +
    "professor. Already turned one in? Pick it below to mark it done.";

  let shown = 0;

  for (const item of assignments) {
    const daysLate = Math.max(1, Math.floor((now - item.due) / 86400000));
    const due = item.allDay
      ? new Date(item.due).toLocaleDateString("en-US", {
          timeZone: "UTC",
          month: "short",
          day: "numeric"
        }) + " (all day)"
      : `<t:${Math.floor(item.due / 1000)}:f>`;
    const block =
      `📕 **${safeText(item.title)}**\n` +
      `🕒 Due ${due} · ${daysLate} ${daysLate === 1 ? "day" : "days"} late` +
      (item.url ? `\n🔗 <${item.url}>` : "") +
      "\n\n";

    const remaining = assignments.length - shown - 1;
    const moreNote = remaining > 0 ? `…and ${remaining} more` : "";

    if (content.length + block.length + footer.length + moreNote.length > MAX_MESSAGE_LENGTH) {
      break;
    }

    content += block;
    shown += 1;
  }

  if (shown < assignments.length) {
    content += `…and ${assignments.length - shown} more`;
  }

  return content.trimEnd() + footer;
}

function buildMarkDoneMenu(assignments) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("missing_mark_done")
    .setPlaceholder("Mark assignments as done")
    .setMinValues(1);

  const options = assignments.slice(0, MAX_MENU_OPTIONS).map(item => ({
    label: safeText(item.title) || "Untitled assignment",
    value: item.id.slice(0, 100)
  }));

  menu.addOptions(options).setMaxValues(options.length);

  return new ActionRowBuilder().addComponents(menu);
}

const event = {
  name: "interactionCreate",

  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.commandName;

      if (command === "ping") {
        await interaction.reply(
          "Heya! Calendeers is online!"
        );
        return;
      }

      if (command === "connect") {
        const urlInput = new TextInputBuilder()
          .setCustomId("calendar_url")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("https://canvas.uw.edu/feeds/...")
          .setRequired(true)
          .setMaxLength(1000);

        const fileInput = new FileUploadBuilder()
          .setCustomId("schedule_file")
          .setMinValues(1)
          .setMaxValues(1)
          .setRequired(true);

        const modal = new ModalBuilder()
          .setCustomId("connect_calendar")
          .setTitle("Connect Your Calendars")
          .addLabelComponents(
            new LabelBuilder()
              .setLabel("Canvas Calendar Feed URL")
              .setTextInputComponent(urlInput),
            new LabelBuilder()
              .setLabel("Register.UW Class Schedule (.ics)")
              .setFileUploadComponent(fileInput)
          );

        await interaction.showModal(modal);
        return;
      }

      if (command === "disconnect") {
        const removedCalendar = removeCalendar(interaction.user.id);
        const removedSchedule = removeSchedule(interaction.user.id);
        removeCompletedAssignments(interaction.user.id);
        const removed = removedCalendar || removedSchedule;

        await interaction.reply({
          content: removed
            ? "✅ Your calendars were removed."
            : "You don't have a connected calendar.",
          ephemeral: true
        });
        return;
      }

      if (command === "schedule") {
        await interaction.deferReply({ ephemeral: true });

        try {
          const url = getCalendar(interaction.user.id);

          if (!url) {
            await interaction.editReply(
              "Please use `/connect` first."
            );
            return;
          }

          const events = await getUpcomingEvents(url);

          if (events.length === 0) {
            await interaction.editReply(
              "📅 No upcoming calendar events found."
            );
            return;
          }

          const lines = events.map(item => {
            const date = item.allDay
              ? new Date(item.start).toLocaleDateString(
                  "en-US",
                  {
                    timeZone: "UTC",
                    month: "short",
                    day: "numeric"
                  }
                ) + " (all day)"
              : `<t:${Math.floor(item.start / 1000)}:f>`;

            return (
              `📚 **${safeText(item.title)}**\n` +
              `🕒 ${date}\n` +
              (item.location
                ? `📍 ${safeText(item.location, 60)}`
                : "")
            );
          });

          await interaction.editReply({
            content:
              "🦌 **Your Upcoming Canvas Events**\n\n" +
              lines.join("\n\n"),
            allowedMentions: { parse: [] }
          });

        } catch (error) {
          console.error("Failed to load schedule:", error);
          await interaction.editReply(
            "Unable to load your Canvas calendar. " +
            "Please check your feed connection."
          );
        }

        return;
      }

      if (command === "upcoming-assignments") {
        await interaction.deferReply({ ephemeral: true });

        try {
            const numberOfDays =
                interaction.options.getInteger("number-of-days");

            if (!Number.isInteger(numberOfDays) ||
                numberOfDays < 1 ||
                numberOfDays > 30) {

                await interaction.editReply(
                    "Please enter a number between 1 and 30."
                );
                return;
            }

            const url = getCalendar(interaction.user.id);

            if (!url) {
                await interaction.editReply(
                    "Please use `/connect` first."
                );
                return;
            }

            const events = await getUpcomingEvents(url, {
                numberOfDays
            });

            if (events.length === 0) {
                await interaction.editReply(
                    `📅 No upcoming assignments or events found ` +
                    `within the next ${numberOfDays} days.`
                );
                return;
            }

            const lines = events.map(item => {
                const date = item.allDay
                    ? new Date(item.start).toLocaleDateString(
                        "en-US",
                        {
                            timeZone: "UTC",
                            month: "short",
                            day: "numeric"
                        }
                    ) + " (all day)"
                    : `<t:${Math.floor(item.start / 1000)}:f>`;

                return (
                    `📚 **${safeText(item.title)}**\n` +
                    `🕒 ${date}\n` +
                    (item.location
                        ? `📍 ${safeText(item.location, 60)}`
                        : "")
                );
            });

            await interaction.editReply({
                content:
                    `🦌 **Your Upcoming Assignments ` +
                    `(Next ${numberOfDays} Days)**\n\n` +
                    lines.join("\n\n"),
                allowedMentions: { parse: [] }
            });

        } catch (error) {
            console.error("Failed to load upcoming assignments:", error);

            await interaction.editReply(
                "Unable to retrieve your upcoming assignments. " +
                "Please check your Canvas connection."
            );
        }

        return;
      }

      if (command === "missing") {
        await interaction.deferReply({ ephemeral: true });

        try {
          const lookbackDays =
            interaction.options.getInteger("days") ?? 14;
          const url = getCalendar(interaction.user.id);

          if (!url) {
            await interaction.editReply(
              "Please use `/connect` first."
            );
            return;
          }

          const missing = await getMissingAssignments(url, {
            lookbackDays,
            completedIds: getCompletedAssignments(interaction.user.id)
          });

          if (missing.length === 0) {
            await interaction.editReply(
              `🎉 No missing assignments in the past ${lookbackDays} days!`
            );
            return;
          }

          await interaction.editReply({
            content: formatMissingAssignments(missing, lookbackDays),
            components: [buildMarkDoneMenu(missing)],
            allowedMentions: { parse: [] }
          });

        } catch (error) {
          console.error("Failed to load missing assignments:", error);
          await interaction.editReply(
            "Unable to check your missing assignments. " +
            "Please check your Canvas connection."
          );
        }

        return;
      }

      if (command === "classes") {
        await interaction.deferReply({ ephemeral: true });

        try {
          const schedule = getSchedule(interaction.user.id);

          if (!schedule) {
            await interaction.editReply(
              "Please use `/connect` and upload your Register.UW " +
              "`.ics` schedule first."
            );
            return;
          }

          await interaction.editReply({
            content: formatClassSchedule(schedule),
            allowedMentions: { parse: [] }
          });

        } catch (error) {
          console.error("Failed to load classes:", error);
          await interaction.editReply(
            "Unable to load your class schedule. " +
            "Please try `/connect` again."
          );
        }

        return;
      }
    }

    // Handle "mark as done" picks from the /missing reply.
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "missing_mark_done"
    ) {
      try {
        markAssignmentsCompleted(interaction.user.id, interaction.values);

        await interaction.update({
          content:
            `✅ Marked ${interaction.values.length} ` +
            `${interaction.values.length === 1 ? "assignment" : "assignments"} ` +
            "as done. Run `/missing` again to see what's left.",
          components: []
        });
      } catch (error) {
        console.error("Failed to mark assignments done:", error);
        await interaction.reply({
          content: "Unable to save that. Please try again.",
          ephemeral: true
        });
      }
      return;
    }

    // Handle the private /connect form submission.
    if (
      interaction.isModalSubmit() &&
      interaction.customId === "connect_calendar"
    ) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const input =
          interaction.fields.getTextInputValue("calendar_url");
        const file =
          interaction.fields.getUploadedFiles("schedule_file")?.first();

        if (!file) {
          throw new ScheduleError("Please upload your Register.UW .ics file.");
        }

        const url = validateFeedURL(input);

        // Confirm that both calendars can actually be read.
        await getUpcomingEvents(url);
        const schedule = parseClassSchedule(
          await downloadScheduleFile(file)
        );

        // Associate with the Discord account automatically.
        saveCalendar(interaction.user.id, url);
        saveSchedule(interaction.user.id, schedule);

        await interaction.editReply(
          "✅ Your calendars are connected!\n" +
          `Found ${schedule.courses.length} ` +
          `${schedule.courses.length === 1 ? "class" : "classes"}. ` +
          "Use `/classes` to see your classes and `/schedule` " +
          "for upcoming Canvas events."
        );

      } catch (error) {
        console.error("Failed to connect calendar:", error);
        await interaction.editReply(
          error instanceof ScheduleError
            ? `❌ ${error.message}`
            : "❌ Could not connect your calendars. " +
              "Make sure you're using a valid UW Canvas Calendar Feed URL " +
              "and a Register.UW .ics file."
        );
      }
    }
  }
};

export default event;
