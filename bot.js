
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const cron = require("node-cron");
const ical = require("node-ical");

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  MessageFlags,
  escapeMarkdown
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const FEED_URL = process.env.CANVAS_FEED_URL;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID;

const MODE = process.env.SCHEDULE_MODE || "test";
const TIMEZONE =
  process.env.TIMEZONE || "America/Los_Angeles";

if (!TOKEN || !FEED_URL || !CHANNEL_ID || !GUILD_ID) {
  throw new Error("Missing required .env variables");
}

if (!["test", "daily"].includes(MODE)) {
  throw new Error("SCHEDULE_MODE must be test or daily");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Store reminders so they are not sent twice.
const HISTORY_FILE = path.join(
  __dirname,
  "sent-reminders.json"
);

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return {};
  }

  return JSON.parse(
    fs.readFileSync(HISTORY_FILE, "utf8")
  );
}

const history = loadHistory();

function saveHistory() {
  const temporary = HISTORY_FILE + ".tmp";

  fs.writeFileSync(
    temporary,
    JSON.stringify(history, null, 2)
  );

  fs.renameSync(temporary, HISTORY_FILE);
}

// Read assignment events from Canvas.
async function getEvents() {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    30000
  );

  try {
    const calendar = await ical.async.fromURL(
      FEED_URL,
      { signal: controller.signal }
    );

    return Object.values(calendar)
      .filter(event =>
        event.type === "VEVENT" && event.start
      )
      .map(event => ({
        id: String(event.uid || event.summary),
        name: String(event.summary || "Untitled"),
        date: new Date(event.start)
      }))
      .filter(event =>
        !Number.isNaN(event.date.getTime())
      );

  } finally {
    clearTimeout(timeout);
  }
}

// Get local calendar date in chosen timezone.
function localDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }
  }

  return result;
}

function dayNumber(date) {
  const { year, month, day } = localDateParts(date);

  return Math.floor(
    Date.UTC(year, month - 1, day) / 86400000
  );
}

// Number of calendar days until due date.
function daysUntilDue(date) {
  return dayNumber(date) - dayNumber(new Date());
}

function formatEvent(event) {
  const name = escapeMarkdown(
    event.name.slice(0, 300)
  ).replace(/@/g, "@\u200b");

  const timestamp = Math.floor(
    event.date.getTime() / 1000
  );

  return (
    `📚 **${name}**\n` +
    `📅 Due: <t:${timestamp}:F>`
  );
}

function formatList(events, heading) {
  let message = `**${heading}**\n\n`;

  if (!events.length) {
    return message + "No calendar items found.";
  }

  for (const event of events.slice(0, 15)) {
    const entry = formatEvent(event) + "\n\n";

    if (message.length + entry.length > 1900) {
      message += "More items not shown.";
      break;
    }

    message += entry;
  }

  return message;
}

// Send 3-day and 1-day reminders.
async function checkReminders() {
  if (!client.isReady()) return;

  console.log("🔎 Checking Canvas reminders...");

  try {
    const channel = await client.channels.fetch(
      CHANNEL_ID
    );

    if (!channel || !channel.isSendable()) {
      throw new Error("Cannot send to selected channel");
    }

    const events = await getEvents();
    let sent = 0;

    for (const event of events) {
      const days = daysUntilDue(event.date);

      // Remind only at 3 and 1 calendar days.
      if (days !== 3 && days !== 1) {
        continue;
      }

      // Unique assignment + due date + reminder.
      const key = [
        event.id,
        event.date.toISOString(),
        days
      ].join("|");

      if (history[key]) {
        continue;
      }

      const heading = days === 3
        ? "🔔 3-Day Assignment Reminder"
        : "🚨 1-Day Assignment Reminder";

      const message =
        `**${heading}**\n\n` +
        formatEvent(event) + "\n\n" +
        `⏳ Due in ${days} ${days === 1 ? "day" : "days"}!\n` +
        "Please check Canvas to confirm your submission.";

      await channel.send({
        content: message,
        allowedMentions: { parse: [] }
      });

      // Record only after Discord accepts the send.
      history[key] = new Date().toISOString();
      saveHistory();
      sent++;
    }

    console.log(
      `✅ Reminder check complete. Sent ${sent} reminders.`
    );

  } catch (error) {
    console.error("❌ Reminder error:", error);
  }
}

// Keep the existing slash commands.
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether Calendeers is online"),

  new SlashCommandBuilder()
    .setName("assignments")
    .setDescription("Show the next 7 days of Canvas items"),

  new SlashCommandBuilder()
    .setName("overdue")
    .setDescription("Show past calendar items")
];

client.once("clientReady", async () => {
  console.log(`✅ Online as ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const registered = await guild.commands.set(commands);

    console.log(
      "✅ Commands registered:",
      [...registered.values()].map(cmd => cmd.name)
    );
  } catch (error) {
    console.error("Command registration failed:", error);
  }

  const expression = MODE === "test"
    ? "* * * * *"
    : "0 8 * * *";

  cron.schedule(
    expression,
    checkReminders,
    {
      timezone: TIMEZONE,
      noOverlap: true
    }
  );

  console.log(
    `⏰ Reminder schedule: ${MODE}, ${TIMEZONE}`
  );
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({
      content: "🏓 Pong! Calendeers is online!",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!["assignments", "overdue"]
    .includes(interaction.commandName)) return;

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  try {
    const events = await getEvents();
    const now = new Date();
    const week = new Date(
      now.getTime() + 7 * 86400000
    );

    let filtered;
    let heading;

    if (interaction.commandName === "assignments") {
      filtered = events
        .filter(e => e.date >= now && e.date <= week)
        .sort((a, b) => a.date - b.date);

      heading = "📅 Upcoming Canvas Items";
    } else {
      const monthAgo = new Date(
        now.getTime() - 30 * 86400000
      );

      filtered = events
        .filter(e => e.date >= monthAgo && e.date < now)
        .sort((a, b) => b.date - a.date);

      heading = "⚠️ Past Calendar Items (Not Verified Missing)";
    }

    await interaction.editReply({
      content: formatList(filtered, heading),
      allowedMentions: { parse: [] }
    });

  } catch (error) {
    console.error("Canvas error:", error);

    await interaction.editReply(
      "❌ Could not retrieve the Canvas calendar."
    );
  }
});

client.login(TOKEN).catch(error => {
  console.error("Discord login failed:", error);
});
