// requires: App.core.timezone, App.core.settings, App.tasks.timeBuckets, App.tasks.contactNameCache
'use strict';
App.tasks = App.tasks || {};
// Pure, unit-testable view + filter/sort computation. Takes decorated tasks (App.core.notionClient.
// decorateTask output) and returns filtered/sorted arrays — no DOM, no network. Every view (seeded or
// user-created) is a plain {id, name, filter, sort} record — see docs/notion-views-plan.md in the
// predecessor project for the design rationale (ROADMAP.md Step 3): there is no hardcoded BUILTIN_VIEWS
// list, just this reusable engine every view runs through. Ported near-verbatim from the predecessor's
// taskViews.js — this was already fully generic, no GHL coupling anywhere in the engine itself; only the
// FIELDS table's `get` functions change, from title-decode reads to direct decorated-task property reads.
App.tasks.taskViews = (function () {
  var BUCKET_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', allday: 'All day' };

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  // The due-date half, as a plain calendar-day Date (no time component) suitable for direct .getTime()
  // comparison against resolveDateOperand's output below. null when there's no due date at all.
  function getDueDateValue(task) {
    if (!task.due) return null;
    return startOfDay(App.core.timezone.toWallClock(task.due));
  }

  // The due-time half, as the same plain text a task row already displays (bucket labels, or a literal
  // "HH:mm" for a real, non-bucket time) — reused by App.ui.indicators.getDueTimeLabel so the row
  // display and the filter/sort text are always identical, never two independently-maintained copies.
  function getDueTimeText(task) {
    if (!task.due) return '';
    var wallClock = App.core.timezone.toWallClock(task.due);
    var hhmm = pad2(wallClock.getHours()) + ':' + pad2(wallClock.getMinutes());
    var bucket = App.tasks.timeBuckets.getBucketForTime(hhmm);
    return bucket ? BUCKET_LABELS[bucket] : hhmm;
  }

  // Turns a date-type condition's stored operand into a comparable calendar-day Date. Either the
  // sentinel 'today' (what every seeded default view uses, so it never goes stale day to day) or a
  // literal 'YYYY-MM-DD' from the Filter panel's date-picker value control.
  function resolveDateOperand(value, now) {
    if (value === 'today') return startOfDay(App.core.timezone.toWallClock(now || new Date()));
    if (!value) return null;
    var parts = String(value).split('-');
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  // --- Filter/Sort field table ---
  //
  // Each {label, type, get(task)}. `type` selects which OPERATORS_BY_TYPE entry (and which value control
  // in App.ui.filterSortBar) applies. `stage`'s options are resolved live off the current workflow
  // config rather than hardcoded. `status` is Notion's native 3-valued status (Planned/In progress/
  // Completed), a `select` field — more accurate than the predecessor's boolean `completed` checkbox,
  // which Notion's richer property type makes unnecessary.
  var FIELDS = {
    title: { label: 'Title', type: 'text', get: function (t) { return t.title || ''; } },
    stage: {
      label: 'Stage',
      type: 'select',
      options: function () { return Object.keys(App.core.settings.load().workflow.stages); },
      get: function (t) { return t.stage; },
    },
    day: { label: 'Day', type: 'number', get: function (t) { return t.day; } },
    call: { label: 'Call', type: 'number', get: function (t) { return t.call; } },
    dueDate: { label: 'Due date', type: 'date', get: getDueDateValue },
    dueTime: { label: 'Due time', type: 'text', get: getDueTimeText },
    contact: {
      label: 'Contact',
      type: 'text',
      get: function (t) { return App.tasks.contactNameCache.get(t.contactId) || ''; },
    },
    status: {
      label: 'Status',
      type: 'select',
      options: function () { return ['Planned', 'In progress', 'Completed']; },
      get: function (t) { return t.status; },
    },
  };

  var FIELD_ORDER = ['title', 'stage', 'day', 'call', 'dueDate', 'dueTime', 'contact', 'status'];

  // Sort-only pseudo-field — real Notion page metadata, no GHL-style "which field name is actually
  // 'last updated'" guessing needed.
  var SORT_ONLY_FIELDS = {
    lastUpdated: { label: 'Last updated', type: 'date', get: function (t) { return t.lastEditedTime; } },
  };

  function getSortField(id) {
    return FIELDS[id] || SORT_ONLY_FIELDS[id];
  }

  function isEmptyValue(value) {
    return value === null || value === undefined || value === '';
  }

  var OPERATORS_BY_TYPE = {
    text: {
      contains: function (v, op) { return String(v || '').toLowerCase().indexOf(String(op || '').toLowerCase()) !== -1; },
      notContains: function (v, op) { return !OPERATORS_BY_TYPE.text.contains(v, op); },
      equals: function (v, op) { return String(v || '').toLowerCase() === String(op || '').toLowerCase(); },
      notEquals: function (v, op) { return !OPERATORS_BY_TYPE.text.equals(v, op); },
      startsWith: function (v, op) { return String(v || '').toLowerCase().indexOf(String(op || '').toLowerCase()) === 0; },
      endsWith: function (v, op) {
        var s = String(v || '').toLowerCase();
        var suffix = String(op || '').toLowerCase();
        return suffix === '' || s.slice(-suffix.length) === suffix;
      },
      isEmpty: function (v) { return isEmptyValue(v); },
      isNotEmpty: function (v) { return !isEmptyValue(v); },
    },
    date: {
      is: function (v, op, now) { var o = resolveDateOperand(op, now); return v && o ? v.getTime() === o.getTime() : false; },
      isBefore: function (v, op, now) { var o = resolveDateOperand(op, now); return v && o ? v.getTime() < o.getTime() : false; },
      isAfter: function (v, op, now) { var o = resolveDateOperand(op, now); return v && o ? v.getTime() > o.getTime() : false; },
      isOnOrBefore: function (v, op, now) { var o = resolveDateOperand(op, now); return v && o ? v.getTime() <= o.getTime() : false; },
      isOnOrAfter: function (v, op, now) { var o = resolveDateOperand(op, now); return v && o ? v.getTime() >= o.getTime() : false; },
      isEmpty: function (v) { return !v; },
      isNotEmpty: function (v) { return !!v; },
    },
    number: {
      // notEquals is the negation of equals (not an independent isEmptyValue branch) so an empty/
      // no-value field reads as vacuously "not equal to N" — needed for views like "day != 1 OR call !=
      // 1" to still include bare-code stages that have no day/call at all.
      equals: function (v, op) { return isEmptyValue(v) ? false : Number(v) === Number(op); },
      notEquals: function (v, op) { return !OPERATORS_BY_TYPE.number.equals(v, op); },
      greaterThan: function (v, op) { return isEmptyValue(v) ? false : Number(v) > Number(op); },
      lessThan: function (v, op) { return isEmptyValue(v) ? false : Number(v) < Number(op); },
      isEmpty: function (v) { return isEmptyValue(v); },
      isNotEmpty: function (v) { return !isEmptyValue(v); },
    },
    select: {
      is: function (v, op) { return !isEmptyValue(v) && String(v) === String(op); },
      isNot: function (v, op) { return isEmptyValue(v) || String(v) !== String(op); },
      isEmpty: function (v) { return isEmptyValue(v); },
      isNotEmpty: function (v) { return !isEmptyValue(v); },
    },
    checkbox: {
      isChecked: function (v) { return v === true; },
      isUnchecked: function (v) { return v !== true; },
    },
  };

  // Order matters — App.ui.filterSortBar renders the condition submenu in this order.
  var OPERATOR_LABELS_BY_TYPE = {
    text: [
      { id: 'contains', label: 'contains' },
      { id: 'notContains', label: 'does not contain' },
      { id: 'equals', label: 'equals' },
      { id: 'notEquals', label: 'does not equal' },
      { id: 'startsWith', label: 'starts with' },
      { id: 'endsWith', label: 'ends with' },
      { id: 'isEmpty', label: 'is empty' },
      { id: 'isNotEmpty', label: 'is not empty' },
    ],
    date: [
      { id: 'is', label: 'is' },
      { id: 'isBefore', label: 'is before' },
      { id: 'isAfter', label: 'is after' },
      { id: 'isOnOrBefore', label: 'is on or before' },
      { id: 'isOnOrAfter', label: 'is on or after' },
      { id: 'isEmpty', label: 'is empty' },
      { id: 'isNotEmpty', label: 'is not empty' },
    ],
    number: [
      { id: 'equals', label: 'equals' },
      { id: 'notEquals', label: 'does not equal' },
      { id: 'greaterThan', label: 'greater than' },
      { id: 'lessThan', label: 'less than' },
      { id: 'isEmpty', label: 'is empty' },
      { id: 'isNotEmpty', label: 'is not empty' },
    ],
    select: [
      { id: 'is', label: 'is' },
      { id: 'isNot', label: 'is not' },
      { id: 'isEmpty', label: 'is empty' },
      { id: 'isNotEmpty', label: 'is not empty' },
    ],
    checkbox: [
      { id: 'isChecked', label: 'is checked' },
      { id: 'isUnchecked', label: 'is unchecked' },
    ],
  };

  // Conditions with no meaningful value control — App.ui.filterSortBar hides the value input entirely
  // for these.
  var VALUELESS_OPERATORS = { isEmpty: true, isNotEmpty: true, isChecked: true, isUnchecked: true };

  function evaluateCondition(condition, task, now) {
    var field = FIELDS[condition.field];
    if (!field) return false;
    var operator = OPERATORS_BY_TYPE[field.type] && OPERATORS_BY_TYPE[field.type][condition.operator];
    if (!operator) return false;
    return operator(field.get(task), condition.value, now);
  }

  // A filter node is either a leaf condition ({field, operator, value}) or a group ({op: 'AND'|'OR',
  // conditions: [node, ...]}); groups nest to any depth. An empty/missing node matches everything (a
  // brand new view with no conditions yet shouldn't hide every task while it's being built).
  function evaluateNode(node, task, now) {
    if (!node) return true;
    if (node.conditions) {
      if (node.conditions.length === 0) return true;
      var results = node.conditions.map(function (child) {
        return evaluateNode(child, task, now);
      });
      return node.op === 'OR' ? results.some(Boolean) : results.every(Boolean);
    }
    return evaluateCondition(node, task, now);
  }

  function buildPredicate(filterNode, now) {
    return function (task) {
      return evaluateNode(filterNode, task, now);
    };
  }

  function applyFilter(filterNode, tasks, now) {
    return (tasks || []).filter(buildPredicate(filterNode, now || new Date()));
  }

  // Blank/empty values always sort last regardless of direction. `sortRows`: [{field, direction:
  // 'asc'|'desc'}, ...] in priority order — the first row is the primary key, later rows only break
  // ties the earlier ones left.
  function compareValues(a, b, type) {
    var aEmpty = isEmptyValue(a) || (type === 'date' && !a);
    var bEmpty = isEmptyValue(b) || (type === 'date' && !b);
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (type === 'date') return a.getTime() - b.getTime();
    if (type === 'number') return Number(a) - Number(b);
    if (type === 'checkbox') return (a === b) ? 0 : (a ? 1 : -1);
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
  }

  function applySort(sortRows, tasks) {
    if (!sortRows || sortRows.length === 0) return tasks.slice();
    return tasks.slice().sort(function (a, b) {
      for (var i = 0; i < sortRows.length; i++) {
        var field = getSortField(sortRows[i].field);
        if (!field) continue;
        var cmp = compareValues(field.get(a), field.get(b), field.type);
        if (cmp !== 0) return sortRows[i].direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  // "Forgotten" = incomplete + due date in the past — the timeline's own status tag, distinct from the
  // tag-color bucket system in App.ui.indicators.
  function timelineStatus(task, now) {
    if (task.status === 'Completed') return 'completed';
    if (task.due && task.due.getTime() < now.getTime()) return 'forgotten';
    return 'incomplete';
  }

  // Grouped by calendar day, ascending, in the configured timezone — not the browser's. Tasks without a
  // due date are excluded — the timeline is explicitly about calendar-day placement. Timeline stays a
  // fixed pinned tab — a bar-graph day-grouping, not a filterable table, deliberately outside the
  // FIELDS/filter system above.
  function timeline(tasks, now) {
    now = now || new Date();
    var groups = {};
    tasks.forEach(function (task) {
      if (!task.due) return;
      var wallClock = App.core.timezone.toWallClock(task.due);
      var key = dayKey(wallClock);
      if (!groups[key]) {
        groups[key] = { dayKey: key, date: new Date(wallClock.getFullYear(), wallClock.getMonth(), wallClock.getDate()), tasks: [] };
      }
      groups[key].tasks.push(Object.assign({}, task, { timelineStatus: timelineStatus(task, now) }));
    });
    return Object.keys(groups)
      .map(function (key) {
        return groups[key];
      })
      .sort(function (a, b) {
        return a.date.getTime() - b.date.getTime();
      });
  }

  return {
    getDueTimeText: getDueTimeText,
    timeline: timeline,
    FIELDS: FIELDS,
    FIELD_ORDER: FIELD_ORDER,
    SORT_ONLY_FIELDS: SORT_ONLY_FIELDS,
    getSortField: getSortField,
    OPERATORS_BY_TYPE: OPERATORS_BY_TYPE,
    OPERATOR_LABELS_BY_TYPE: OPERATOR_LABELS_BY_TYPE,
    VALUELESS_OPERATORS: VALUELESS_OPERATORS,
    resolveDateOperand: resolveDateOperand,
    evaluateNode: evaluateNode,
    buildPredicate: buildPredicate,
    applyFilter: applyFilter,
    applySort: applySort,
  };
})();
