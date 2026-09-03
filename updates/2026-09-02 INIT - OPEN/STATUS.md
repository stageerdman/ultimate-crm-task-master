# INIT — Status

Last updated: 2026-09-03 (Step 0 research complete; `ROADMAP.md` Steps 1+ rewritten from findings. No product
code written yet — still pre-Step-1.)

Current step: **Step 1 — Data model (Notion)**, next up. Step 0 is done.

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

## Open questions for the owner

- **New**: Does the day/call/total call-cadence/workflow-step concept from `GHL-tasks-userscript`
  (`workflowEngine.js`, `stepPicker.js`) generalize to "any CRM," or was it specific to how the owner worked
  GHL accounts? If it doesn't carry over, Stage simplifies to a plain Notion `Status`/select property with no
  step-cadence math, and `stepPicker.js`/`workflowEngine.js` are dropped rather than adapted.
- Any existing Notion workspace/database the Contacts and Tasks databases should live under, or create new
  top-level ones?
- Confirm: is a same-tab floating panel enough, or does the owner want it to persist/restore state across
  tab reloads on the same CRM page?
- ~~Which 2-3 real CRM sites (besides GHL) should mapping be validated against first?~~ **Answered
  2026-09-03: GHL only, for now.** Revisit once the picker exists if more sites are needed.

## Notion API credentials

No `.env` exists yet in this repo — Step 1's live `notionClient` work (and any scratch schema-verification
script) will need a Notion internal integration token + a target workspace from the owner before it can hit
the real API. Step 0's Notion findings above are docs-based, not yet confirmed against a real integration.
