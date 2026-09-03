# INIT — Status

Last updated: 2026-09-03 — **owner confirmed the live flow works and closed this update.** After the full
build (Steps 1-4), owner testing in real Tampermonkey/GHL surfaced and got fixed: real workflow config +
seeded views restored (owner's actual GHL settings, not placeholders — see "Post-build live-testing
fixes" below), a settings-load bug where a stale save could never pick up new code defaults again (fixed,
then reverted at owner's request in favor of a manual paste + a "Reset to defaults" button), a mapping-
banner button CSS bug, and two real filter/sort-bar bugs (panel auto-closing on every edit; the Add-filter
popup clipped inside its own scroll container). All fixed, verified, owner confirmed working. **This
update is CLOSED** — see the renamed folder.

Current step: none — closed.

## Step 0 research summary (2026-09-03)

Three research threads, findings folded into `ROADMAP.md`:

**Predecessor codebase catalog** (`GHL-tasks-userscript`):
- Biggest win: `filterSortBar.js` + `taskViews.js`'s FIELDS/OPERATORS engine + the recursive AND/OR filter
  tree are already fully generic (no GHL coupling) and port almost verbatim. `docs/notion-views-plan.md`
  documents the predecessor's own pivot to "every view is the same kind of stored `{filter, sort}` record" —
  adopt that from the start here rather than re-deriving it.
- `shell.js`, `datePicker.js`, `timePicker.js`, `floatingPanel.js`, `indicators.js` (pure functions),
  `namespace.js`, `log.js`, `storage.js` port with little/no change.
- `titleEncoder.js` drops entirely — Notion's real structured properties replace the title-encoding hack
  1:1. `timeResolution.js`'s sentinel-clock-minute mechanism also drops (Notion's `date` property supports
  real datetimes, so no fake-encoding trick is needed) but the Todoist-style bucket-picker UX is worth
  keeping as input sugar over a real datetime.
- `apiClient.js`'s queue + burst-limiter + retry-with-backoff + **hard timeout** architecture ports as the
  design for `App.core.httpClient`. Important incident to not repeat: a timeout-less `GM_xmlhttpRequest` call
  once wedged the predecessor's entire request queue in production — the new client must have `timeout`/
  `ontimeout` from the first commit.
- `taskEditPanel.js`'s two-step unassign-then-delete drops — it only existed to work around a real GHL
  task-search-index bug; Notion has no equivalent, plain delete suffices.
- Design principles to carry forward, not just code: never update UI ahead of a confirmed server response
  except the one deliberate exception (completed-checkbox optimistic toggle with rollback); workflow-step
  auto-fill is always a suggestion, never a lock.
- **Open product question surfaced by this research** (see below): does `workflowEngine.js`'s day/call/total
  call-cadence concept generalize beyond GHL, or was it GHL-account-specific business logic that shouldn't
  carry over?

**Notion API** (developers.notion.com, current as of 2026-09-03):
- Contacts: `Name` (title), `Phone` (phone_number), `Email` (email), `CRM URLs` (rich_text, delimited) —
  rich_text beats multi_select (wrong semantics, 100-option cap) and a relation sub-database (overkill for
  single-user) for this field.
- Tasks: `Task` (title), `Contact` (relation), `Due` (date — full ISO 8601 datetime supported, confirmed),
  `Status` (native `status` property with groups, not `select` + a separate checkbox), `Notes` (rich_text).
- **Breaking change to account for**: API version 2025-09-03 split databases into "data sources" — queries
  now hit `/v1/data_sources/{id}/query`, not `/v1/databases/{id}/query`. `notionClient` must resolve and
  cache each database's `data_source_id` at settings-configure time.
- Compound `and`/`or` filters nest up to 2 levels — "contact by phone OR email OR URL" is one query, no
  client-side merge needed.
- Pagination: cursor-based, `page_size` max 100, `has_more`/`next_cursor`.
- Rate limit: ~3 req/s average per integration, some undocumented burst allowance. Source:
  developers.notion.com/reference/request-limits.
- CORS: confirmed absent for arbitrary browser origins (multiple `notion-sdk-js` GitHub issue reports) —
  `GM_xmlhttpRequest` required, matches the existing assumption in `CLAUDE.md`.

**Element-picker selector strategy**:
- Ranked multi-candidate generation per clicked element: stable attributes → ARIA role/name → nearest-
  stable-ancestor + short relative path (ROBULA+-style, expected to be the real workhorse against arbitrary
  CRM markup) → nearby label-text anchor → filtered class names → absolute path as last resort.
- Verify uniqueness against the live DOM at save-time; store the full ranked+verified list, not just the top
  candidate.
- At read-time, walk the ranked list until one resolves uniquely AND passes a per-field-type shape-sanity
  check (not just "did querySelector return something"). All candidates failing → broken, re-prompt. Top
  candidate silently degrading to a fallback → flag as "degraded," a leading indicator worth surfacing
  proactively.
- Prior art: ROBULA+ (academic robust-XPath algorithm), Playwright/Cypress locator priority ordering,
  Selenium IDE's fallback-locator strategy, UiPath's Healing Agent (validates matched-element *intent*, not
  just resolution success).

## Live Notion verification (2026-09-03)

Owner had already built both databases in their real workspace, empty of pages, before this step started —
schema was live-verified and extended, not created from scratch:

- **People** DB (page id `3cf4c170-2623-80d0-bc55-c2e2475a2741`, data_source id
  `3cf4c170-2623-8004-a40e-000bfef99d00`): pre-built with `Name` (title), `Phone` (phone_number), `Email`
  (email), `URL Contact` (url), `URL Opportunity` (url), `Tasks` (relation, dual-synced with Tasks.People).
  No schema changes needed — matches the plan closely enough (two typed URL fields instead of one delimited
  multi-URL field; see ROADMAP.md Step 1 for why that's fine to keep as-is for now).
- **Tasks** DB (page id `3cf4c170-2623-802e-b71c-f66fb4d3f720`, data_source id
  `3cf4c170-2623-806a-bb61-000bf13d51e1`): pre-built with `Task` (title), `People` (relation, dual-synced),
  `Due Date` (date), `Status` (native status, groups To-do/In Progress/Complete, options
  Planned/In progress/Completed), `Note` (rich_text). **Added via API 2026-09-03**: `Stage` (select, empty
  options), `Day` (number), `Call` (number), `Total` (number), `Modifier` (rich_text) — these carry the
  day/call/total workflow-cadence concept the owner confirmed should generalize to any CRM (see resolved
  question below), replacing `titleEncoder.js`'s title-string grammar 1:1 with real properties.
- Smoke test: created a test Contact + Task via the API (linked by relation), confirmed the 4-leaf compound
  `or` lookup (Phone/Email/URL Contact/URL Opportunity) finds the contact, confirmed
  `relation.contains: <contactId>` + sort-by-`Due Date` finds and orders the task correctly with all of
  Stage/Day/Call/Total/Note round-tripping intact, then archived (`in_trash: true`) both test pages — both
  databases are back to empty, as the owner wants them for real use.
- Confirms the 2025-09-03 API version's data-source split is real and required: `/v1/databases/{id}` calls
  succeed but `/v1/databases/{id}/query` is gone — must resolve `data_source_id` from the database GET
  response once (cacheable, doesn't change) and query `/v1/data_sources/{id}/query` instead.
- `.env` now holds the real `NOTION_API_KEY`/`NOTION_CONTACTS_DB_ID`/`NOTION_TASKS_DB_ID` for Claude's own
  dev/test scripts, per `CLAUDE.md` §4 (gitignored, not committed). The live userscript will still get its
  own copy through its Settings panel at runtime, per the same section — `.env` is dev-only.

## What got built 2026-09-03 (Steps 1-4 + partial Step 5)

Full file-by-file detail is in `ROADMAP.md`'s Steps 1-4 (now checked off) — this is the summary:

- **`src/core/`**: `namespace.js`, `log.js`, `storage.js` (verbatim GM_* wrappers), `httpClient.js`
  (queue/burst-limiter/retry/hard-timeout, Notion-tuned), `notionClient.js` (data_source_id resolution +
  caching, contact/task CRUD, compound-or lookup, `decorateTask`/`decorateContact`), `settings.js`
  (Notion credentials, timezone, workflow config, bucket-default times), `timezone.js` (Intl wall-clock,
  parameterized zone).
- **`src/mapping/`**: `selectorEngine.js` (ranked candidate generation/verification/resolution),
  `storage.js` (hostname+path-scoped mapping records), `elementPicker.js` (click-to-map capture session),
  `contactExtractor.js`, `contactMatcher.js`, `pageContext.js` (the single entry point tying it all
  together — `resolve(url)` → `no-mapping`/`broken`/`no-contact-match`/`matched`).
  `src/ui/mappingPickerOverlay.js` is the picker's visual highlight/instruction chrome.
- **`src/tasks/`**: `taskViews.js` (filter/sort/timeline engine, FIELDS table now pointing at real Notion
  properties, `status` select field replacing the predecessor's boolean checkbox), `viewsStore.js`
  (self-seeding "All tasks" default view), `workflowEngine.js` + `timeBuckets.js` (ported, day/call/total
  concept kept per owner confirmation), `taskStore.js` (new — 30s polling cache over
  `notionClient.listAllTasks()`, since Notion has no push mechanism), `contactNameCache.js`.
- **`src/ui/`**: `shell.js` (3-density floating panel), `quickAdd.js`, `taskEditPanel.js`,
  `followUpPrompt.js`, `taskComposer.js` (shared state→Notion-fields logic, `composeTitle` now write-only
  cosmetic text, never parsed back), `datePicker.js`/`timePicker.js`/`typePicker.js`/`stepPicker.js`/
  `floatingPanel.js` (all near-verbatim), `filterSortBar.js`, `indicators.js`, `fullScreen.js` (tab
  bar/Timeline/Settings, GHL Fast-Nav and Lost n Found dropped entirely), `settingsPanel.js` (rebuilt),
  `compactContactTasks.js` (rebuilt — now also owns the mapping-status banner: "Map this site" /
  "Re-map" / "Create contact", polls `location.href` same as the predecessor's 800ms pattern).
- **Build**: `src/manifest.json` + `build/lib.js` + `build/build.js` + `src/meta.js`. `npm run build`
  (or `node build/build.js`) produces a clean `dist/script.user.js`.

**Verified so far** (all via scratch Node scripts, not committed — see below):
- Pure-logic modules (timezone round-trip, workflowEngine, timeBuckets, taskViews filter/sort incl. OR
  groups) — all pass.
- The actual `httpClient.js`/`notionClient.js` code, live against the real Notion workspace (GM_xmlhttpRequest
  stubbed with Node's `https`): create/read/update/delete contact + task, compound-or lookup,
  relation-filtered task query, `decorateTask` round-trip — all pass, then cleaned up (workspace confirmed
  empty again).

## Post-build live-testing fixes (2026-09-03, owner testing in real Tampermonkey/Zen + GHL)

- **Mapping banner button CSS bug**: `.crmtm-cct-map-btn` (Map/Remap/Create) inherited `.crmtm-btn`'s
  fixed 26×26 icon-square instead of sizing to its text — fixed (`width: auto; height: auto`), and
  shortened all the banner button labels/copy to match the app's terse "Add"-style convention ("Map this
  site" → "Map", "No matching Notion contact found for X" → "X not found", etc.).
- **Real workflow config + seeded views were placeholders**: `settings.js`'s `DEFAULTS.workflow` shipped
  as `{stages:{}}` and `viewsStore.js` seeded one generic "All tasks" view — both wrong, the owner's real
  daily-driver config exists in `GHL-tasks-userscript`. Ported verbatim: the 10-stage catalog (NA/A/M/NS/
  MD/WP/SPLÁTKA/REFUND/OPP/ARCHIV) and the 6 real seeded views (First Reach-Out/Second Priority/NA/
  Archive/Recents/Completed), translating the predecessor's boolean `completed` checkbox conditions to
  this project's native 3-valued `Status` select field. Bucket default times also restored to the owner's
  real values (`02:10`/`02:11`/`02:12`/`02:13` morning/afternoon/evening/all-day — confirmed by the owner
  these are real intended times from the source project, not placeholders, despite reading that way).
- **Settings-load bug, found and then explicitly reverted**: once the Settings panel's Save button ran
  once (even with an old/wrong value showing), that value was permanently written to Tampermonkey storage
  and every future code-level default update in `DEFAULTS` was silently ignored by `load()`'s plain
  `Object.assign` merge — no rebuild could ever reach an install that had already saved. Built an
  auto-recovery special-case in `load()` for this, but the **owner explicitly asked to revert it** ("the
  logic was correct... just give me the JSON and times to paste in") — reverted to the plain merge,
  keeping only the additive `App.core.settings.DEFAULTS` export + a "Reset to defaults" button in the
  Settings panel as the deliberate, explicit way back. **Lesson for future updates**: prefer an explicit
  manual reset/paste path over a silent "smart" override, even when the override is well-intentioned —
  matches this project's broader non-optimistic, no-silent-magic design principle.
- **Filter/sort bar, two real bugs**: (1) `fullScreen.js` re-syncs the filter/sort bar to the active view
  on every render pass, including the one the bar's own `onChange` callback triggers right after a commit
  — `setView()` was unconditionally resetting `filterPanel.hidden`/`sortPanel.hidden = true` on every
  call, so editing anything (add filter, add group, toggle AND/OR) immediately closed the panel that was
  just open. Fixed: `setView()` now only resets panel state when the view actually changes. (2) The "Add
  filter"/condition-submenu popups were nested inside `.crmtm-fsb-panel`, itself `overflow-y: auto` — a
  classic "dropdown clipped by its own scrollable ancestor" CSS bug, needing a scroll to see content that
  should float on top. Fixed: `openPopover()` now portals the popover into the shadow root itself with
  `position: fixed`, positioned from the anchor's live `getBoundingClientRect()` and clamped to the
  viewport — same technique would fix the same class of bug elsewhere if it recurs (e.g. inside
  `taskEditPanel`'s scrollable panel, not reported/not touched this round).

Owner confirmed live: "good in that case we're finished close the update."

## Open questions — resolved or moot at close

- ~~Does the day/call/total call-cadence/workflow-step concept from `GHL-tasks-userscript` generalize to
  "any CRM"?~~ **Answered 2026-09-03: yes, keep it.** Live in Tasks as Stage/Day/Call/Total/Modifier.
- ~~Any existing Notion workspace/database the Contacts and Tasks databases should live under?~~ Moot —
  owner built and shared the two live databases directly.
- ~~Is a same-tab floating panel enough, or persist/restore state across tab reloads?~~ Never surfaced as
  an issue during live testing — leaving as same-tab-only unless raised in a future update.
- ~~Which 2-3 real CRM sites (besides GHL) should mapping be validated against?~~ **Answered: GHL only.**
  Revisit in a future update if more CRMs are needed — the mapping engine itself is already
  domain/path-generic, no GHL-specific code in `src/mapping/**`.
