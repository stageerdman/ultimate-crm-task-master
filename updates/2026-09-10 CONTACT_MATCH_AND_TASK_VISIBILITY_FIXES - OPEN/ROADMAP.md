1. [x] `src/ui/compactContactTasks.js` — add a "Remap" button next to "Create" in the `no-contact-match`
   banner. Reuses `startMappingFlow(pathPattern)`, same as the existing `broken`-status Remap button.
2. [x] `src/tasks/taskStore.js` — cache the last confirmed poll snapshot (`lastTasks`) and hand it to a
   subscriber immediately on `subscribe()`, instead of only notifying on the next `refresh()`. Fixes both
   `compactContactTasks` and `fullScreen`, which both subscribe well after `shell.js`'s initial
   `startPolling()` call already fired.
3. [x] `src/mapping/contactMatcher.js` — replace the single compound-OR `findContact` call with a strict
   sequential lookup: phone first, then email if no phone match, then URL as a last-resort fallback.
4. [x] `node build/build.js` — clean build.
5. [x] `src/mapping/selectorEngine.js` — add `diagnoseMapping(mapping)`: runs every candidate (not just the
   first winner) and reports `{ tier, type, selector/labelText, resolved, text, shapeOk }` per candidate.
6. [x] `src/mapping/contactExtractor.js` — add `diagnose(mappingRecord)` wrapping `diagnoseMapping` per
   field type, debug-only (not used by the normal `extract()` path).
7. [x] `src/ui/compactContactTasks.js` — small chevron toggle next to the banner on `broken` and
   `no-contact-match` statuses. Expanding shows a details panel:
   - `broken`: hostname/page-scope + per-field, per-candidate selector diagnostics (which tier resolved,
     which didn't, which resolved but got shape-check-rejected).
   - `no-contact-match`: extracted name/phone/email + lazily-fetched (only on first expand) Notion
     phone-only and email-only exact-match results, each with a "Use this" button that links the page's URL
     onto that existing contact (`updateContact({ urlContact })`) instead of creating a duplicate.
   - `detailsOpen`/`debugCandidates` reset on every page/contact change so stale debug data never leaks
     across navigations.
8. [x] `src/ui/styles/compactContactTasks.js` — details toggle/panel/candidate-row styles.
9. [x] `node build/build.js` — clean build after the details-panel work.
10. [ ] Owner to test live: (a) a page with no Notion match — confirm Remap now shows beside Create; (b)
    open compact bar / full-screen shortly after page load — confirm existing tasks appear without waiting
    ~30s; (c) a contact whose phone matches one Notion contact but whose email happens to match a different
    Notion contact — confirm the phone match wins; (d) expand the details arrow on a broken mapping and on
    a not-found contact — confirm the diagnostics look right, and try "Use this" against a real near-miss
    contact.
