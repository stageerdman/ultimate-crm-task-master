// requires: App.core (namespace)
'use strict';
App.core.log = (function () {
  // Flip to true locally for debug output while testing in Tampermonkey. Never left true in a shipped
  // build (CLAUDE.md §7 — no console.log left in shipped code paths).
  var DEBUG = false;

  function log() {
    if (!DEBUG) return;
    console.log.apply(console, ['[CRM Task Master]'].concat(Array.prototype.slice.call(arguments)));
  }

  return log;
})();
