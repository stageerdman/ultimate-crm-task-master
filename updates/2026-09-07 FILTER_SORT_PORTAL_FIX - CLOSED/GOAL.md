# Goal

Two regressions the owner hit in the filter/sort bar (`App.ui.filterSortBar`), both recurrences of the
same underlying "dropdown escapes a scrollable ancestor" class of bug the INIT update's close-out notes
already flagged as likely to recur:

1. Picking a property in the "Add filter" property picker (or an operator in the condition submenu)
   closed the whole Filter panel instead of just the picker, forcing the user to reopen Filter and start
   over.
2. The date-value picker's calendar dropdown, when used inside a filter condition's value input, was
   visually clipped by the filter panel's `overflow-y: auto` and required scrolling to see.

The owner explicitly asked for this to be fixed as "a shared property or principle" so it can't silently
recur in a third place later (echoing the INIT STATUS.md note: "same technique would fix the same class
of bug elsewhere if it recurs, e.g. inside taskEditPanel's scrollable panel").

# Why

`App.ui.filterSortBar`'s own popover (added in INIT) already solved this correctly for its own property
picker/condition submenu by portaling to `document.body`/shadow-root with `position: fixed`. But:
- A *separate* outside-click listener in `filterSortBar.js` (closing the Filter/Sort panel itself) didn't
  know about that portal, so it saw a click landing inside the portaled popover as "outside" and closed
  the panel out from under the selection — bug 1.
- The four other flyout-style dropdowns in the app (`App.ui.datePicker`, `timePicker`, `typePicker`,
  `stepPicker`) never got the portal treatment at all — still plain `position: absolute` children of
  their trigger's wrap — so any of them clips the moment they're used inside a scrollable ancestor, which
  is exactly what happens when `datePicker` is mounted as a filter condition's date value input — bug 2.

# How to apply

Made the portal technique a real shared primitive in `App.ui.floatingPanel.js` (`openPortal`,
`positionPortal`, `registerPortal`/`unregisterPortal`, `isEventInPortal`) instead of code living only
inside `filterSortBar.js`. `filterSortBar.js` now delegates to it, and its own panel-closing outside-click
listener calls `isEventInPortal(e)` first. All four flyout pickers now portal their panel through the same
primitive. Any future "click outside me, close" listener in this codebase should call
`App.ui.floatingPanel.isEventInPortal(e)` before treating a click as outside, and any future flyout/
popover that might live inside a scrollable container should mount through `openPortal`/`positionPortal`
rather than `position: absolute`.
