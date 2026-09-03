# INIT — Status

Last updated: 2026-09-03 (owner provided real Notion credentials + both databases, already built by hand.
Live-verified schema, added the day/call/total properties to Tasks, smoke-tested full contact-lookup +
task-create + relation-query round trip against the real workspace, then cleaned up the test pages. Data
model is confirmed live-working. No `App.core.notionClient` code written yet — that's next.)

Current step: **Step 1 — Data model (Notion)**, schema confirmed live; `App.core.notionClient` build is next.
Step 0 is done.

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

## Open questions for the owner

- ~~Does the day/call/total call-cadence/workflow-step concept from `GHL-tasks-userscript` generalize to
  "any CRM"?~~ **Answered 2026-09-03: yes, keep it.** `workflowEngine.js`/`stepPicker.js` port,
  `Stage`/`Day`/`Call`/`Total`/`Modifier` are now live Tasks properties.
- Any existing Notion workspace/database the Contacts and Tasks databases should live under, or create new
  top-level ones? — Likely moot now that the owner already built and shared the two live databases directly;
  drop this question unless something surfaces.
- Confirm: is a same-tab floating panel enough, or does the owner want it to persist/restore state across
  tab reloads on the same CRM page?
- ~~Which 2-3 real CRM sites (besides GHL) should mapping be validated against first?~~ **Answered
  2026-09-03: GHL only, for now.** Revisit once the picker exists if more sites are needed.
