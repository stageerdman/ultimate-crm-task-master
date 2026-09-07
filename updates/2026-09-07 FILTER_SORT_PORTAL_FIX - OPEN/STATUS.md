# Status

**Last updated:** 2026-09-07 (round 2)

Round 1 (portaling) shipped, but the owner reported it live-broke the filters entirely: the Date value
picker wouldn't open at all, and loading/editing filters got very slow. Root cause + fix below. Build is
clean again. Still not confirmed live by the owner — I don't have a real Notion account or a mapped CRM
page to exercise `App.ui.fullScreen`'s filter/sort bar myself, so per CLAUDE.md §5 this needs the owner to
test in the real Tampermonkey install and report back.

## Round 2: the portaling fix itself had a timing bug

The four flyout pickers (`datePicker`/`timePicker`/`typePicker`/`stepPicker`) were portaling their panel
into `App.ui.floatingPanel.portalHost(wrap)` **at `create()` time**. But `create()` can run before `wrap`
is attached to the live document — e.g. filterSortBar builds a condition row (and the date value input
inside it) *before* appending that row into the already-mounted filter panel. At that moment
`wrap.getRootNode()` just returns `wrap` itself (a detached node is its own root), so `portalHost` wrongly
fell back to `document.body` instead of the app's real shadow root:
- The panel got dropped, unstyled (no shadow-scoped CSS reaches it there), directly into **document.body
  of the live CRM page** — not just invisible, but a brand-new one on every single `renderGroup()` pass
  (every time the Filter panel opens or a condition is added/removed), since `create()` ran unconditionally
  regardless of whether the user ever opened the picker. That explains both symptoms: the date picker
  "not working" (no styling/positioning ever applied) and filters getting slower over time (host page DOM
  silently accumulating orphaned elements — some CRMs run their own mutation-watching JS, which this would
  also disturb).

Fix: defer the portal attach from `create()` to the first `open()` call — by the time a user has clicked/
focused the trigger, its DOM subtree is guaranteed live, exactly matching how the original (correct)
`filterSortBar` popover already worked. Also added a `wrap._crmtmDatePicker` cleanup guard in
`filterSortBar.js`'s `buildValueInput` so a previously-*opened* date picker is `destroy()`ed (not just
DOM-discarded) before its row is rebuilt from scratch — otherwise an opened-then-rebuilt picker would still
leak going forward, just far less often than before.

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
- Clean build (round 1): `dist/script.user.js` (327933 bytes). Clean build (round 2 fix): `dist/script.user.js`
  (329374 bytes).

## Open questions / next step

- Needs the owner to paste `dist/script.user.js` into Tampermonkey and confirm: the Date filter value
  picker opens and works again, filters load/edit at normal speed, and the two original bugs (panel
  closing on property pick, calendar clipped) are still fixed. No code-side open questions — but given
  round 1 shipped a real live-breaking regression, treat this round's fix as unverified until the owner
  confirms, not just "build succeeded."
