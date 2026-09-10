# Status

**Last updated:** 2026-09-10

All code changes made (original 3 fixes + the debug details disclosure requested after) and build is
clean. Awaiting owner's live test/confirmation before closing.

## Done
- Remap button added next to Create in the "not found" banner (`src/ui/compactContactTasks.js`).
- `App.tasks.taskStore` now caches the last poll snapshot and replays it to new subscribers immediately,
  so compact bar / full-screen show existing tasks right after mounting instead of waiting for the next
  30s poll (`src/tasks/taskStore.js`).
- Contact matching now tries phone first, then email, then URL — sequential, not one arbitrary OR query
  (`src/mapping/contactMatcher.js`).
- Debug details disclosure: chevron toggle on the `broken` and `no-contact-match` banners.
  - `App.mapping.selectorEngine.diagnoseMapping` / `App.mapping.contactExtractor.diagnose` — new
    debug-only per-candidate diagnostics, don't touch the normal resolve path.
  - `broken` panel: hostname/page-scope + which selector tier resolved/failed/got shape-rejected, per
    field.
  - `no-contact-match` panel: extracted values + lazily-fetched (on first expand only) Notion phone/email
    exact-match results, each with "Use this" to link the page's URL onto an existing contact instead of
    creating a duplicate.
  - Panel state (`detailsOpen`, `debugCandidates`) resets on every page/contact change.
- `node build/build.js` succeeds after every change.

## Open questions
- None currently. Waiting on owner to confirm all behaviors live per ROADMAP.md step 10, including trying
  "Use this" against a real near-miss contact.
