[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=542440024)

# Javascript Discord To-Do Reminder with GitHub Codespaces

Have your personal assistant in your discord server to remind what assignments need to be complited and customize the bot based on your own work pace!

This bot is currently under development, should be released by end of 2026. Stay tune!

## Calendar commands

- `/connect` links your Canvas calendar feed URL and uploads your Register.UW class schedule `.ics`. Run it again to replace either one.
- `/classes` privately shows all classes from your saved Register.UW schedule, with meeting days, times, locations, and the number of unique classes.
- `/schedule` shows upcoming calendar events, including assignments.
- `/disconnect` removes your linked calendars and saved class schedule.
- `/upcoming-assignments` shows your upcoming assignments (events) for the amount of days specified when running the command
- `/missing [days]` privately lists Canvas assignments that are past due (in the last 14 days by default, up to 120) with a link and how late each one is. Canvas calendar feeds don't include submission status, so use the menu under the list to mark assignments you've already turned in as done and they won't show up again.

## Other commands

- `/ping` checks whether Calendeers is online.
- `!help` lists the bot's features.

## Setup

Copy `.env-sample` to `.env` and fill in:

- `TOKEN` — your Discord bot token.
- `CALENDAR_ENCRYPTION_KEY` — 64 hex characters used to encrypt saved calendar links. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Then run `npm install` and `npm start`. Run the tests with `npm test`.
