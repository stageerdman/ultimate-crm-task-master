# INIT — Roadmap

Free-form, expected to change. Check items off as they're done; if research changes a later step, edit that
step in place (don't just append a correction below it) so this file stays an accurate current plan, not a
change log.

## Step 0 — Research existing code, then adjust this roadmap ✅ done 2026-09-03

- [x] Read `GHL-tasks-userscript`'s `Project Brief.md`/`CLAUDE.md` for design rationale.
- [x] Catalog every file under `src/payload/ui/**` and `src/payload/ui/styles/**` with a port/adapt/drop call.
- [x] Catalog `taskViews.js`, `titleEncoder.js`, `timeResolution.js`, `timezone.js`, `workflowEngine.js`.
- [x] Catalog `src/shared/apiClient.js`, `src/shared/storage.js`, `src/bootstrap/*` for GM_* API patterns.
- [x] Research the Notion API directly (official docs): property types, page CRUD, query/filter, pagination,
      rate limits, CORS.
- [x] Research element-picker selector strategies robust to CRM markup churn.
- [x] Ask the owner which 2-3 real CRM sites to validate mapping against — **answered: GHL only, for now.**
      Revisit once the picker is built if more sites are needed.

Full findings live in `STATUS.md` under "Step 0 research summary" (2026-09-03 entry) — this roadmap only
states the decisions that follow from them.

## Step 1 — Data model (Notion) ✅ schema live 2026-09-03

Owner had already built both databases by hand before this step started; live-verified against the real
workspace (see STATUS.md "Live Notion verification" entry) rather than created from scratch. Owner also
confirmed (2026-09-03): **the day/call/total call-cadence/workflow-step concept works for any CRM, not just
GHL** — keep it, `workflowEngine.js` ports.

- [x] **People DB** (`data_source_id 3cf4c170-2623-8004-a40e-000bfef99d00`): `Name` (title), `Phone`
      (phone_number), `Email` (email), `URL Contact` (url), `URL Opportunity` (url), `Tasks` (relation, dual
      synced with Tasks.People). Two typed single-URL fields instead of the multi-URL rich_text field
      originally planned — this maps directly onto GHL's own two page types (contact page vs. opportunity
      page, the exact example in GOAL.md point 6) and the owner built it this way already. Contact lookup
      uses a 4-leaf `or` filter (phone/email/URL Contact/URL Opportunity) instead of 3 — still one query, well
      under the 2-level nesting cap. **Forward-looking note, not urgent**: if a second CRM with different page
      types gets mapped later, revisit whether two fixed URL fields still fit or a more generic multi-URL
      field is needed then — no need to solve this before it's evidence-backed (GOAL.md point 6 philosophy).
- [x] **Tasks DB** (`data_source_id 3cf4c170-2623-806a-bb61-000bf13d51e1`): `Task` (title), `People`
      (relation → People, dual synced), `Due Date` (date — full ISO 8601 datetime confirmed working, so **no
      sentinel-time hack needed**: the predecessor's `timeResolution.js` bucket-encoding trick existed only
      because GHL's Task object had exactly one real timestamp field. Store a real due datetime; keep the
      Todoist-style bucket picker (Morning/Afternoon/Evening/All day) as **input UX sugar** that fills a
      configurable default time per bucket, still freely editable), `Status` (native `status` property,
      already had groups To-do/In Progress/Complete with options Planned/In progress/Completed — completion
      tracking, separate from Stage below), `Note` (rich_text). **Added 2026-09-03** to carry the
      day/call/total concept as real properties (replacing `titleEncoder.js`'s
      `{STAGE}{DAY} {CALL}/{TOTAL} + {MODIFIER} | {NOTE}` string grammar 1:1): `Stage` (select, empty options
      — populated from `settings.workflow.stages` keys as they're used, matching `titleEncoder.decode`'s
      `stage` field), `Day` (number, optional), `Call` (number, optional), `Total` (number, optional),
      `Modifier` (rich_text, optional — free text for now; revisit as `select` only if a small fixed set of
      modifier values emerges in practice).
- [x] Build `App.core.notionClient`: auth, generic `request()`, **must resolve each database's
      `data_source_id`** at settings-configure time and query against `/v1/data_sources/{id}/query` (Notion
      API version 2025-09-03 split databases into data sources — confirmed live, hardcode the two IDs above
      as the settings-configured defaults). Contact CRUD + lookup: single compound `or` filter across
      `Phone`/`Email`/`URL Contact`/`URL Opportunity` — **live-tested and confirmed working**. Task CRUD +
      query/filter/sort for views, `relation.contains: <contactPageId>` + view's filter/sort — **live-tested
      and confirmed working**, including writing/reading Stage/Day/Call/Total/Note in one page create.
- [x] Pagination: cursor-based (`page_size` max 100, `start_cursor`/`next_cursor`/`has_more`) — implemented
      as `queryAllPages` inside `notionClient.js`, looping until `has_more` is false.
- [x] Rate limiting in `App.core.httpClient`: ~3 req/s average per integration (Notion-documented) — queue +
      burst-limiter (3 req/1000ms) + retry-with-backoff (honors `Retry-After` on 429) + hard 20s
      `timeout`/`ontimeout` on every `GM_xmlhttpRequest` call, built from the first commit.
- [x] Confirmed live: `api.notion.com` sends no CORS headers for arbitrary browser origins —
      `GM_xmlhttpRequest` is required (this was tested from a server-side dev script, not a browser, but
      matches the documented/community-reported behavior; still worth a real in-browser smoke test once the
      userscript skeleton exists, since GM_xmlhttpRequest is the actual runtime path).

## Step 2 — Site-mapping engine ✅ built 2026-09-03

Element-picker approach from research (ranked, multi-candidate, verified-unique, self-healing) — all built
in `src/mapping/` + `src/ui/mappingPickerOverlay.js`, wired end-to-end through
`App.mapping.pageContext.resolve(url)` and surfaced in the compact bar (`src/ui/compactContactTasks.js`):

- [x] **Selector generation** (picker-save-time): for the clicked element, walk up ~4-6 ancestors and
      generate one ranked candidate per tier: (1) stable `data-*`/`id`/`name` — filtered to reject
      framework-generated patterns (e.g. `ember482`, hash-looking ids); (2) ARIA role + accessible name /
      associated `<label>`; (3) nearest-stable-ancestor (an ancestor with its own trustworthy id/data-attr) +
      short relative path (tag + `nth-of-type`) down — the ROBULA+-style workhorse, since most real elements
      won't have tiers 1-2 directly on them; (4) nearby label-text anchor (small dictionary: "Phone",
      "Email", "Name", "Contact"); (5) filtered semantic-looking class names; (6) full absolute path, as a
      last-resort fallback that's always generated so save never fails outright.
- [x] **Verify at save-time**: each candidate must resolve to exactly one element, and it must be the
      clicked node. Reject non-unique/non-matching candidates. Store the full ranked, verified candidate list
      (not just the top pick) plus per-candidate metadata (tag, snapshot text/value at save time, tier).
- [x] **Resolve at read-time**: try candidates in rank order, stop at first unique resolution that also
      passes a shape-sanity check per field type (phone → digit/punctuation pattern + plausible length; email
      → contains `@` + domain-like suffix; name → non-empty, not a loading-skeleton/placeholder string).
- [x] **Self-heal detection**: all candidates fail to resolve uniquely → mapping broken, trigger re-map
      prompt. Top-tier candidate degrades to a lower tier (silently starts using a fallback) → flag as
      "mapping degraded" (`extraction.degraded`, threaded through to `pageContext`'s `matched` status but not
      yet surfaced in the compact-bar UI — see open item below).
- [x] Mapping storage: keyed by hostname, more specific path-scoped mappings coexist and take priority when
      they match (GOAL.md point 6 — grow specificity from evidence).
- [x] Contact extractor: given a resolved mapping, pull current field values through the shape-sanity check.
- [x] Contact matcher: extracted fields → single Notion compound-`or` query (phone/email/URL-contains);
      create-new-contact path when no match.
- [x] "No mapping for this site" prompt on task-create attempt; "mapping broke" re-prompt flow — both shown
      as a small banner in the compact bar (`src/ui/compactContactTasks.js`) with a Map/Re-map/Create-contact
      button. **Not yet built**: a visible "degraded" indicator for the silently-downgraded-candidate case —
      low priority until real markup churn is observed in practice (GOAL.md point 6 philosophy: don't
      over-build ahead of evidence).

## Step 3 — Port the task-management UX ✅ built 2026-09-03

Per-module port/adapt/drop calls from the predecessor-codebase research (full table in STATUS.md). Headline
finding: **`filterSortBar.js` + `taskViews.js`'s FIELDS/OPERATORS engine + the recursive AND/OR filter tree
port almost verbatim** — it's already generic and Notion's own select/number/date/checkbox property types
line up with its existing type system. Also port `docs/notion-views-plan.md`'s core architectural pivot from
the start (don't re-derive it later): **every view — seeded or user-made — is the same kind of stored
`{filter, sort}` record**, not a fixed list of 7 hardcoded views plus a bolt-on custom escape hatch. Build
OR-filter support from day one (seeded "today OR (overdue AND incomplete)" views need it).

- [x] Shell (floating panel) — port structure verbatim (3 densities sharing one saved position — dot/compact
      share `FLOATING_POSITION_KEY`, don't give each density its own position), rename storage keys
      (`crmTaskMaster.ui.*`).
- [x] Quick-add composer — port control-row layout; replace `titleEncoder`-based title/date composition with
      direct Notion property writes (Stage/Day/Call/Modifier/Note as real fields). Contact resolution comes
      from the mapping engine's matched contact (`App.ui.compactContactTasks.getContactId()`), not a GHL URL
      regex.
- [x] Task edit panel — port open/close/save/state lifecycle verbatim; **dropped the two-step
      unassign-then-delete workaround** (existed only because GHL's task-search index never reconciled
      deletions — a real GHL bug; Notion's API has no equivalent issue, plain archive-delete via `in_trash`
      suffices).
- [x] Date/time pickers — ported verbatim (zero GHL coupling beyond timezone, see Indicators below).
- [x] Type/step pickers — ported combobox UX pattern; re-sourced stage options from Notion `Stage`/select
      property (not `Status` — that's the separate To-do/In Progress/Complete completion field); step picker
      keeps `workflowEngine.js`'s flatten/scope/next/prev logic, cycling through Day/Call/Total combos per
      stage same as before, now reading/writing real Stage/Day/Call/Total properties instead of a decoded
      title string.
- [x] Filter/sort bar + editable views (tabs) — ported near-verbatim per the headline finding above. New
      project's `FIELDS` table points at real Notion task properties (`status` select field replaces the
      predecessor's boolean `completed` checkbox — more accurate to Notion's 3-valued native status).
- [x] Indicators (overdue/status coloring) — ported pure functions verbatim; ported the `timezone.js`
      Intl-based wall-clock **technique** parameterized on the Settings-panel `timezone` value from the start
      (no hardcoded zone, unlike the predecessor).
- [x] Full-screen timeline view — ported almost entirely (tab bar, list rendering, optimistic-completion-
      toggle exception, Timeline day-grouping). Stripped GHL Fast-Nav/"Performance Mode" and Lost n Found
      entirely. `openContact` opens whichever of the Notion contact's `URL Contact`/`URL Opportunity` exists,
      in a new tab.
- [x] Follow-up-task prompt after completion — ported structure, same composer caveat as quick-add.
- [x] Settings panel — mostly rebuilt, not ported: Notion API key + Contacts/Tasks database IDs, timezone,
      bucket-default times, workflow JSON. No PIT/Location, no user picker, no update-checking. Kept the
      *form pattern* (labeled rows, JSON-textarea-with-validation, all-or-nothing save).
- [x] **New (not in original Step 3 list)**: `src/tasks/taskStore.js` — a client-side polling cache over
      `notionClient.listAllTasks()` (Notion has no push/webhook mechanism), replacing the predecessor's
      GHL-backed `taskStore`. 30s poll interval, `subscribe`/`refresh`/`getStatus`, same non-optimistic
      contract as everything else.

Design principles to preserve (not just code, see STATUS.md rationale): never update UI ahead of a confirmed
server response, **except** the one deliberate exception — the completed-checkbox toggle flips optimistically
and rolls back on failure; workflow-step auto-fill is always a suggestion, never a lock (apply into mutable
state, stay editable).

## Step 4 — Build system ✅ built 2026-09-03

- [x] `src/manifest.json` + `build/lib.js` + `build/build.js` → single `dist/script.user.js`. Simplified
      from the predecessor's concat/dependency-check/duplicate-export/syntax-validate approach to one output,
      no credential-placeholder substitution (credentials come from the runtime Settings panel only).
- [x] `App.core.namespace`/`App.core.log`/`App.core.storage` — ported predecessor's `namespace.js`/`log.js`/
      `storage.js` verbatim (zero GHL coupling in any of the three).
- [x] `App.core.httpClient` — ported `apiClient.js`'s queue/burst-limiter/retry/timeout **architecture**
      (see Step 1) with Notion's rate numbers (3 req/1000ms, `Retry-After`-aware); `App.core.notionClient`
      built as named methods on top. Full build: `dist/script.user.js`, ~315KB, clean (dependency check +
      duplicate-export check + `vm.Script` syntax validation all pass).

## Step 5 — Test ✅ partially done 2026-09-03

- [x] Pure-logic modules (timezone round-trip, `workflowEngine` flatten/next/nextOrSame, `timeBuckets`,
      `taskViews` filter/sort incl. OR-groups and empty-value-sorts-last) — verified via a Node `vm` harness
      loading the real `/src` files directly (scratch script, not committed).
- [x] `App.core.notionClient`/`httpClient` — verified **live against the real Notion workspace**, running the
      actual shipped code (`GM_xmlhttpRequest` stubbed with Node's `https`, not curl this time):
      createContact/createTask/decorateTask/findContact(compound-or)/listTasksForContact/updateTask/
      deleteTask all confirmed working, then cleaned up (workspace verified empty again after).
- [ ] **Not done — needs the owner**: anything requiring a real GHL login and a real browser (the mapping/
      click-to-map picker against real GHL markup, the compact-bar banner flow, quick-add end-to-end, the
      full-screen panel's tabs/timeline/settings UI rendering correctly). `claude-in-chrome` browser
      automation wasn't used for this, since it would need the owner's real GHL session — see STATUS.md's
      open item for what to test and report back.

## Step 6 — Package & wrap up

- [x] README install instructions (Tampermonkey install steps, first-run Settings setup).
- [ ] Confirm the full flow live with the owner: map GHL, create a task, see it show up correctly, confirm
      it survives a second visit to the same contact.
- [ ] Close this update (`- OPEN` → `- CLOSED`) once the owner confirms it's working as the daily driver.
