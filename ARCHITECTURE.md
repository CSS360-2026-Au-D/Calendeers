# Calendeers Architecture Documentation

## Data Flow Diagram: 

The data flow diagram shows how Calendeers transfers calendar and class-schedule information between the student, Discord, its internal services, and local storage. A student sends commands through Discord, which passes the interaction and Discord user ID to the command handler (`src/events/interactionCreate.js`). The handler coordinates the services responsible for fetching calendar events, importing class schedules as well as accessing saved data.

<img src="docs/diagrams/CalendeersDataFlow.png" alt="Calendeers Data Flow Diagram" width="600" />

The diagram identifies three main data-processing paths:

1. **Canvas calendar:** The Canvas Feed Service (`src/services/canvasFeed.js`) uses the student's calendar feed URL to retrieve iCalendar (`.ics`) events from UW Canvas over HTTPS. It passes parsed calendar information back to the command handler.
2. **Register.UW class schedule:** The Class Schedule Service (`src/services/classSchedule.js`) processes an `.ics` schedule file uploaded by the student through Discord. The file is retrieved from Discord's content delivery network (CDN), parsed and then returned as class data. The bot does not request the schedule directly from Register.UW.
3. **Local calendar storage:** The Calendar Store (`src/services/calendarStore.js`) associates saved calendar information with the student's Discord user ID. It encrypts and saves the Canvas feed URL in `calendar-links.json` and class-schedule data in `class-schedules.json`, and retrieves or deletes this information when the appropriate command is called.

In this diagram, **rectangles** indicate outside actors or systems, **circles** indicate processing components inside Calendeers, and **cylinders** indicate local files used to store data. The arrows show information exchanged between these elements, including command responses to the student.

## Activity Diagram: 

The activity diagram illustrates the `/connect` workflow when a student supplies both a UW Canvas calendar feed URL and a Register.UW `.ics` schedule file. It emphasizes the order of actions, validation decisions, successful storage, and error handling.

![Calendeers Activity Diagram](docs/diagrams/CalendeersActivity.png)

The workflow is as follows:

1. **Start:** The student runs `/connect`, enters a Canvas calendar feed URL, and uploads a Register.UW `.ics` file.
2. **Validate the inputs:** Calendeers checks that a file was uploaded and that the Canvas URL is valid. If either check fails, the workflow follows the private-error path.
3. **Retrieve Canvas data:** The bot attempts to access and parse the Canvas calendar feed. An inaccessible or invalid feed leads to a private error.
4. **Import the class schedule:** The bot downloads the uploaded `.ics` file and parses its course information. If the schedule cannot be validated, the workflow ends with a private error.
5. **Save the connection:** If all checks succeed, Calendeers encrypts the feed URL and parsed class data and stores them under the student's Discord user ID.
6. **Confirm:** The bot sends the student a private success message and the activity ends.

The **green shapes** mark the beginning and end, **yellow rectangles** represent actions, **blue diamonds** show decisions, and the **orange rectangle** represents the error outcome. This diagram documents the path with both inputs; it does not attempt to model other possible forms of `/connect` invocation.

**Related implementation:** `src/events/interactionCreate.js`, `src/services/canvasFeed.js`, `src/services/classSchedule.js`, and `src/services/calendarStore.js`.

## Use Case Diagram: 

<img width="1704" height="756" alt="image" src="https://github.com/user-attachments/assets/0d1ffcac-cdaa-4fef-bac2-9b7fd1f1d550" />


## System Context Diagram: 


The system context diagram shows how Calendeers interacts with students and external systems. Calendeers is a Discord bot that helps UW students organize their Canvas assignments and Register.UW class schedules.

```mermaid
flowchart TD
    Student["UW Student"]
    Register["Register.UW"]
    Discord["Discord Platform"]
    Bot["Calendeers Bot"]
    Canvas["UW Canvas Calendar Feed"]
    CDN["Discord CDN"]

    Register -->|"Exports class schedule (.ics)"| Student
    Student <-->|"Commands and responses"| Discord
    Discord <-->|"Interactions and bot replies"| Bot
    Discord -->|"Hosts uploaded attachments"| CDN
    Bot -->|"Requests calendar feed via HTTPS"| Canvas
    Canvas -->|"Returns calendar events"| Bot
    Bot -->|"Downloads uploaded .ics file"| CDN
    CDN -->|"Returns schedule file"| Bot

    style Bot fill:#fff2b3,stroke:#b8860b,stroke-width:3px,color:#222
```

### External Systems and Interactions

1. **UW Student:** Students interact with Calendeers through Discord commands such as `/connect`, `/classes`, `/schedule`, and `/missing` to manage class schedules and assignments.

2. **Discord Platform:** Discord acts as the communication interface between students and the bot. It delivers commands and interactions to Calendeers and displays the bot's responses.

3. **UW Canvas Calendar Feed:** Calendeers retrieves calendar events and assignment information through a student's Canvas iCalendar feed URL using HTTPS.

4. **Register.UW:** Students export their class schedules as `.ics` files from Register.UW and upload them through Discord. Calendeers does not directly connect to Register.UW.

5. **Discord CDN:** Discord hosts uploaded schedule attachments. Calendeers downloads these files to process class schedule information.

### System Boundary

Calendeers is the central system in this diagram. It processes Discord interactions, retrieves calendar information, parses uploaded schedules, and manages locally saved user data. Its local JSON storage is considered an internal component rather than a separate external system.

This diagram focuses on the system's external relationships rather than its internal implementation.


## Network Diagram: 

Add description and diagram here

## Control-Flow Diagram: 

A control-flow graph (CFG) shows the paths execution can take through a piece of code. Each node is a **basic block**, a run of statements that always execute together, and each edge is a possible jump from one block to the next. The four graphs below zoom in step by step:
- **Graph 1:** the handler that receives every slash command, select-menu pick, and modal submission.
- **Graphs 2a and 2b:** one feature, `/missing`.
- **Graph 3:** the loop that decides whether an assignment is missing.

How to read the graphs:
- **Rounded boxes** are the graph's `ENTRY` and `EXIT` nodes.
- **Rectangles** are basic blocks.
- **Diamonds** are blocks that end in a branch. Their outgoing edges are labeled with the branch outcome.
- **Dashed edges** are exceptional control flow: a thrown error jumping to a `catch` block or out of the function.
- Each node's label starts with an ID (such as `D3`) that the text below refers to.

Three simplifications keep the graphs readable:
- **Graph 1 is condensed.** Each command handler is collapsed into one node, and graphs 2a and 2b expand two of them to the basic-block level.
- **Compound conditions are one decision.** A condition joined by `&&` or `||` is drawn as a single diamond. Its parts have no side effects, so the outcomes are the same as drawing each part separately.
- **Conditions are phrased positively.** For example, "url found?" stands for code that tests `!url` and returns early.

### 1. Interaction dispatch: `execute()` in `src/events/interactionCreate.js`

When the bot starts, `src/helpers/loadEvents.js` registers each file in the `events` folder as a Discord event listener. Slash commands, select-menu picks, and modal submissions all arrive as one event, `interactionCreate`, so this `execute()` function is their single entry point. Plain chat messages, such as `!help`, are a separate event handled by `messageCreate.js`.

```mermaid
flowchart LR
    ENTRY(["ENTRY: execute(interaction)"]) --> D1{"D1: slash command?"}
    D1 -->|true| D2{"D2: command name"}
    D1 -->|false| D3{"D3: mark-done menu pick?"}
    D2 --> H1["H1: ping<br/>reply online"]
    D2 --> H2["H2: connect<br/>show connect form"]
    D2 --> H3["H3: disconnect<br/>delete saved data, reply"]
    D2 --> H4["H4: schedule<br/>fetch upcoming events, reply"]
    D2 --> H5["H5: upcoming-assignments<br/>fetch next N days, reply"]
    D2 --> H6["H6: missing<br/>see graph 2a"]
    D2 --> H7["H7: classes<br/>read saved classes, reply"]
    D2 -->|no match| D3
    D3 -->|true| H8["H8: mark done<br/>see graph 2b"]
    D3 -->|false| D4{"D4: connect form submitted?"}
    D4 -->|true| H9["H9: validate, fetch, save, reply<br/>(Activity Diagram)"]
    D4 -->|false| EXIT(["EXIT"])
    H1 & H2 & H3 & H4 & H5 & H6 & H7 & H8 & H9 --> EXIT
```

The full conditions are:
- **`D3`:** `interaction.isStringSelectMenu() && interaction.customId === "missing_mark_done"`
- **`D4`:** `interaction.isModalSubmit() && interaction.customId === "connect_calendar"`

In the code, the seven `if (command === "...")` tests run one after another, and `D2` draws them as one multi-way branch. Each command handler ends in `return`, so at most one handler runs for any interaction. An interaction that matches nothing reaches `EXIT` without a reply.

Some features take two separate interactions, such as `/connect` followed by its form, or `/missing` followed by its menu. The first response (a form or a menu) carries a `customId`. When the follow-up interaction arrives, `D3` or `D4` uses that `customId` to route it back to the right code.

Some calls run outside any `try` block, so their errors are not drawn in graph 1:
- `/ping` and `/connect` have no `try` at all.
- `/disconnect` has no `try` either; it reads and rewrites the saved-data files directly.
- Every handler that calls `deferReply()` does so before its `try`.

An error thrown by any of these calls leaves `execute()` as an unhandled promise rejection. The bot has no handler for unhandled rejections, and on Node 18 (the version in the `Dockerfile`) one stops the process. Graph 2a draws this path as `XEXIT`.

**Adding a new slash command:**
1. Add its name, description, and options to the `commands` array in `src/events/ready.js`. This array is registered with every server the bot is in when it starts.
2. Add an `if (command === "...")` handler to `execute()` that replies and then `return`s.
3. Put Canvas, schedule, or storage logic in `src/services/`, where it can be tested without Discord.

If the handler makes a network request, it should call `deferReply()` first, because Discord expects a response to an interaction within 3 seconds.

### 2. The `/missing` command and its "mark as done" menu

**2a. `/missing` handler** (`H6` in graph 1):

```mermaid
flowchart TD
    ENTRY(["ENTRY: command is 'missing'"]) --> S1["S1: await deferReply (ephemeral)"]
    S1 --> T0
    subgraph TRY ["try"]
        T0{"T0: days option given?"} -->|true| T1a["T1a: lookbackDays = days"]
        T0 -->|false| T1b["T1b: lookbackDays = 14"]
        T1a & T1b --> T2["T2: url = getCalendar(userId)<br/>(reads calendar-links.json)"]
        T2 --> T3{"T3: url found?"}
        T3 -->|false| R1["R1: editReply: use /connect first"]
        T3 -->|true| T4["T4: completedIds = getCompletedAssignments(userId)<br/>missing = await getMissingAssignments(...)<br/>(graph 3)"]
        T4 --> T5{"T5: missing is empty?"}
        T5 -->|true| R2["R2: editReply: none missing"]
        T5 -->|false| R3["R3: editReply: list + mark-done menu"]
    end
    R3 ~~~ CATCH
    TRY -.->|throw| CATCH["CATCH: log error,<br/>editReply: unable to check"]
    R1 & R2 & R3 & CATCH --> EXIT(["EXIT"])
    S1 -.->|throw| XEXIT(["XEXIT: unhandled rejection"])
    CATCH -.->|throw| XEXIT
```

**2b. Mark-done handler** (`H8` in graph 1). It runs later, as a new interaction, when the student picks items from the menu that `R3` sent:

```mermaid
flowchart TD
    ENTRY(["ENTRY: mark-done menu pick"]) --> M1
    subgraph TRY ["try"]
        M1["M1: markAssignmentsCompleted(userId, picks)<br/>(writes completed-assignments.json)"] --> M2["M2: update message: marked N done,<br/>remove the menu"]
    end
    TRY -.->|throw| CATCH["CATCH: log error,<br/>reply: unable to save"]
    M2 & CATCH --> EXIT(["EXIT"])
    CATCH -.->|throw| XEXIT(["XEXIT: unhandled rejection"])
```

How graph 2a behaves:
- **Private replies.** `S1` makes the reply ephemeral, so `R1`, `R2`, `R3`, and `CATCH` are seen only by the student who ran the command.
- **One error path.** Everything after `S1` sits inside one `try`, including the replies themselves. So any error there ends at `CATCH` with one generic message, and the details go to the console log. Possible errors include:
  - a timed-out request
  - a response that is not a calendar
  - an unreadable data file
  - a missing encryption key
- **Message limits.** `R3` trims the list to fit Discord's 2000-character message limit and the menu to Discord's 25-option limit.

There is no edge from `R3` to graph 2b. The menu reply ends the first interaction, and the student's pick arrives later as a new `interactionCreate` event, which `D3` in graph 1 routes to `H8`.

### 3. Deciding what is missing: `findMissingAssignments()` in `src/services/canvasFeed.js`

A Canvas `.ics` feed lists due dates but not whether anything was submitted, so the bot cannot ask Canvas what is missing. Instead, an assignment counts as missing when all three are true:
- it was due within the look-back window,
- its deadline has passed, and
- the student has not marked it done.

`getMissingAssignments()` downloads and parses the feed, and throws if the response is not an iCalendar file. It then calls this function, which checks those rules against each calendar entry:

```mermaid
flowchart TD
    ENTRY(["ENTRY: findMissingAssignments(calendar, options)"]) --> F0{"F0: lookbackDays valid?"}
    F0 -->|false| F1["F1: throw Error"]
    F0 -->|true| F2["F2: completed = Set(completedIds)<br/>start = now − lookbackDays days<br/>missing = [ ]"]
    F2 --> L{"L: another entry?"}
    L -->|false| F10["F10: sort missing by due date"]
    L -->|true| F3{"F3: VEVENT with a start?"}
    F3 -->|"false (continue)"| L
    F3 -->|true| F4{"F4: isAssignmentEvent?"}
    F4 -->|"false (continue)"| L
    F4 -->|true| F5{"F5: has id, not marked done?"}
    F5 -->|"false (continue)"| L
    F5 -->|true| F6{"F6: all-day?"}
    F6 -->|true| F7a["F7a: deadline = due + 1 day"]
    F6 -->|false| F7b["F7b: deadline = due"]
    F7a & F7b --> F8{"F8: start ≤ deadline < now?"}
    F8 -->|"false (continue)"| L
    F8 -->|true| F9["F9: missing.push(...)"]
    F9 --> L
    F10 -->|return missing| EXIT(["EXIT"])
    F1 -.->|throw| XEXIT(["XEXIT: throw"])
```

Each `continue` in the code is a back edge to the loop test `L`, so an entry that fails any check is skipped. The function has one normal exit (`EXIT`) and one exceptional exit (`XEXIT`).

Four rules sit behind these branches:
- **`F4`, which entries are assignments:** an entry counts as an assignment if its title starts with `Assignment:` or its URL contains `/assignments/` or `/quizzes/`. This filters out lectures and other events.
- **`F6`/`F7a`, all-day entries:** an all-day assignment gets one extra day, so it counts as missing only after its due date has fully passed.
- **`F8`, the look-back window:** this skips assignments that are not yet due, and those older than the window.
- **`F9`, links:** the assignment's link is kept only if it points to `https://canvas.uw.edu`, so the bot never posts an arbitrary link from the feed.

This function makes no network calls and touches no files. `tests/missingAssignments.spec.js` can therefore test it with a small hand-written `.ics` feed and a fixed `now`.

**Related implementation:** `src/events/interactionCreate.js`, `src/events/ready.js`, `src/helpers/loadEvents.js`, `src/services/canvasFeed.js`, `src/services/calendarStore.js`, and `tests/missingAssignments.spec.js`.

## Class Diagram: 

The Calendeers discord bot is not an object orientsd program with classes, rather it is a bot that utilizes many interconnected modules to handle dependencies and running. THis is important to understand, and in the 'Class Diagram' we have decided to instead draw out the connections between all of these modules to give a map of the connections between pieces of the bot code. Many of these modules are based off of the template discord bot that we based Calendeers off of with some added data structures made to add the functionality we desired.

### Important Architectural Design Highlights

A few architectural decisions are worth documenting because they demonstrate an understanding of the application's actual implementation.

#### No Traditional Database

Calendeers uses JSON files for persistent storage rather than a traditional relational database.

The application maintains the following data:

- **Calendar links**
- **Class schedules**
- **Completed assignments**

This approach provides a lightweight persistence solution without requiring a separate database system.

#### Event-Driven Architecture

The bot uses Discord.js events to respond to user activity.

Event handlers are dynamically loaded, making the architecture modular and allowing new event handlers to be added relatively easily without significantly changing the existing application structure.

#### Separation of Responsibilities

The application's services are separated according to their specific responsibilities:

- **CalendarStore:** Handles data persistence and encryption.
- **CanvasFeed:** Processes Canvas calendar data.
- **ClassSchedule:** Handles Register.UW schedule processing.

This separation keeps individual services focused on specific tasks and makes the codebase easier to maintain.

#### Centralized Interaction Handling

`interactionCreate.js` serves as the main controller for handling Discord interactions, including:

- Slash commands
- Modal submissions
- Select menu interactions

Centralizing interaction handling provides a consistent entry point for processing user interactions and coordinating the application's underlying services.

### Context For Diagram: 

| Relationship | Explanation |
|---|---|
| App → DiscordClient | The application creates and configures the Discord client. |
| App → Helpers | The application imports `loadEvents` through the helpers index. |
| LoadEvents → LoadFiles | The event loader uses the file loader to discover event modules. |
| LoadEvents → Event Handlers | The event loader dynamically imports and registers event handlers. |
| InteractionCreate → CalendarStore | The interaction handler reads, saves, and deletes user calendar data. |
| InteractionCreate → CanvasFeed | The interaction handler retrieves upcoming events and missing assignments. |
| InteractionCreate → ClassSchedule | The interaction handler downloads, parses, and formats class schedules. |
| Course → Meeting | A course contains one or more meeting records. |
| ClassSchedule → ScheduleError | The schedule service throws this custom error when schedule processing fails. |

### 'Class' Diagram

```mermaid
classDiagram
    direction TB

    %% APPLICATION

    class App {
        <<module>>
    }

    class DiscordClient {
        <<external discord.js>>
        +login(token)
        +on(event, handler)
        +once(event, handler)
    }

    class Collection {
        <<external discord.js>>
        +set(key, value)
        +get(key)
        +clear()
    }

    %% HELPERS

    class Helpers {
        <<module>>
    }

    class LoadEvents {
        <<module>>
        +loadEvents(client, dirName)$
    }

    class LoadFiles {
        <<module>>
        +loadFiles(dirName, ext)$
    }

    %% EVENT HANDLERS

    class MessageCreate {
        <<event handler>>
        +String name
        +execute(message, client)
    }

    class GuildMemberAdd {
        <<event handler>>
        +String name
        +execute(member, client)
        +getWelcomeMessage(userId)
    }

    class Ready {
        <<event handler>>
        +String name
        +Boolean once
        +execute(client)
    }

    class InteractionCreate {
        <<event handler>>
        +String name
        +execute(interaction, client)
        +formatMissingAssignments(assignments, days, now)$
        +buildMarkDoneMenu(assignments)$
    }

    %% SERVICES

    class CalendarStore {
        <<module>>
        +saveCalendar(userId, url)$
        +getCalendar(userId)$
        +removeCalendar(userId)$
        +saveSchedule(userId, schedule)$
        +getSchedule(userId)$
        +removeSchedule(userId)$
        +getCompletedAssignments(userId)$
        +markAssignmentsCompleted(userId, ids)$
        +removeCompletedAssignments(userId)$
    }

    class CanvasFeed {
        <<module>>
        +validateFeedURL(input)$
        +getUpcomingEvents(url, options)$
        +findMissingAssignments(calendar, options)$
        +getMissingAssignments(url, options)$
    }

    class ClassSchedule {
        <<module>>
        +downloadScheduleFile(attachment)$
        +parseClassSchedule(text)$
        +formatClassSchedule(schedule)$
    }

    class ScheduleError {
        +ScheduleError()
    }

    %% DOMAIN DATA STRUCTURES

    class Course {
        <<data structure>>
        +String name
        +Meeting[] meetings
    }

    class Meeting {
        <<data structure>>
        +String[] days
        +Number start
        +Number end
        +String location
    }

    class CalendarEvent {
        <<data structure>>
        +String title
        +String location
        +Number start
        +Boolean allDay
    }

    class MissingAssignment {
        <<data structure>>
        +String id
        +String title
        +String url
        +Number due
        +Boolean allDay
    }

    %% APPLICATION RELATIONSHIPS

    App --> DiscordClient : creates
    App --> Collection : creates
    App ..> Helpers : imports loadEvents

    Helpers ..> LoadEvents : re-exports
    Helpers ..> LoadFiles : re-exports

    LoadEvents ..> LoadFiles : uses
    LoadEvents ..> DiscordClient : registers handlers
    LoadEvents ..> Collection : stores handlers

    LoadEvents ..> MessageCreate : loads
    LoadEvents ..> GuildMemberAdd : loads
    LoadEvents ..> Ready : loads
    LoadEvents ..> InteractionCreate : loads

    %% SERVICE RELATIONSHIPS

    InteractionCreate ..> CalendarStore : uses
    InteractionCreate ..> CanvasFeed : uses
    InteractionCreate ..> ClassSchedule : uses

    ClassSchedule ..> ScheduleError : throws
    ClassSchedule ..> Course : creates
    Course "1" *-- "0..*" Meeting : contains

    CanvasFeed ..> CalendarEvent : produces
    CanvasFeed ..> MissingAssignment : produces
```