# Status

**Last updated:** 2026-09-10

All three code changes made and build is clean. Awaiting owner's live test/confirmation before closing.

## Done
- Remap button added next to Create in the "not found" banner (`src/ui/compactContactTasks.js`).
- `App.tasks.taskStore` now caches the last poll snapshot and replays it to new subscribers immediately,
  so compact bar / full-screen show existing tasks right after mounting instead of waiting for the next
  30s poll (`src/tasks/taskStore.js`).
- Contact matching now tries phone first, then email, then URL — sequential, not one arbitrary OR query
  (`src/mapping/contactMatcher.js`).
- `node build/build.js` succeeds.

## Open questions
- None currently. Waiting on owner to confirm all three behaviors live per ROADMAP.md step 5.
