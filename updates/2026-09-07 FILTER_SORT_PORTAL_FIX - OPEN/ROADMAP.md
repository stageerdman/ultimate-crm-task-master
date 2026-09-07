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
- [ ] Owner: test live in Tampermonkey — (a) open Filter, click "+ Add filter", pick a property, confirm
      the Filter panel stays open; same for picking a condition operator. (b) Add a Date-type filter
      condition, open its date value picker, confirm the calendar isn't clipped/doesn't require scrolling
      the filter panel to see it. (c) Spot-check date/time/type/step pickers elsewhere (quick-add, task
      edit panel) still open/close/position correctly now that they portal.
- [ ] Close this update once the owner confirms live.
