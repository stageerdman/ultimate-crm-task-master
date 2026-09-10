1. [x] `src/ui/compactContactTasks.js` — add a "Remap" button next to "Create" in the `no-contact-match`
   banner. Reuses `startMappingFlow(pathPattern)`, same as the existing `broken`-status Remap button.
2. [x] `src/tasks/taskStore.js` — cache the last confirmed poll snapshot (`lastTasks`) and hand it to a
   subscriber immediately on `subscribe()`, instead of only notifying on the next `refresh()`. Fixes both
   `compactContactTasks` and `fullScreen`, which both subscribe well after `shell.js`'s initial
   `startPolling()` call already fired.
3. [x] `src/mapping/contactMatcher.js` — replace the single compound-OR `findContact` call with a strict
   sequential lookup: phone first, then email if no phone match, then URL as a last-resort fallback.
4. [x] `node build/build.js` — clean build.
5. [ ] Owner to test live: (a) a page with no Notion match — confirm Remap now shows beside Create; (b)
   open compact bar / full-screen shortly after page load — confirm existing tasks appear without waiting
   ~30s; (c) a contact whose phone matches one Notion contact but whose email happens to match a different
   Notion contact — confirm the phone match wins.
