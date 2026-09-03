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

  // Self-seeds one default "All tasks" view on first use so the tab bar is never empty — remove()
  // refuses to delete the last remaining view, mirroring Notion's own "at least one view" rule.
  function ensureSeeded(settings) {
    if (settings.views && settings.views.length) return settings;
    settings.views = [{ id: makeId(), name: 'All tasks', filter: null, sort: [{ field: 'dueDate', direction: 'asc' }] }];
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
