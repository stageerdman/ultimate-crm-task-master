// requires: App.core (namespace), App.core.storage, App.core.notionClient
'use strict';
App.core.settings = (function () {
  var STORAGE_KEY = 'crmTaskMaster.settings';
  // Call-cadence workflow config: { stages: { STAGECODE: { label, steps: [{day, call, total, time,
  // dateOffsetDays, modifier}] } } }. Ported verbatim from the owner's real GHL-tasks-userscript catalog
  // (src/payload/settings.js DEFAULTS.workflow) — the actual stage set the owner works daily, not a
  // placeholder. `dateOffsetDays` lets a step's due date diverge from what its own `day` label would
  // otherwise imply (see App.ui.taskComposer.resolveStepSchedule). Steps that define neither `time` nor
  // `dateOffsetDays`/`day` are left as whatever's already selected/empty. `modifiers` is empty per the
  // owner's own instruction in the source project ("remove all modifiers, I'll add them later").
  var DEFAULT_WORKFLOW = {
    stages: {
      NA: {
        label: 'No Answer',
        steps: [
          { day: 1, call: 1, total: 2, time: 'morning' },
          { day: 1, call: 2, total: 2, time: 'evening' },
          { day: 2, call: 1, total: 2, time: 'morning' },
          { day: 2, call: 2, total: 2, time: 'evening' },
          { day: 3, dateOffsetDays: 1 },
          { day: 5, dateOffsetDays: 2 },
          { day: 7, dateOffsetDays: 2 },
        ],
      },
      A: {
        label: 'Answered',
        steps: [
          { day: 1, dateOffsetDays: 1 },
          { day: 2, dateOffsetDays: 1 },
          { day: 3, dateOffsetDays: 1 },
        ],
      },
      M: { label: 'M', steps: [{}] },
      NS: {
        label: 'NS',
        steps: [
          { day: 1, dateOffsetDays: 1 },
          { day: 2, dateOffsetDays: 1 },
          { day: 3, dateOffsetDays: 1 },
        ],
      },
      MD: { label: 'MD', steps: [{}] },
      WP: { label: 'WP', steps: [{}] },
      // Day-less: its steps are identified by call/total alone.
      'SPLÁTKA': {
        label: 'SPLÁTKA',
        steps: [
          { call: 2, total: 2 },
          { call: 2, total: 3 },
          { call: 3, total: 3 },
        ],
      },
      REFUND: { label: 'REFUND', steps: [{}] },
      OPP: { label: 'OPP', steps: [{}] },
      ARCHIV: {
        label: 'ARCHIV',
        steps: [
          { day: 1, dateOffsetDays: 1 },
          { day: 2, dateOffsetDays: 1 },
          { day: 3, dateOffsetDays: 1 },
        ],
      },
    },
    modifiers: {},
  };

  var DEFAULTS = {
    notionApiKey: '',
    contactsDatabaseId: '',
    tasksDatabaseId: '',
    timezone: 'UTC',
    workflow: DEFAULT_WORKFLOW,
    // Default "HH:mm" for each time-of-day bucket the date/time pickers offer as input shortcuts —
    // sugar over a real stored datetime, never an encoded sentinel (ROADMAP.md Step 1). Unlike the
    // predecessor project (which used placeholder sentinel values here, e.g. '02:10', never meant as
    // literal clock times), these must be real times since Notion stores a real due datetime — confirm/
    // adjust in the Settings panel to match when mornings/afternoons/evenings actually mean for you.
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
