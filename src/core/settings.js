// requires: App.core (namespace), App.core.storage, App.core.notionClient
'use strict';
App.core.settings = (function () {
  var STORAGE_KEY = 'crmTaskMaster.settings';
  var DEFAULTS = {
    notionApiKey: '',
    contactsDatabaseId: '',
    tasksDatabaseId: '',
    timezone: 'UTC',
    // Call-cadence workflow config: { stages: { STAGECODE: { steps: [{day, call, total, time, modifier}] } } }.
    // Empty until the owner defines stages in the Settings panel — see App.tasks.workflowEngine.
    workflow: { stages: {} },
    // Default "HH:mm" for each time-of-day bucket the date/time pickers offer as input shortcuts —
    // still just sugar over a real stored datetime, never an encoded sentinel (ROADMAP.md Step 1).
    reservedTimes: { morning: '09:00', afternoon: '13:00', evening: '18:00', allday: '09:00' },
  };

  function load() {
    return Object.assign({}, DEFAULTS, App.core.storage.get(STORAGE_KEY, {}));
  }

  function isConfigured(settings) {
    return !!(settings.notionApiKey && settings.contactsDatabaseId && settings.tasksDatabaseId);
  }

  function applyToNotionClient(settings) {
    if (!isConfigured(settings)) return;
    App.core.notionClient.configure({
      apiKey: settings.notionApiKey,
      contactsDatabaseId: settings.contactsDatabaseId,
      tasksDatabaseId: settings.tasksDatabaseId,
    });
  }

  // Called once from the bootstrap step — wires whatever's already saved into the httpClient/notionClient
  // before any UI module that might need them mounts.
  function init() {
    applyToNotionClient(load());
  }

  // Settings-panel save path: persist, then immediately re-wire the client so a save takes effect without
  // a page reload.
  function save(patch) {
    var next = Object.assign({}, load(), patch);
    App.core.storage.set(STORAGE_KEY, next);
    applyToNotionClient(next);
    return next;
  }

  return {
    load: load,
    save: save,
    isConfigured: isConfigured,
    init: init,
  };
})();
