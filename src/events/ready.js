import { sendAssignmentReminders } from "../services/reminderJob";


/**
 * Schedule assignment reminders for 0:00 AM
 * using the bot machine's local timezone.
 */
function scheduleDailyReminders(client) {
  const now = new Date();
  const nextRun = new Date(now);

  // Set next run to 0:00 AM local time
  nextRun.setHours(0, 0, 0, 0);

  // If time has already passed, schedule tomorrow
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const delay = nextRun.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      await sendAssignmentReminders(client)
    } catch (error) {
      console.error(
        "Assignment reminder job failed:",
        error
      );
    } finally {
      // Schedule the next day's 8 AM check
      scheduleDailyReminders(client);
    }
  }, delay);
}

const event = {
  name: "ready",
  once: true,

  async execute(client) {
    console.log(`
    ############################################################
    #  Logged in as ${client.user.username}!
    #  Serving ${client.guilds.cache.size} servers.
    #  Serving ${client.users.cache.size} users.
    ############################################################
    `);

    for (const guild of client.guilds.cache.values()) {
      const commands = [
        {
          name: "connect",
          description: "Connect your Canvas calendar and Register.UW class schedule"
        },
        {
          name: "schedule",
          description: "View your upcoming calendar events"
        },
        {
          name: "classes",
          description: "View all your classes, meeting days, times, and locations"
        },
        {
          name: "disconnect",
          description: "Remove your linked calendars"
        },
        {
          name: "ping",
          description: "Check whether Calendeers is online"
        },
        {
          name: "upcoming-assignments",
          description: "View upcoming Canvas assignments",
          options: [
              {
                  name: "number-of-days",
                  description: "Number of days to look ahead",
                  type: 4, //Discord option type 4 represents an integer
                  required: true,
                  min_value: 1,
                  max_value: 30
              }
          ]
        },
        {
          name: "missing",
          description: "View past-due Canvas assignments you haven't marked done",
          options: [
              {
                  name: "days",
                  description: "How many days back to check (default 14)",
                  type: 4, //Discord option type 4 represents an integer
                  required: false,
                  min_value: 1,
                  max_value: 120
              }
          ]
        },

      ];

      for (const command of commands) {
        await guild.commands.create(command);
      }

      console.log(`Registered /ping in ${guild.name}`);
    }
    // Start automatic daily assignment reminders
    scheduleDailyReminders(client);
  },
};

export default event;
