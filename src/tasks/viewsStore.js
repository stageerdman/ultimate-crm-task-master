// requires: App.core.settings
'use strict';
App.tasks = App.tasks || {};
// CRUD over the full editable view list — every tab in the full-screen window's daily-queue/table area
// (seeded default or user-created) is one {id, name, filter, sort} record here, not a hardcoded
// function (docs/notion-views-plan.md in the predecessor project — ROADMAP.md Step 3 adopts this
// architecture from the start rather than re-deriving it later). Timeline/Settings stay fixed pinned
// tabs in App.ui.fullScreen, entirely outside this store.
App.tasks.viewsStore = (function () {
  function makeId() {
    return 'view_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function cond(field, operator, value) {
    var c = { field: field, operator: operator };
    if (value !== undefined) c.value = value;
    return c;
  }

  function group(op, conditions) {
    return { op: op, conditions: conditions };
  }

  // The 4 daily-queue views below all end in the same "due today (regardless of status) OR (overdue and
  // still not completed)" clause, reused by reference rather than duplicated 4 times.
  var TODAY_OR_OVERDUE_INCOMPLETE = group('OR', [
    cond('dueDate', 'is', 'today'),
    group('AND', [cond('dueDate', 'isBefore', 'today'), cond('status', 'isNot', 'Completed')]),
  ]);

  // Ported verbatim from the owner's real GHL-tasks-userscript seeded views (src/payload/settings.js
  // DEFAULT_VIEWS) — the actual daily-driver view set, not a placeholder. Only the completed-checkbox
  // conditions changed shape (`completed isChecked/isUnchecked` -> `status is/isNot 'Completed'`), since
  // Notion's native 3-valued status property replaces the predecessor's boolean checkbox.
  var DEFAULT_VIEWS = [
    {
      id: 'firstReachOut',
      name: 'First Reach-Out',
      filter: group('AND', [
        cond('stage', 'isNot', 'NA'),
        cond('stage', 'isNot', 'ARCHIV'),
        cond('day', 'equals', 1),
        cond('call', 'equals', 1),
        TODAY_OR_OVERDUE_INCOMPLETE,
      ]),
      sort: [],
    },
    {
      id: 'secondPriority',
      name: 'Second Priority',
      filter: group('AND', [
        cond('stage', 'isNot', 'NA'),
        cond('stage', 'isNot', 'ARCHIV'),
        group('OR', [cond('day', 'notEquals', 1), cond('call', 'notEquals', 1)]),
        TODAY_OR_OVERDUE_INCOMPLETE,
      ]),
      sort: [],
    },
    {
      id: 'na',
      name: 'NA',
      filter: group('AND', [cond('stage', 'is', 'NA'), TODAY_OR_OVERDUE_INCOMPLETE]),
      sort: [],
    },
    {
      id: 'archive',
      name: 'Archive',
      filter: group('AND', [cond('stage', 'is', 'ARCHIV'), TODAY_OR_OVERDUE_INCOMPLETE]),
      sort: [],
    },
    {
      id: 'recents',
      name: 'Recents',
      filter: null,
      sort: [{ field: 'lastUpdated', direction: 'desc' }],
    },
    {
      id: 'completed',
      name: 'Completed',
      filter: group('AND', [cond('status', 'is', 'Completed')]),
      sort: [],
    },
  ];

  // Self-seeds the real default view set on first use so the tab bar is never empty — remove() refuses
  // to delete the last remaining view, mirroring Notion's own "at least one view" rule.
  function ensureSeeded(settings) {
    if (settings.views && settings.views.length) return settings;
    settings.views = DEFAULT_VIEWS.map(function (v) {
      return Object.assign({}, v, { id: v.id });
    });
    App.core.settings.save(settings);
    return settings;
  }

  function list() {
    return ensureSeeded(App.core.settings.load()).views || [];
  }

  function get(id) {
    return list().filter(function (v) { return v.id === id; })[0] || null;
  }

  function create(name) {
    var settings = ensureSeeded(App.core.settings.load());
    var view = { id: makeId(), name: name || 'New view', filter: null, sort: [] };
    settings.views = (settings.views || []).concat([view]);
    App.core.settings.save(settings);
    return view;
  }

  function update(id, patch) {
    var settings = ensureSeeded(App.core.settings.load());
    var found = null;
    settings.views = (settings.views || []).map(function (v) {
      if (v.id !== id) return v;
      found = Object.assign({}, v, patch);
      return found;
    });
    if (!found) return null;
    App.core.settings.save(settings);
    return found;
  }

  function rename(id, name) {
    return update(id, { name: name });
  }

  // Refuses to delete the last remaining view — returns false without touching storage rather than
  // silently leaving an unusable empty tab bar. Callers must check the return value before assuming the
  // tab is gone.
  function remove(id) {
    var settings = ensureSeeded(App.core.settings.load());
    var views = settings.views || [];
    if (views.length <= 1) return false;
    var next = views.filter(function (v) { return v.id !== id; });
    if (next.length === views.length) return false;
    settings.views = next;
    App.core.settings.save(settings);
    return true;
  }

  return {
    list: list,
    get: get,
    create: create,
    update: update,
    rename: rename,
    remove: remove,
  };
})();
