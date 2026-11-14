# Calendeers — Code Analysis and Hardening Report

**Introduction**

Calendeers is a Discord bot designed to help students manage their academic schedules through Canvas and Register.UW integration. This report evaluates the bot's code quality, maintainability, complexity, architecture, and automated testing. The goal is to identify technical weaknesses, document existing limitations, and recommend improvements that make Calendeers more reliable and easier to maintain.

---

## 1. Technical Debt and Code Smells

**File analyzed:** `src/events/interactionCreate.js`

**Finding 1: Large Event Handler**
The `execute()` function handles multiple Discord commands, select menu interactions, and modal submissions. This makes the function harder to read, maintain, and test as new features are added.

**Recommendation:** Split command handlers into smaller functions or separate modules, each responsible for one feature.

**Finding 2: Duplicated Code**
The `/schedule` and `/upcoming-assignments` commands contain similar code for retrieving and formatting calendar events, including dates, titles, and locations. Maintaining duplicate logic can lead to inconsistent behavior.

**Recommendation:** Extract shared calendar-event formatting into a reusable helper function.

**Finding 3: Multiple Responsibilities**
The interaction handler manages Discord responses, input validation, calendar data retrieval, schedule storage, and error handling in one file. This increases maintenance effort and makes independent testing more difficult.

**Recommendation:** Keep interaction handling separate from business logic and use dedicated services or helper functions.

**File analyzed:** `src/services/canvasFeed.js`

**Finding 4: Same output out of a condition**
The logic of tomorrowOnly function in canvasFeed returns the same result regardless of the condition. " return tomorrowOnly ? sorted : sorted;" 

**Recommendation:** Double check the function's logic and repair it if problems found.

**Summary:** These are maintainability concerns rather than confirmed runtime bugs. Refactoring would improve readability, testability, and future feature development.

**File analyzed:** `src/events/interactionCreate.js`

**Finding 5: Parser can't differentiate between assignments and classes**
The /upcoming-assignments function cannot properly differentiate between assignments and upcoming classes. It only looks for upcoming events and displays all of them without sorting them properly.

**Recommendation:** Add a the ability for our bot to sort between classes and assignments when parsing calendar events.

**Summary:** These are functional issues, and would benefit the end user if fixed. They do not affect the ability for our bot to run, but will affect user experience if not fixed. An issue has been made for this problem.


## 2. Cyclomatic Complexity

**File analyzed:** `src/events/interactionCreate.js`

**Method:** I manually analyzed the `execute()` function by counting decision points, including if statements, catch clauses, logical operators, ternary expressions, nullish coalescing, and optional chaining. Branches inside nested callback functions were counted separately.

**Result:** The estimated cyclomatic complexity of `execute()` is 37 under these counting rules.

**Finding:** The function handles several Discord commands, select menu interactions, and modal submissions. The numerous conditional branches increase its complexity and make testing and maintenance more difficult.

**Recommendation:** Refactor `execute()` into smaller command handlers. This would reduce the complexity of individual functions and make unit testing easier.

**Conclusion:** The current event handler has high structural complexity and would benefit from refactoring.


## 3. Cohesion and Coupling

**File analyzed:** `src/events/interactionCreate.js`

**Method:** I examined the responsibilities of the event handler and counted its direct dependencies on service modules.

**Coupling Analysis:**
The file imports functions from three service modules:
- `calendarStore`: 9 imported functions
- `canvasFeed`: 3 imported functions
- `classSchedule`: 4 imported functions

In total, the event handler imports 16 functions from 3 internal service modules.

This creates multiple direct dependencies. Changes to service interfaces may require updates to the event handler.

**Cohesion Analysis:**
The `execute()` function handles seven slash commands, a select menu interaction, and a modal submission. These operations involve calendar management, assignment tracking, class schedules, and Discord responses.

Although these features are related to the bot, combining them into one large function reduces functional cohesion and makes independent testing more difficult.

**Recommendation:**
Separate the interaction handler into smaller command-specific modules. Keep calendar storage, Canvas integration, and class schedule processing in dedicated services.

**Conclusion:**
The current design has several direct service dependencies and mixes multiple responsibilities within one event handler. Refactoring could improve cohesion, reduce unnecessary coupling, and simplify maintenance.

**Measurement Note:** Dependency counts are based on static imports. Cohesion was assessed qualitatively rather than using a numerical cohesion metric.

## 4. Test Coverage Analysis

**Objective:** Measure and improve test coverage across the Calendeers codebase, with focus on critical calendar and schedule-processing functionality.

**Methodology:**
- **Testing Framework:** Mocha with Chai assertions for unit testing
- **Coverage Tool:** c8, which uses V8's native code coverage capabilities and generates Istanbul-compatible reports
- **Scope:** All 11 JavaScript source files under `src/`
- **Key Issue Addressed:** Resolved ES module import compatibility issues and configured c8 to collect accurate coverage data
- **Baseline:** 8 existing unit tests in `tests/missingAssignments.spec.js`
- **Improvement:** Added 27 new comprehensive unit tests targeting core service functions

**Coverage Results:**

| Metric | Before (8 Tests) | After (35 Tests) | Improvement |
|--------|------------------|------------------|-------------|
| **Statement Coverage** | 19.60% | 27.82% | +8.22 pp |
| **Branch Coverage** | 79.31% | 85.98% | +6.67 pp |
| **Function Coverage** | 11.62% | 20.93% | +9.31 pp |
| **Line Coverage** | 19.60% | 27.82% | +8.22 pp |
| **Passing Tests** | 8 | 35 | +27 tests |

**File-Level Improvements:**
- **`canvasFeed.js`:** 35.81% → 45.11% (+9.30 pp, +26% relative)
- **`classSchedule.js`:** 16.29% → 60.67% (+44.38 pp, +272% relative) — significant improvement through comprehensive schedule parsing tests
- **`calendarStore.js`:** 27.27% → 27.27% — no new tests added for this module

**Coverage Gaps & Untested Modules:**
- **Discord Event Handlers** (`guildMemberAdd.js`, `messageCreate.js`, `ready.js`): 0% coverage — could be tested using mocked Discord.js interactions
- **Bot Initialization** (`app.js`): 0% coverage — requires bot startup and configuration context
- **Helper Modules** (`index.js`, `loadEvents.js`, `loadFiles.js`): 0% coverage — require event loader and context setup

These gaps highlight opportunities for further testing. Discord event handlers and helper modules could be tested using mocks, while integration tests would help verify bot initialization and interactions between components.

**Key Findings — Test Coverage:**
- ES module import resolution was blocking coverage measurement entirely
- The original tests did not directly exercise `parseClassSchedule()`
- Statement coverage across the entire codebase improved by approximately 42% relative to baseline, while service-layer coverage increased from 27.04% to 45.90%
- Reported branch coverage reached 85.98%, although significant portions of the codebase remain untested

## 5. Unit Testing

**Objective:** Implement comprehensive unit tests for untested or undertested functionality.

**Implementation:** 27 unit tests added to `tests/validationSchedule.spec.js`

**validateFeedURL() — 12 Tests:**
- Valid Canvas calendar URLs (webcal:// and https:// protocols)
- Whitespace trimming and normalization
- Rejection of invalid hostnames and wrong domains
- Rejection of invalid protocols and non-HTTPS schemes
- Port number validation
- Credential/authentication rejection
- Query parameter validation
- URL fragment rejection
- Invalid URL path formats
- User ID validation
- Missing `.ics` extension detection
- Case-insensitive protocol handling

**parseClassSchedule() — 15 Tests:**
- Valid Register.UW `.ics` schedule file parsing
- Multi-course schedule extraction
- Course name parsing
- Recurring event meeting day extraction (RRULE BYDAY)
- Meeting time calculations with UTC-to-America/Los_Angeles timezone conversion
- Meeting location extraction
- Duplicate meeting detection and rejection
- Invalid `.ics` format rejection
- Plain text (non-calendar) rejection
- Error handling when no meetings found
- All-day event filtering (VALUE=DATE)
- Courses with no meetings handling
- Chronological ordering by day and start time
- Whitespace normalization in course names
- Invalid input type validation

**Test Results:**
- **All 35 tests passing** (61ms execution time)
- **0 failures, 0 regressions** — all original 8 tests remain passing
- No application functionality modified
- Synthetic test data used (no real Canvas tokens or personal information)

**Impact on Reliability:**
- The new tests help detect regressions in Canvas URL validation and class schedule parsing, including malformed inputs, recurring events, and edge cases
- Timezone conversion logic is now verified against expected UTC→Pacific time calculations
- Security-relevant URL validation is explicitly tested with adversarial inputs
- Automated test execution helps catch potential issues when code changes occur

**Key Findings — Unit Testing:**

Overall, the 27 new unit tests improve confidence in Calendeers' Canvas URL validation and class schedule parsing. They also help detect potential regressions involving malformed input, recurring events, and timezone conversions. However, additional tests are needed for Discord interactions, calendar storage, and external API failures.

**Testing Gaps & Future Recommendations:**
- Event handlers require Discord.js mock infrastructure (beyond current scope)
- Integration testing would verify end-to-end calendar workflows
- Fuzzing could reveal additional edge cases in calendar parsing
- Mock-based tests for `calendarStore.js` file operations would improve storage-layer coverage
- Mock-based tests for API calls in `canvasFeed.js` would reach currently uncovered network paths

## 6. Fuzzer

**Objective:** Generate random links to break the canvasFeed.js to ensure no malicious links or false links being used.

**Implementation:** Created src/fuzz/fuzz-test.js using fast-check library. Fuzzer generates 1000 random links each for valid canvas calendar, untrusted hosts, and URL query string and fragments.

**Result:** All random links are successfully filtered. Valid canvas URLs are processed, and the other links are rejected.

**Testing Gaps & Future Recommendations:**
- Fuzzer test is recommended to be implemented across this project to reduce the risk of mis-use and to prevent bugs.
- Limited URL Variations; Only 3 types of links are generated for this test. More variations can be generated to further test the filtering function.
- The fuzzer only tests validateFeedURL(). It does not test whether canvasFeed.js can safely handle corrupted, incomplete, or malicious .ics calendar data.

## 8. Smoke Testing

**Objective:** Implement automated smoke tests to verify that the core functionality of Calendeers continues to work as expected, particularly calendar processing and Discord command interactions.

**Implementation:** Created two smoke-test files under `tests/smoke/` using the existing Mocha and Chai testing frameworks.

**calendar.spec.js:**

 - Tests Canvas calendar URL validation.
 - Tests Register.UW .ics calendar parsing.
 - Verifies course and event information extraction.
 - Tests recurring class schedules.
 - Verifies calendar data formatting.
 - Tests handling of invalid calendar data.
 - Tests overdue assignment identification.

**commands.spec.js:**

 - Tests all seven Discord slash commands.
 - Verifies expected command responses.
 - Tests command input validation and error handling.
 - Tests behavior when users have not connected their calendars.
 - Tests `/connect` modal creation and submission.
 - Tests `/missing` assignment completion menu interactions.

**Testing Methodology:**

 - Mocked Discord interactions to simulate user commands without requiring a live Discord connection.
 - Synthetic Discord user IDs used to isolate test data.
 - Existing application functions tested without requiring significant modifications to the bot's implementation.
 - Tests can be executed independently using `npm run test:smoke`.

**Result:** A dedicated smoke-testing suite was established to verify the bot's primary calendar-processing and Discord interaction functionality. This provides an additional layer of automated testing beyond the existing unit tests.

**Impact on Reliability:**

 - Helps identify regressions in calendar parsing and command handling.
 - Verifies that important Discord interactions continue to function correctly.
 - Reduces the need for repetitive manual testing.
 - Provides a foundation for expanding automated testing as new features are introduced.

**Key Findings — Smoke Testing:** The smoke tests provide coverage of the bot's primary user-facing functionality without requiring a live Discord environment. Using mocked interactions also allows tests to execute independently of Discord authentication and external services.

**Testing Gaps & Future Recommendations:**

 - Additional storage and encryption tests could improve confidence in persistent user data handling.
 - Integration tests could verify complete calendar connection workflows.
 - Live Discord testing using a dedicated test bot could verify interactions with the Discord API.
 - Additional edge-case testing could improve coverage of malformed calendar data and unexpected user inputs.


## 9. Continuous Integration and Continuous Deployment

**Objective:** Implement an automated Continuous Integration (CI) pipeline to execute smoke tests whenever changes are pushed to the repository or pull requests are created. Establish a foundation for future Continuous Deployment (CD).

**Implementation:** Created `.github/workflows/ci.yml` using GitHub Actions to automate the testing process.

**Workflow Configuration:**

 - Triggers automatically when code is pushed to the main or develop branches.
 - Triggers automatically when pull requests target either branch.
 - Checks out the repository using GitHub Actions.
 - Installs the required Node.js version and project dependencies.
 - Uses npm ci to install dependencies consistently.
 - Executes the smoke-testing suite using `npm run test:smoke`.

**Node.js Compatibility Testing:**

Configured a Node.js version matrix to execute the smoke tests across multiple runtime versions:

 - Node.js 18.16.0 — Original development environment.
 - Node.js 22 — Newer LTS version.
 - Node.js 24 — Newer LTS version.
 - Node.js 26 — Current LTS version.

Separate GitHub Actions jobs are created for each Node.js version. This allows compatibility issues to be identified independently and helps determine which Node.js version should be used for future development and deployment.

**Result:** An automated CI workflow was established using GitHub Actions. Smoke tests can now be executed automatically when changes are pushed or pull requests are opened, providing developers with feedback about potential regressions.

**Impact on Development Workflow:**

 - Reduces reliance on manually executing smoke tests.
 - Provides consistent automated testing across multiple Node.js versions.
 - Helps identify compatibility issues before changes are merged.
 - Improves confidence when introducing new features or modifying existing functionality.
 - Establishes a foundation for requiring successful CI checks before merging pull requests.

**Continuous Deployment (Future Implementation):**

Continuous Deployment has not yet been implemented because Calendeers currently runs within GitHub Codespaces for development and testing rather than a permanent hosting environment.

Once a hosting provider has been selected, CD could be introduced through GitHub Actions.

Potential future functionality includes:

 - Automatically deploying changes after successful CI checks.
 - Securely managing deployment credentials using GitHub Secrets.
 - Automatically restarting the bot following deployment.
 - Verifying that the deployed bot successfully starts and connects to Discord.

**Key Findings — CI/CD:**

The implementation of GitHub Actions provides an automated and repeatable testing process that improves the reliability of the development workflow. The Node.js version matrix also provides a way to evaluate runtime compatibility before selecting a version for future deployment.

Although Continuous Deployment remains future work, the existing CI pipeline provides the foundation needed to introduce automated deployment once a permanent hosting environment is established.

**Testing Gaps & Future Recommendations:**

 - Review CI results to determine the most appropriate supported Node.js version for Calendeers.
 - Configure GitHub branch protection to require successful CI checks before merging pull requests.
 - Introduce Continuous Deployment once a permanent hosting environment is available.
 - Add automated deployment health checks to verify successful bot restarts and Discord connections.
---

