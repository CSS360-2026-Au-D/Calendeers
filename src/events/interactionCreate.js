
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  FileUploadBuilder
} from "discord.js";

import {
  saveCalendar,
  getCalendar,
  removeCalendar,
  saveSchedule,
  getSchedule,
  removeSchedule
} from "../services/calendarStore";

import {
  validateFeedURL,
  getUpcomingEvents
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
