# Status

**Last updated:** 2026-09-07

Code changes done and build is clean. Not yet confirmed live by the owner — I don't have a real Notion
account or a mapped CRM page to exercise `App.ui.fullScreen`'s filter/sort bar myself, so per CLAUDE.md §5
this needs the owner to test in the real Tampermonkey install and report back.

## What's done

- `src/ui/floatingPanel.js` is now the single shared "floating layer" module: `openPortal` (one-shot
  popovers), `positionPortal` (position an already-portaled element against a trigger, viewport-clamped,
  above/below flip), `portalHost`, `registerPortal`/`unregisterPortal`/`isEventInPortal` (so any other
  component's own outside-click listener can recognize "click landed in some other open portal" as
  in-bounds instead of closing itself).
- `src/ui/filterSortBar.js`: `openPopover` now just wraps `App.ui.floatingPanel.openPortal`. The
  document-level listener that closes the Filter/Sort panel on an outside click now calls
  `App.ui.floatingPanel.isEventInPortal(e)` first and bails out — this was the actual bug behind "picking
  a filter property closes the Filter panel": the property-picker/condition-submenu popover is portaled
  outside `filterWrap`'s DOM subtree, so `composedPath()` never contained `filterWrap` on a click inside
  it, and the panel-close listener treated that as an outside click.
- `src/ui/datePicker.js`, `timePicker.js`, `typePicker.js`, `stepPicker.js`: all four now portal their
  dropdown panel the same way (previously `position: absolute` inside their own trigger wrap, which is
  exactly what was getting clipped by the filter panel's `overflow-y: auto` when `datePicker` was used as
  a filter condition's date value input). Each panel is portaled once at create time and repositioned via
  `positionPortal` on every `open()`; registered while open so other components' outside-click checks see
  it; unregistered + removed from the DOM on `close()`/`destroy()`.
- `src/ui/styles/flyout.js`: removed the dead `is-open-below` class toggle/rule — positioning is now fully
  JS-driven per open, not a CSS class flip.
- Clean build: `node build/build.js` → `dist/script.user.js` (327933 bytes).

## Open questions / next step

- Needs the owner to paste `dist/script.user.js` into Tampermonkey and confirm both original bugs are
  fixed, per the roadmap's manual test checklist. No code-side open questions.
