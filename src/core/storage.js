// requires: App.core (namespace)
'use strict';
App.core.storage = (function () {
  var listeners = {};

  function get(key, defaultValue) {
    var value = GM_getValue(key, undefined);
    return value === undefined ? defaultValue : value;
  }

  function set(key, value) {
    GM_setValue(key, value);
  }

  // Cross-tab sync: GM_addValueChangeListener fires in every tab, including the one that made the
  // write. `remote` is false for the writing tab itself — only forward remote writes so callers don't
  // double-handle their own change.
  function onChange(key, callback) {
    if (!listeners[key]) {
      listeners[key] = [];
      GM_addValueChangeListener(key, function (name, oldValue, newValue, remote) {
        if (!remote) return;
        listeners[name].forEach(function (cb) {
          cb(newValue, oldValue);
        });
      });
    }
    listeners[key].push(callback);
  }

  return {
    get: get,
    set: set,
    onChange: onChange,
  };
})();
