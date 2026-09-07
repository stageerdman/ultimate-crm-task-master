# Roadmap

- [x] Extend `App.ui.floatingPanel` into a shared portal system: `portalHost`, `openPortal`,
      `positionPortal`, `registerPortal`/`unregisterPortal`, `isEventInPortal`. Removed the now-superseded
      `pickSide` (folded into `positionPortal`'s own above/below flip).
- [x] `filterSortBar.js`: `openPopover` now delegates to `App.ui.floatingPanel.openPortal` instead of
      duplicating the portal/positioning/outside-click code inline.
- [x] `filterSortBar.js`: `onDocMouseDownClosePanels` bails out via `isEventInPortal(e)` before deciding a
      click was "outside" the Filter/Sort panel — fixes the panel closing when picking a filter property
      or a condition operator.
- [x] `datePicker.js`, `timePicker.js`, `typePicker.js`, `stepPicker.js`: panel now portals into
      `document.body`/shadow-root at create time, repositioned via `positionPortal` on every `open()`,
      registered/unregistered as an open portal, and cleaned up on `destroy()`.
- [x] `styles/flyout.js`: dropped the dead `is-open-below` CSS toggle (JS now sets position/top/left/
      bottom directly on every open); `.crmtm-flyout-panel` defaults to `position: fixed`.
- [x] Clean build (`node build/build.js`).
- [x] `datePicker.js`/`timePicker.js`/`typePicker.js`/`stepPicker.js`: fixed a live-breaking regression —
      the portal attach was happening at `create()` time, before the trigger was guaranteed attached to
      the document, so `portalHost` mis-resolved to `document.body` of the host page instead of the app's
      shadow root (unstyled Date picker + growing DOM leak on the real CRM page). Moved the attach to the
      first `open()` call. Also added `wrap._crmtmDatePicker` destroy-on-rebuild cleanup in
      `filterSortBar.js`'s `buildValueInput`.
- [x] `styles/flyout.js`: fixed a second live-breaking regression — `.crmtm-flyout-panel` still had
      `z-index: 20`, fine as a descendant of the shell's stacking context but losing once portaled out as
      a sibling of it, rendering the dropdown behind the main UI. Matched it to the shell's own
      `z-index: 2147483647`.
- [x] Owner confirmed live: Date filter value picker opens, is visible, and works; filter panel stays open
      when picking a property/operator; filters load/edit at normal speed again.
- [x] Close this update.
