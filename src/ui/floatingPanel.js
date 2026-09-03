// requires: (none)
'use strict';
App.ui = App.ui || {};
// Shared "which way should this dropdown open" rule, used by every flyout in the UI (date/time/type/
// step pickers) so the logic lives in exactly one place instead of being copy-pasted per component.
App.ui.floatingPanel = (function () {
  // Not full collision/available-space detection — a deterministic rule: an anchor in the top half of
  // the viewport opens its panel below itself; the bottom half opens above. Since the panel is
  // user-draggable, this is recomputed fresh every time a panel opens rather than assumed.
  function pickSide(anchorEl) {
    var rect = anchorEl.getBoundingClientRect();
    var centerY = rect.top + rect.height / 2;
    var viewportMid = window.innerHeight / 2;
    return centerY < viewportMid ? 'below' : 'above';
  }

  return { pickSide: pickSide };
})();
