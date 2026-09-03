// requires: App.mapping.selectorEngine, App.ui.mappingPickerOverlay
'use strict';
App.mapping = App.mapping || {};
// Click-to-map capture session: hover-highlights whatever's under the cursor, and on click builds a
// verified ranked mapping for that element via App.mapping.selectorEngine instead of trusting a single
// selector. Listens in the capture phase and prevents default/propagation so the click never reaches the
// underlying CRM page's own handlers (this app runs on arbitrary, uncontrolled third-party markup that
// may otherwise navigate away or submit a form on click).
App.mapping.elementPicker = (function () {
  var active = false;
  var currentOnPick = null;
  var currentFieldType = null;
  var rafPending = false;
  var lastHoverEl = null;

  function onMouseMove(event) {
    if (rafPending) return;
    rafPending = true;
    var target = event.target;
    requestAnimationFrame(function () {
      rafPending = false;
      if (!active) return;
      lastHoverEl = target;
      App.ui.mappingPickerOverlay.highlight(target);
    });
  }

  function onClick(event) {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
    var el = event.target;
    var mapping = App.mapping.selectorEngine.buildVerifiedMapping(el, currentFieldType);
    var onPick = currentOnPick;
    stop();
    if (onPick) onPick(mapping);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') stop();
  }

  function start(fieldType, labelText, onPick) {
    if (active) stop();
    active = true;
    currentFieldType = fieldType;
    currentOnPick = onPick;
    App.ui.mappingPickerOverlay.showInstruction('Click the element containing ' + labelText + ' (Esc to cancel)');
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function stop() {
    if (!active) return;
    active = false;
    lastHoverEl = null;
    currentOnPick = null;
    currentFieldType = null;
    App.ui.mappingPickerOverlay.teardown();
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function isActive() {
    return active;
  }

  return {
    start: start,
    stop: stop,
    isActive: isActive,
  };
})();
