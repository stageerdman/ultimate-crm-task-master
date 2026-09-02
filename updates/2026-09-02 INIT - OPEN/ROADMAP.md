# INIT — Roadmap

Free-form, expected to change. **Step 0 is mandatory before any other step is treated as final** — everything
after it is a first-pass plan to be corrected once the research actually happens. Check items off as they're
done; if research changes a later step, edit that step in place (don't just append a correction below it) so
this file stays an accurate current plan, not a change log.

## Step 0 — Research existing code, then adjust this roadmap

- [ ] Read `GHL-tasks-userscript`'s `Project Brief.md` (relevant sections) and `CLAUDE.md` in full for design
      rationale, not just file names.
- [ ] Read every file under its `src/payload/ui/` and `src/payload/ui/styles/` — this is the actual UX to
      port. Catalog each module: what it does, its dependencies, and a port/adapt/drop call for this project.
- [ ] Read `src/payload/modules/taskViews.js`, `titleEncoder.js`, `timeResolution.js`, `timezone.js`,
      `workflowEngine.js` — figure out which parts are generic task-view/filter/sort/time logic (port) vs.
      GHL-title-encoding-specific (drop, replace with real Notion properties).
- [ ] Read `src/shared/apiClient.js`, `src/shared/storage.js`, `src/bootstrap/*` for the GM_* API patterns
      (`GM_xmlhttpRequest`, `GM_setValue`/`GM_getValue`, `GM_notification` if used) — these patterns (not the
      GHL-specific endpoints) are what the new `App.core.httpClient`/`App.core.storage`/`App.core.notionClient`
      should follow.
- [ ] Research the **Notion API** directly (official docs + a scratch script hitting a real test integration,
      using `.env` credentials): database property types available, page create/update/query/filter
      capabilities, rate limits, pagination, and — critically — whether it sends CORS headers or requires
      `GM_xmlhttpRequest` the same way GHL's API did. Confirm a workable schema for Contacts (Name, Phone,
      Email, CRM URLs — one-to-many) and Tasks (relation to Contact, title, due date, status/stage, note,
      completed) using real properties instead of a title-encoding hack.
- [ ] Research userscript element-picker patterns: hover-highlight overlay + click-to-capture a DOM node,
      and how to turn that node into a **robust-enough selector** to save (full CSS path is brittle against
      CRM markup churn — look at what's commonly done: attribute-based selectors, nearest stable ancestor +
      relative path, text-content anchors, etc.). Land on an approach before building the mapping engine.
- [ ] Ask the owner which 2-3 real CRM sites (besides GHL itself, which remains a valid target site) they
      want to validate mapping against first — needed to test the picker against real, uncontrolled markup
      rather than a synthetic page.
- [ ] **Rewrite Steps 1+ below based on what this research finds**, before writing any product code.

## Step 1 — Data model (Notion)

- [ ] Design Contacts database schema (Name/First/Last, Phone, Email, CRM URLs as a multi-item field or
      related sub-items — decide based on Step 0 findings).
- [ ] Design Tasks database schema (relation to Contact, title, due date, status/stage, note, completed) —
      map GHL's stage/day/call-number/modifier/note concept (`Project Brief.md` §3) onto real properties
      instead of an encoded title string, unless research shows a real blocker.
- [ ] Build `App.core.notionClient`: auth, generic `request()`, contact CRUD + lookup-by-phone/email/URL,
      task CRUD + query/filter for views.

## Step 2 — Site-mapping engine

- [ ] Mapping storage: keyed by hostname, with room for a more specific path-scoped mapping to coexist and
      take priority when it matches (see GOAL.md point 6 — grow specificity from evidence, not upfront rules).
- [ ] Element picker UI: hover-highlight, click-to-select, one pass each for name (or first+last), phone,
      email.
- [ ] Contact extractor: given a mapping + the live page, pull current field values.
- [ ] Contact matcher: extracted fields → Notion lookup (phone/email exact match first; URL match as
      secondary/confirmation); create-new-contact path when no match exists.
- [ ] "No mapping for this site" prompt, triggered on task-create attempt.
- [ ] "Mapping exists but elements not found" re-prompt/self-heal flow.

## Step 3 — Port the task-management UX

For each predecessor UI module, port logic/structure and re-skin only what's GHL-specific:
- [ ] Shell (floating panel)
- [ ] Quick-add composer
- [ ] Task edit panel (incl. delete)
- [ ] Date / time / type / step pickers
- [ ] Filter/sort bar + editable views (tabs) — this is the "basically identical to Notion" views system;
      check `docs/notion-views-plan.md` in the predecessor repo for the design decisions already made there.
- [ ] Indicators (overdue/status coloring) — port the timezone-safe approach (`timezone.js`'s Intl-based
      Prague wall-clock conversion), but make the timezone a Settings-panel value instead of hardcoded, since
      the predecessor project flagged this as wanted but never implemented.
- [ ] Full-screen timeline view
- [ ] Follow-up-task prompt after completion
- [ ] Settings panel — rebuilt for this project: Notion API key + database IDs, timezone, no PIT/Location,
      no user picker, no update-checking.

## Step 4 — Build system

- [ ] `src/manifest.json` + `build/lib.js` + `build/build.js` → single `dist/script.user.js`. Reuse the
      predecessor's concat/dependency-check/duplicate-export/syntax-validate approach, simplified to one
      output instead of three.

## Step 5 — Test

- [ ] Scripted checks where possible via `claude-in-chrome` (mapping flow against a real or synthetic test
      page, quick-add, filter/sort views) — jsdom-style assertions where a live browser isn't needed.
- [ ] Anything requiring the owner's real Notion account or real CRM logins: ask the owner to test live and
      report back rather than guessing it works, per `CLAUDE.md` §5.

## Step 6 — Package & wrap up

- [ ] README install instructions (Tampermonkey install steps, first-run Settings setup).
- [ ] Confirm the full flow live with the owner: map a new site, create a task, see it show up correctly,
      confirm it survives a second visit to the same contact.
- [ ] Close this update (`- OPEN` → `- CLOSED`) once the owner confirms it's working as the daily driver.
