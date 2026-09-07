// requires: (none)
'use strict';
App.ui = App.ui || {};
// Shared "floating layer" system, used by every flyout/popover in the UI (date/time/type/step pickers,
// filterSortBar's property picker + condition submenu, and anything future) so this logic lives in
// exactly one place instead of being reinvented — and re-broken — per component. Two problems this
// solves once, for good:
//
// 1. Clipping: a dropdown positioned `position: absolute` inside its trigger's own DOM subtree gets
//    visually clipped by any ancestor with `overflow: auto/hidden` (e.g. the Notion-style filter panel,
//    which must scroll when a condition list gets long). Fix: `openPortal`/`positionPortal` place the
//    dropdown at `position: fixed`, positioned from the trigger's live getBoundingClientRect() and
//    appended to document.body (or the nearest shadow root) — the same way a native <select> escapes
//    overflow, so it never needs the ancestor to scroll into view.
//
// 2. False "click outside" closes: once a dropdown is portaled, it's no longer a DOM descendant of its
//    trigger's container. Any *other* component with its own "click outside me, close" listener (e.g.
//    filterSortBar's own filter/sort panel) will see composedPath() NOT include its container on a click
//    that lands inside the portaled dropdown, and incorrectly close itself out from under the user mid-
//    selection. Fix: every open portal registers itself here; any outside-click handler elsewhere in the
//    app must call `isEventInPortal(e)` first and bail out if true, treating "inside some open portal" as
//    equivalent to "inside my own container."
App.ui.floatingPanel = (function () {
  // Element (or shadow root) that portaled nodes should be appended to — the nearest shadow root when
  // the trigger lives inside one (so styles/z-index still apply), else document.body.
  function portalHost(anchorEl) {
    var root = anchorEl.getRootNode();
    return root && root.host ? root : document.body;
  }

  var openPortals = [];

  function registerPortal(el) {
    if (openPortals.indexOf(el) === -1) openPortals.push(el);
  }

  function unregisterPortal(el) {
    var idx = openPortals.indexOf(el);
    if (idx !== -1) openPortals.splice(idx, 1);
  }

  function isEventInPortal(e) {
    if (!openPortals.length) return false;
    var path = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < openPortals.length; i++) {
      if (path.indexOf(openPortals[i]) !== -1) return true;
    }
    return false;
  }

  // Positions an already-portaled, already-content-built `el` (position: fixed) against `anchorEl`,
  // below it by default, flipping above and clamping to the viewport on every edge — same rule
  // openPopover already used for filterSortBar's picker/submenu, now shared so every flyout gets it too.
  function positionPortal(el, anchorEl) {
    el.style.position = 'fixed';
    el.style.margin = '0';
    el.style.bottom = 'auto';
    var rect = anchorEl.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    var left = Math.min(rect.left, window.innerWidth - elRect.width - 8);
    var top = rect.bottom + 4;
    if (top + elRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - elRect.height - 4);
    }
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = top + 'px';
  }

  // Convenience for one-shot popovers (property picker, condition submenu, ...): builds a fresh element,
  // portals + positions it against `anchorEl`, wires outside-click/Escape-to-close, and tears itself down
  // completely on close (as opposed to the flyout pickers, which portal one persistent panel element and
  // reposition it on each open — see datePicker.js etc.). `build(pop, close)` fills in pop's content.
  function openPortal(anchorEl, className, build) {
    var pop = document.createElement('div');
    if (className) pop.className = className;
    build(pop, function () { close(); });

    portalHost(anchorEl).appendChild(pop);
    positionPortal(pop, anchorEl);
    registerPortal(pop);

    var closed = false;
    function onDocMouseDown(e) {
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(pop) === -1) close();
    }
    function onDocKeyDown(e) {
      if (e.key === 'Escape') close();
    }
    function close() {
      if (closed) return;
      closed = true;
      unregisterPortal(pop);
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onDocKeyDown, true);
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onDocKeyDown, true);
    return { el: pop, close: close };
  }

  return {
    portalHost: portalHost,
    registerPortal: registerPortal,
    unregisterPortal: unregisterPortal,
    isEventInPortal: isEventInPortal,
    positionPortal: positionPortal,
    openPortal: openPortal,
  };
})();
