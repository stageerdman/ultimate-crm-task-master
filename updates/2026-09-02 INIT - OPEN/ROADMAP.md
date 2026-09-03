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
- [ ] Ask the owner which 2-3 real CRM sites to validate mapping against — **answered: GHL only, for now.**
      Revisit once the picker is built if more sites are needed.

Full findings live in `STATUS.md` under "Step 0 research summary" (2026-09-03 entry) — this roadmap only
states the decisions that follow from them.

## Step 1 — Data model (Notion)

Decisions from research (see STATUS.md for full rationale/citations):

- [ ] **Contacts DB**: `Name` (title), `Phone` (phone_number), `Email` (email), `CRM URLs` (rich_text,
      newline-delimited list of URLs — chosen over multi_select/relation-sub-db: flat, editable, supports
      `contains` filtering, no 100-option cap issue).
- [ ] **Tasks DB**: `Task` (title), `Contact` (relation → Contacts), `Due` (date — supports full ISO 8601
      datetime, not date-only, so **no sentinel-time hack needed**: the predecessor's `timeResolution.js`
      bucket-encoding trick existed only because GHL's Task object had exactly one real timestamp field.
      Store a real due datetime; keep the Todoist-style bucket picker (Morning/Afternoon/Evening/All day) as
      **input UX sugar** that fills a configurable default time per bucket, still freely editable), `Status`
      (native `status` property with groups, e.g. To-do/In Progress/Complete — replaces GHL's ad-hoc
      completed-flag + stage-string; **no separate checkbox**, redundant/dual-source-of-truth risk), `Notes`
      (rich_text).
- [ ] Decide (ask owner, see open question in STATUS.md) whether to keep a GHL-style day/call/total
      call-cadence/workflow-step concept at all, or simplify Stage to a plain `Status`/select property with no
      step-cadence math. `workflowEngine.js`'s flatten/scope/next/prev utilities only port if this concept is
      kept.
- [ ] Build `App.core.notionClient`: auth, generic `request()`, **must resolve each database's
      `data_source_id`** at settings-configure time and query against `/v1/data_sources/{id}/query` (Notion
      API version 2025-09-03 split databases into data sources — the old `/v1/databases/{id}/query` path is
      the pre-2025-09-03 shape). Contact CRUD + lookup: single compound `or` filter across
      `phone_number`/`email`/`CRM URLs contains` (two-level nesting is enough, confirmed by docs). Task CRUD +
      query/filter/sort for views, `relation.contains: <contactPageId>` + view's filter/sort.
- [ ] Pagination: cursor-based (`page_size` max 100, `start_cursor`/`next_cursor`/`has_more`) — for this
      single-user tool, lists will almost always fit one page, but implement the cursor loop for correctness.
- [ ] Rate limiting in `App.core.httpClient`: ~3 req/s average per integration (Notion-documented) — reuse
      the predecessor `apiClient.js`'s queue + burst-limiter + retry-with-backoff **architecture** wholesale,
      just with Notion's stricter numbers. **Must include a hard `timeout`/`ontimeout` on every
      `GM_xmlhttpRequest` call from day one** — the predecessor hit a real production incident where a
      timeout-less hung request wedged the entire queue forever.
- [ ] Confirmed: `api.notion.com` sends no CORS headers for arbitrary browser origins (multiple
      `notion-sdk-js` issue reports) — `GM_xmlhttpRequest` is required, matches the existing assumption.

## Step 2 — Site-mapping engine

Element-picker approach from research (ranked, multi-candidate, verified-unique, self-healing):

- [ ] **Selector generation** (picker-save-time): for the clicked element, walk up ~4-6 ancestors and
      generate one ranked candidate per tier: (1) stable `data-*`/`id`/`name` — filtered to reject
      framework-generated patterns (e.g. `ember482`, hash-looking ids); (2) ARIA role + accessible name /
      associated `<label>`; (3) nearest-stable-ancestor (an ancestor with its own trustworthy id/data-attr) +
      short relative path (tag + `nth-of-type`) down — the ROBULA+-style workhorse, since most real elements
      won't have tiers 1-2 directly on them; (4) nearby label-text anchor (small dictionary: "Phone",
      "Email", "Name", "Contact"); (5) filtered semantic-looking class names; (6) full absolute path, as a
      last-resort fallback that's always generated so save never fails outright.
- [ ] **Verify at save-time**: each candidate must resolve to exactly one element, and it must be the
      clicked node. Reject non-unique/non-matching candidates. Store the full ranked, verified candidate list
      (not just the top pick) plus per-candidate metadata (tag, snapshot text/value at save time, tier).
- [ ] **Resolve at read-time**: try candidates in rank order, stop at first unique resolution that also
      passes a shape-sanity check per field type (phone → digit/punctuation pattern + plausible length; email
      → contains `@` + domain-like suffix; name → non-empty, not a loading-skeleton/placeholder string).
- [ ] **Self-heal detection**: all candidates fail to resolve uniquely → mapping broken, trigger re-map
      prompt. Top-tier candidate degrades to a lower tier (silently starts using a fallback) → flag as
      "mapping degraded," worth surfacing proactively rather than waiting for total failure (leading
      indicator of a mid-redesign CRM).
- [ ] Mapping storage: keyed by hostname, more specific path-scoped mappings coexist and take priority when
      they match (GOAL.md point 6 — grow specificity from evidence).
- [ ] Contact extractor: given a resolved mapping, pull current field values through the shape-sanity check.
- [ ] Contact matcher: extracted fields → single Notion compound-`or` query (phone/email/URL-contains);
      create-new-contact path when no match.
- [ ] "No mapping for this site" prompt on task-create attempt; "mapping broke/degraded" re-prompt flow.

## Step 3 — Port the task-management UX

Per-module port/adapt/drop calls from the predecessor-codebase research (full table in STATUS.md). Headline
finding: **`filterSortBar.js` + `taskViews.js`'s FIELDS/OPERATORS engine + the recursive AND/OR filter tree
port almost verbatim** — it's already generic and Notion's own select/number/date/checkbox property types
line up with its existing type system. Also port `docs/notion-views-plan.md`'s core architectural pivot from
the start (don't re-derive it later): **every view — seeded or user-made — is the same kind of stored
`{filter, sort}` record**, not a fixed list of 7 hardcoded views plus a bolt-on custom escape hatch. Build
OR-filter support from day one (seeded "today OR (overdue AND incomplete)" views need it).

- [ ] Shell (floating panel) — port structure verbatim (3 densities sharing one saved position — dot/compact
      share `FLOATING_POSITION_KEY`, don't give each density its own position), rename storage keys.
- [ ] Quick-add composer — port control-row layout; replace `titleEncoder`-based title/date composition with
      direct Notion property writes (Stage/Day/Call/Modifier/Note as real fields). Contact resolution comes
      from the mapping engine's matched contact, not a GHL URL regex.
- [ ] Task edit panel — port open/close/save/state lifecycle verbatim; **drop the two-step
      unassign-then-delete workaround** (existed only because GHL's task-search index never reconciled
      deletions — a real GHL bug; Notion's API has no equivalent issue, plain archive-delete suffices).
- [ ] Date/time pickers — port verbatim (zero GHL coupling beyond timezone, see Indicators below).
- [ ] Type/step pickers — port combobox UX pattern; re-source stage options from Notion `Status`/select
      property; step picker depends on the Step 1 day/call/total open question.
- [ ] Filter/sort bar + editable views (tabs) — port near-verbatim per the headline finding above. New
      project's `FIELDS` table points at real Notion task properties instead of `decoded.stage` etc.
- [ ] Indicators (overdue/status coloring) — port pure functions verbatim; port the `timezone.js` Intl-based
      wall-clock **technique** but parameterize the IANA zone string as a Settings-panel value instead of the
      hardcoded `'Europe/Prague'` constant (predecessor flagged this as wanted-but-never-done).
- [ ] Full-screen timeline view — port almost entirely (tab bar, list rendering, optimistic-completion-toggle
      exception, Timeline day-grouping). Strip GHL Fast-Nav/"Performance Mode" and Lost n Found entirely.
      `openContact` becomes "open this Notion contact's CRM URL(s)" (possibly more than one).
- [ ] Follow-up-task prompt after completion — port structure, same composer caveat as quick-add.
- [ ] Settings panel — mostly rebuilt, not ported: Notion API key + Contacts/Tasks database IDs, timezone
      (new field), no PIT/Location, no user picker, no update-checking. Keep the *form pattern* (labeled rows,
      JSON-textarea-with-validation, all-or-nothing save) and the idea of a credentials sub-module kept
      separate from general settings.

Design principles to preserve (not just code, see STATUS.md rationale): never update UI ahead of a confirmed
server response, **except** the one deliberate exception — the completed-checkbox toggle flips optimistically
and rolls back on failure; workflow-step auto-fill is always a suggestion, never a lock (apply into mutable
state, stay editable).

## Step 4 — Build system

- [ ] `src/manifest.json` + `build/lib.js` + `build/build.js` → single `dist/script.user.js`. Reuse the
      predecessor's concat/dependency-check/duplicate-export/syntax-validate approach, simplified to one
      output instead of three.
- [ ] `App.core.namespace`/`App.core.log`/`App.core.storage` — port predecessor's `namespace.js`/`log.js`/
      `storage.js` verbatim (zero GHL coupling in any of the three).
- [ ] `App.core.httpClient` — port `apiClient.js`'s queue/burst-limiter/retry/timeout **architecture**
      (see Step 1) with Notion's rate numbers; `App.core.notionClient` built as named methods on top.

## Step 5 — Test

- [ ] Scripted checks where possible via `claude-in-chrome` (mapping flow against GHL, quick-add,
      filter/sort views) — jsdom-style assertions where a live browser isn't needed.
- [ ] Anything requiring the owner's real Notion account or real GHL login: ask the owner to test live and
      report back rather than guessing it works, per `CLAUDE.md` §5.

## Step 6 — Package & wrap up

- [ ] README install instructions (Tampermonkey install steps, first-run Settings setup).
- [ ] Confirm the full flow live with the owner: map GHL, create a task, see it show up correctly, confirm
      it survives a second visit to the same contact.
- [ ] Close this update (`- OPEN` → `- CLOSED`) once the owner confirms it's working as the daily driver.
