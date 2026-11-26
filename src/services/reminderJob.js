
import {
  getConnectedUserIds,
  getCalendar,
  getCompletedAssignments
} from "./calendarStore";

import { getDueReminders } from "./canvasFeed";

// Prevent overlapping checks in one bot process.
let isRunning = false;

/**
 * Build the Discord reminder message.
 */
export function createReminderMessage(assignment) {
  const days = assignment.daysBefore;

  const title = assignment.title
    .replace(/[\r\n`*_~|<>@]/g, " ")
    .slice(0, 120);

  const course = (assignment.courseName || "")
    .replace(/[\r\n`*_~|<>@]/g, " ")
    .slice(0, 120);

  const dueDate = assignment.allDay
    ? new Date(assignment.due).toLocaleDateString(
        "en-US",
        {
          timeZone: "UTC",
          dateStyle: "medium"
        }
      )
    : `<t:${Math.floor(assignment.due / 1000)}:F>`;

  const timeRemaining = days === 1
    ? "Tomorrow"
    : `${days} days`;

  return (
    `🔔 **Assignment Reminder**\n\n` +
    `📚 **Assignment:** ${title}\n` +
    (course ? `🎓 **Course:** ${course}\n` : "") +
    `📅 **Due:** ${dueDate}\n` +
    `⏳ **Time remaining:** ${timeRemaining}\n` +
    (assignment.url
      ? `🔗 **Assignment link:** ${assignment.url}\n`
      : "") +
    `\nGood luck! 🦌`
  );
}

/**
 * Check all connected students and send DMs
 * for assignments due in 1 or 3 days.
 */
export async function sendAssignmentReminders(
  client,
  now = new Date()
) {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const userIds = getConnectedUserIds();
    const channelId = process.env.CHANNEL_ID;
    if (!channelId) {
      throw new Error("REMINDER_CHANNEL_ID is not configured");
    }

    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || !channel.isSendable()) {
      throw new Error("Reminder channel cannot receive messages");
    }

    for (const userId of userIds) {
      try {
        // Get the student's connected Canvas feed.
        const feedURL = getCalendar(userId);

        if (!feedURL) {
          continue;
        }

        // Get assignments the student marked done.
        const completedIds =
          getCompletedAssignments(userId);

        // Find assignments due in 1 or 3 days.
        const reminders = await getDueReminders(
          feedURL,
          { now, completedIds }
        );

        if (reminders.length === 0) {
          continue;
        }

        // Send one DM per qualifying assignment.
        for (const assignment of reminders) {
          try {
            const message =
              createReminderMessage(assignment);
              await channel.send({
                content: `<@${userId}>\n${message}`,
                allowedMentions: {
                  users: [userId]
                }
              });

          } catch (error) {
            console.error(
              `Unable to send reminder to ${userId}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error(
          `Failed to check student ${userId}:`,
          error
        );
      }
    }
  } finally {
    isRunning = false;
  }
}
