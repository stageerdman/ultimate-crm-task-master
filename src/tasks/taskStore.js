// requires: App.core.log, App.core.notionClient
'use strict';
App.tasks = App.tasks || {};
// Client-side polling cache over Notion's task database — Notion has no push/webhook mechanism this
// userscript can subscribe to, so, like the predecessor's GHL-backed taskStore, this polls on an
// interval and hands decorated snapshots to subscribers. Never updates a subscriber ahead of a confirmed
// fetch (App.ui.fullScreen's completed-toggle is the one deliberate optimistic exception, handled at
// that call site, not here).
App.tasks.taskStore = (function () {
  var POLL_INTERVAL_MS = 30000;
  var subscribers = [];
  var status = { lastPolledAt: null, lastError: null };
  var pollTimer = null;

  function notify(tasks) {
    subscribers.forEach(function (cb) {
      cb(tasks);
    });
  }

  function refresh() {
    return App.core.notionClient.listAllTasks().then(
      function (pages) {
        var tasks = pages.map(App.core.notionClient.decorateTask);
        status.lastPolledAt = Date.now();
        status.lastError = null;
        notify(tasks);
        return tasks;
      },
      function (error) {
        App.core.log('taskStore: refresh failed:', error.message);
        status.lastError = error.message;
        throw error;
      }
    );
  }

  function subscribe(callback) {
    subscribers.push(callback);
    return function unsubscribe() {
      subscribers = subscribers.filter(function (cb) {
        return cb !== callback;
      });
    };
  }

  function getStatus() {
    return status;
  }

  // Starts the background poll if it isn't already running — idempotent, so any UI module that needs
  // live data can call this on mount without worrying about double-starting the timer.
  function startPolling() {
    if (pollTimer) return;
    refresh();
    pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
  }

  return {
    refresh: refresh,
    subscribe: subscribe,
    getStatus: getStatus,
    startPolling: startPolling,
  };
})();
