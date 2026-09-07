// requires: App.tasks.taskViews, App.tasks.viewsStore, App.ui.datePicker, App.ui.floatingPanel
'use strict';
App.ui = App.ui || {};
// Notion-style Filter/Sort toolbar (docs/notion-views-plan.md Phase C — implements
// App_Filter_Sort_UI_Spec.docx section-by-section, generalized from the doc's 4 example properties to
// this app's real 8-property App.tasks.taskViews.FIELDS table, and extended with recursive AND/OR
// filter groups per the plan's "Overdue rule" decision). Mounted once above the task list in
// App.ui.fullScreen, same lifecycle as App.ui.indicators.createBadge — `setView(view)` swaps which
// stored view is being edited (called on every tab switch), `onChange(id, patch)` fires on every
// committed edit so the caller can recompute/re-render the visible task list immediately, no Save button.
App.ui.filterSortBar = (function () {
  var ICON_FUNNEL =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><polygon points="4 4 20 4 14 12.5 14 19 10 21 10 12.5"></polygon></svg>';
  var ICON_SORT =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg>';
  var ICON_SEARCH =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  var ICON_CHEVRON =
    '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
  var ICON_CHECK =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var ICON_REMOVE =
    '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var ICON_PLUS =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

  var TYPE_ICONS = {
    title: '<svg viewBox="0 0 24 24" width="14" height="14"><text x="1" y="17" font-size="14" font-weight="700" fill="currentColor">Aa</text></svg>',
    stage:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 12 22 2 12V2h10l10.6 10.6a2 2 0 0 1 0 2.8z"></path><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"></circle></svg>',
    day: '<svg viewBox="0 0 24 24" width="14" height="14"><text x="0" y="17" font-size="14" font-weight="700" fill="currentColor">#</text></svg>',
    call: '<svg viewBox="0 0 24 24" width="14" height="14"><text x="0" y="17" font-size="14" font-weight="700" fill="currentColor">#</text></svg>',
    dueDate:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect>' +
      '<line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="16" y1="2" x2="16" y2="6"></line></svg>',
    dueTime:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline></svg>',
    contact:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"></path></svg>',
    status:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"></rect><polyline points="7 12 10.5 15.5 17 8.5"></polyline></svg>',
    lastUpdated:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline></svg>',
  };

  var TYPE_HINTS = { text: 'Text', date: 'Date', number: 'Number', select: 'Select', checkbox: 'Checkbox' };

  function fieldMeta(id) {
    return App.tasks.taskViews.getSortField(id);
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function countLeafConditions(node) {
    if (!node) return 0;
    if (node.conditions) {
      return node.conditions.reduce(function (sum, child) { return sum + countLeafConditions(child); }, 0);
    }
    return 1;
  }

  function isGroupNode(node) {
    return !!(node && node.conditions);
  }

  function normalizeGroup(node) {
    return isGroupNode(node) ? node : { op: 'AND', conditions: [] };
  }

  // config: { container, onChange(viewId, patch) }
  function mount(config) {
    var container = config.container;
    var onChange = config.onChange || function () {};

    var currentView = null;
    var draftFilter = null; // always a {op, conditions} group while a view is active — normalizeGroup()
    var draftSort = [];
    var openPopoverCloser = null; // closes whatever popover/submenu is currently open, if any

    var bar = el('div', 'crmtm-fsb-toolbar');
    var filterWrap = el('div', 'crmtm-fsb-btn-wrap');
    var sortWrap = el('div', 'crmtm-fsb-btn-wrap');
    var filterBtn = el('button', 'crmtm-fsb-btn');
    filterBtn.type = 'button';
    var sortBtn = el('button', 'crmtm-fsb-btn');
    sortBtn.type = 'button';
    filterWrap.appendChild(filterBtn);
    sortWrap.appendChild(sortBtn);
    bar.appendChild(filterWrap);
    bar.appendChild(sortWrap);
    container.appendChild(bar);

    var filterPanel = el('div', 'crmtm-fsb-panel');
    filterPanel.hidden = true;
    filterWrap.appendChild(filterPanel);

    var sortPanel = el('div', 'crmtm-fsb-panel');
    sortPanel.hidden = true;
    sortWrap.appendChild(sortPanel);

    function closeAnyPopover() {
      if (openPopoverCloser) {
        var closer = openPopoverCloser;
        openPopoverCloser = null;
        closer();
      }
    }

    // Property picker + condition submenu both open through the shared App.ui.floatingPanel.openPortal
    // (see floatingPanel.js) rather than a locally-positioned child: that's what keeps them from being
    // clipped by .crmtm-fsb-panel's `overflow-y: auto` (needed since condition lists can get long), and
    // what makes onDocMouseDownClosePanels below correctly recognize a click landing in one of these as
    // "still inside the filter/sort panel" even though, post-portal, it's no longer a DOM descendant of
    // filterWrap/sortWrap.
    function openPopover(anchorWrap, className, build) {
      closeAnyPopover();
      var portal = App.ui.floatingPanel.openPortal(anchorWrap, className, build);
      openPopoverCloser = portal.close;
      return portal.close;
    }

    // Property picker (spec §4.1) — search + list, shared by Filter's "+ Add filter" and Sort's
    // "+ Add sort"/re-clickable property chip. `fieldIds` is the candidate list (FIELD_ORDER for Filter,
    // FIELD_ORDER + 'lastUpdated' for Sort); `exclude` optionally hides fields already used at this level
    // (only applied for Filter, matching the doc's "no more properties to filter by" §4.5 rule for its
    // 4-property example — extended here to "no duplicate field within the same group").
    function openPropertyPicker(anchorWrap, fieldIds, onPick) {
      openPopover(anchorWrap, 'crmtm-fsb-picker', function (pop) {
        var searchRow = el('div', 'crmtm-fsb-picker-search');
        var searchIcon = el('span', 'crmtm-fsb-picker-search-icon');
        searchIcon.innerHTML = ICON_SEARCH;
        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Filter by…';
        input.className = 'crmtm-fsb-picker-input';
        searchRow.appendChild(searchIcon);
        searchRow.appendChild(input);
        pop.appendChild(searchRow);

        var list = el('div', 'crmtm-fsb-picker-list');
        pop.appendChild(list);

        function render(query) {
          list.innerHTML = '';
          var q = (query || '').toLowerCase();
          var matches = fieldIds.filter(function (id) {
            var meta = fieldMeta(id);
            return meta && meta.label.toLowerCase().indexOf(q) !== -1;
          });
          if (matches.length === 0) {
            list.appendChild(el('div', 'crmtm-fsb-picker-empty', 'No more properties to filter by'));
            return;
          }
          matches.forEach(function (id) {
            var meta = fieldMeta(id);
            var row = el('button', 'crmtm-fsb-picker-row');
            row.type = 'button';
            var icon = el('span', 'crmtm-fsb-picker-row-icon');
            icon.innerHTML = TYPE_ICONS[id] || '';
            var name = el('span', 'crmtm-fsb-picker-row-name', meta.label);
            var hint = el('span', 'crmtm-fsb-picker-row-hint', TYPE_HINTS[meta.type] || '');
            row.appendChild(icon);
            row.appendChild(name);
            row.appendChild(hint);
            row.addEventListener('mousedown', function (e) { e.preventDefault(); });
            row.addEventListener('click', function () { onPick(id); });
            list.appendChild(row);
          });
        }
        input.addEventListener('input', function () { render(input.value); });
        render('');
        setTimeout(function () { input.focus(); }, 0);
      });
    }

    // Condition submenu (spec §4.3) — anchored at `chipWrap` (the condition chip's own
    // position:relative wrapper), left offset 132px per the doc.
    function openConditionSubmenu(chipWrap, type, currentOperator, onPick) {
      openPopover(chipWrap, 'crmtm-fsb-condmenu', function (pop) {
        (App.tasks.taskViews.OPERATOR_LABELS_BY_TYPE[type] || []).forEach(function (opDef) {
          var row = el('button', 'crmtm-fsb-condmenu-row' + (opDef.id === currentOperator ? ' is-selected' : ''));
          row.type = 'button';
          row.appendChild(el('span', null, opDef.label));
          if (opDef.id === currentOperator) {
            var check = el('span', 'crmtm-fsb-condmenu-check');
            check.innerHTML = ICON_CHECK;
            row.appendChild(check);
          }
          row.addEventListener('mousedown', function (e) { e.preventDefault(); });
          row.addEventListener('click', function () { onPick(opDef.id); });
          pop.appendChild(row);
        });
      });
    }

    // --- Value input, one per type (spec §4.4, extended to number/select/checkbox) ---
    function buildValueInput(wrap, condition, onCommit) {
      // App.ui.datePicker portals its dropdown outside `wrap` once opened (see datePicker.js), so simply
      // clearing `wrap.innerHTML` on a rebuild — every renderGroup() pass rebuilds every row from
      // scratch — would leave a previously-opened calendar (and its document mousedown/keydown
      // listeners) orphaned in the real page's DOM forever instead of being torn down along with it.
      if (wrap._crmtmDatePicker) {
        wrap._crmtmDatePicker.destroy();
        wrap._crmtmDatePicker = null;
      }
      wrap.innerHTML = '';
      if (App.tasks.taskViews.VALUELESS_OPERATORS[condition.operator]) return;
      var field = App.tasks.taskViews.FIELDS[condition.field];
      if (!field) return;

      if (field.type === 'text') {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'crmtm-fsb-value-input';
        input.value = condition.value || '';
        input.addEventListener('change', function () { condition.value = input.value; onCommit(); });
        wrap.appendChild(input);
        return;
      }
      if (field.type === 'number') {
        var numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.className = 'crmtm-fsb-value-input';
        numInput.value = condition.value === undefined || condition.value === null ? '' : condition.value;
        numInput.addEventListener('change', function () {
          condition.value = numInput.value === '' ? null : Number(numInput.value);
          onCommit();
        });
        wrap.appendChild(numInput);
        return;
      }
      if (field.type === 'select') {
        var select = document.createElement('select');
        select.className = 'crmtm-fsb-value-select';
        (field.options ? field.options() : []).forEach(function (opt) {
          var o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          select.appendChild(o);
        });
        select.value = condition.value || '';
        select.addEventListener('change', function () { condition.value = select.value; onCommit(); });
        wrap.appendChild(select);
        return;
      }
      if (field.type === 'date') {
        var dpMount = el('div', 'crmtm-fsb-date-value');
        wrap.appendChild(dpMount);
        var dp = App.ui.datePicker.create({
          container: dpMount,
          getState: function () {
            if (condition.value === 'today') return { mode: 'today', date: null };
            if (!condition.value) return { mode: null, date: null };
            var parts = condition.value.split('-');
            return { mode: 'custom', date: new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) };
          },
          onChange: function (mode, date) {
            if (mode === 'today') {
              condition.value = 'today';
            } else if (mode) {
              var resolved = App.ui.datePicker.resolveDate(mode, date, new Date());
              condition.value = resolved
                ? resolved.getFullYear() + '-' + (resolved.getMonth() + 1) + '-' + resolved.getDate()
                : null;
            } else {
              condition.value = null;
            }
            onCommit();
            dp.refresh();
          },
        });
        wrap._crmtmDatePicker = dp;
      }
    }

    // --- Recursive filter-tree rendering (spec §4.2/§4.5, extended with nested groups per
    // docs/notion-views-plan.md's "Overdue rule" decision) ---
    function renderConditionRow(condition, usedFieldIds, onRemove, onCommit) {
      var row = el('div', 'crmtm-fsb-row');

      var propChipWrap = el('div', 'crmtm-fsb-chip-wrap');
      var propChip = el('div', 'crmtm-fsb-prop-chip');
      var meta = fieldMeta(condition.field);
      var propIcon = el('span', 'crmtm-fsb-chip-icon');
      propIcon.innerHTML = TYPE_ICONS[condition.field] || '';
      propChip.appendChild(propIcon);
      propChip.appendChild(el('span', null, meta ? meta.label : condition.field));
      propChipWrap.appendChild(propChip);
      row.appendChild(propChipWrap);

      var condChipWrap = el('div', 'crmtm-fsb-chip-wrap');
      var condChip = el('button', 'crmtm-fsb-cond-chip');
      condChip.type = 'button';
      var condLabels = App.tasks.taskViews.OPERATOR_LABELS_BY_TYPE[meta.type] || [];
      var currentLabel = (condLabels.filter(function (o) { return o.id === condition.operator; })[0] || condLabels[0] || {}).label || '';
      condChip.appendChild(el('span', 'crmtm-fsb-cond-chip-label', currentLabel));
      var chevron = el('span', 'crmtm-fsb-chip-chevron');
      chevron.innerHTML = ICON_CHEVRON;
      condChip.appendChild(chevron);
      condChip.addEventListener('click', function () {
        openConditionSubmenu(condChipWrap, meta.type, condition.operator, function (opId) {
          condition.operator = opId;
          if (App.tasks.taskViews.VALUELESS_OPERATORS[opId]) delete condition.value;
          closeAnyPopover();
          onCommit();
        });
      });
      condChipWrap.appendChild(condChip);
      row.appendChild(condChipWrap);

      var valueWrap = el('div', 'crmtm-fsb-value-wrap');
      buildValueInput(valueWrap, condition, onCommit);
      row.appendChild(valueWrap);

      var removeBtn = el('button', 'crmtm-fsb-remove');
      removeBtn.type = 'button';
      removeBtn.innerHTML = ICON_REMOVE;
      removeBtn.addEventListener('click', onRemove);
      row.appendChild(removeBtn);

      return row;
    }

    function renderDivider(op, onToggle) {
      var divider = el('div', 'crmtm-fsb-divider');
      var label = el('button', 'crmtm-fsb-divider-label', op);
      label.type = 'button';
      label.addEventListener('click', onToggle);
      divider.appendChild(label);
      divider.appendChild(el('div', 'crmtm-fsb-divider-rule'));
      return divider;
    }

    // `node` is always a {op, conditions} group. Renders into `wrap`, calling `onCommit` after any
    // in-place mutation of the tree (the caller owns persistence — see commitFilter below).
    function renderGroup(node, wrap, depth, onCommit) {
      wrap.innerHTML = '';
      node.conditions.forEach(function (child, index) {
        if (index > 0) {
          wrap.appendChild(renderDivider(node.op, function () {
            node.op = node.op === 'AND' ? 'OR' : 'AND';
            renderGroup(node, wrap, depth, onCommit);
            onCommit();
          }));
        }
        if (isGroupNode(child)) {
          var groupBox = el('div', 'crmtm-fsb-group');
          var header = el('div', 'crmtm-fsb-group-header');
          header.appendChild(el('span', 'crmtm-fsb-group-label', 'Nested group'));
          var removeGroupBtn = el('button', 'crmtm-fsb-remove');
          removeGroupBtn.type = 'button';
          removeGroupBtn.innerHTML = ICON_REMOVE;
          removeGroupBtn.addEventListener('click', function () {
            node.conditions.splice(index, 1);
            renderGroup(node, wrap, depth, onCommit);
            onCommit();
          });
          header.appendChild(removeGroupBtn);
          groupBox.appendChild(header);
          var inner = el('div', 'crmtm-fsb-group-body');
          groupBox.appendChild(inner);
          renderGroup(child, inner, depth + 1, onCommit);
          wrap.appendChild(groupBox);
        } else {
          var usedIds = node.conditions.filter(function (c) { return !isGroupNode(c); }).map(function (c) { return c.field; });
          var row = renderConditionRow(child, usedIds, function () {
            node.conditions.splice(index, 1);
            renderGroup(node, wrap, depth, onCommit);
            onCommit();
          }, onCommit);
          wrap.appendChild(row);
        }
      });

      var addRow = el('div', 'crmtm-fsb-add-row');
      var addFilterWrap = el('div', 'crmtm-fsb-picker-anchor');
      var addFilterBtn = el('button', 'crmtm-fsb-add-btn');
      addFilterBtn.type = 'button';
      var plusIcon = el('span', 'crmtm-fsb-add-icon');
      plusIcon.innerHTML = ICON_PLUS;
      addFilterBtn.appendChild(plusIcon);
      addFilterBtn.appendChild(el('span', null, node.conditions.length === 0 ? 'Add filter' : '+ Add filter'));
      addFilterBtn.addEventListener('click', function () {
        openPropertyPicker(addFilterWrap, App.tasks.taskViews.FIELD_ORDER, function (fieldId) {
          var meta = fieldMeta(fieldId);
          var defaultOp = (App.tasks.taskViews.OPERATOR_LABELS_BY_TYPE[meta.type] || [])[0];
          node.conditions.push({ field: fieldId, operator: defaultOp ? defaultOp.id : 'equals' });
          closeAnyPopover();
          renderGroup(node, wrap, depth, onCommit);
          onCommit();
        });
      });
      addFilterWrap.appendChild(addFilterBtn);
      addRow.appendChild(addFilterWrap);

      // "+ Add filter group" (docs/notion-views-plan.md's real-OR/group decision — not in the doc,
      // needed so the seeded daily-queue views' nested "today OR overdue-incomplete" shape stays fully
      // user-editable, not just displayable).
      var addGroupBtn = el('button', 'crmtm-fsb-add-btn crmtm-fsb-add-group');
      addGroupBtn.type = 'button';
      var groupPlusIcon = el('span', 'crmtm-fsb-add-icon');
      groupPlusIcon.innerHTML = ICON_PLUS;
      addGroupBtn.appendChild(groupPlusIcon);
      addGroupBtn.appendChild(el('span', null, 'Add filter group'));
      addGroupBtn.addEventListener('click', function () {
        node.conditions.push({ op: 'AND', conditions: [] });
        renderGroup(node, wrap, depth, onCommit);
        onCommit();
      });
      addRow.appendChild(addGroupBtn);

      wrap.appendChild(addRow);
    }

    function commitFilter() {
      var persisted = draftFilter.conditions.length === 0 ? null : draftFilter;
      currentView.filter = persisted;
      App.tasks.viewsStore.update(currentView.id, { filter: persisted });
      onChange(currentView.id, { filter: persisted });
      renderToolbarState();
    }

    function renderFilterPanel() {
      filterPanel.innerHTML = '';
      renderGroup(draftFilter, filterPanel, 0, commitFilter);
    }

    // --- Sort panel (spec §5) ---
    function renderSortRow(row, index) {
      var rowEl = el('div', 'crmtm-fsb-row crmtm-fsb-sort-row');

      var propChipWrap = el('div', 'crmtm-fsb-chip-wrap');
      var propChip = el('button', 'crmtm-fsb-prop-chip crmtm-fsb-prop-chip-clickable');
      propChip.type = 'button';
      var meta = fieldMeta(row.field);
      var propIcon = el('span', 'crmtm-fsb-chip-icon');
      propIcon.innerHTML = TYPE_ICONS[row.field] || '';
      propChip.appendChild(propIcon);
      propChip.appendChild(el('span', null, meta ? meta.label : row.field));
      propChip.addEventListener('click', function () {
        openPropertyPicker(propChipWrap, App.tasks.taskViews.FIELD_ORDER.concat(['lastUpdated']), function (fieldId) {
          row.field = fieldId;
          closeAnyPopover();
          commitSort();
        });
      });
      propChipWrap.appendChild(propChip);
      rowEl.appendChild(propChipWrap);

      var toggle = el('div', 'crmtm-fsb-direction-toggle');
      ['asc', 'desc'].forEach(function (dir) {
        var seg = el('button', 'crmtm-fsb-direction-seg' + (row.direction === dir ? ' is-selected' : ''), dir === 'asc' ? 'Asc' : 'Desc');
        seg.type = 'button';
        seg.addEventListener('click', function () { row.direction = dir; commitSort(); });
        toggle.appendChild(seg);
      });
      rowEl.appendChild(toggle);

      var removeBtn = el('button', 'crmtm-fsb-remove');
      removeBtn.type = 'button';
      removeBtn.innerHTML = ICON_REMOVE;
      removeBtn.addEventListener('click', function () {
        draftSort.splice(index, 1);
        renderSortPanel();
        commitSort();
      });
      rowEl.appendChild(removeBtn);

      // Drag-to-reorder (spec §5.3) — a small purpose-built pointer-index-swap (no drag library
      // anywhere in this codebase, see docs/notion-views-plan.md's "Current state" section), started
      // from the property chip.
      propChip.addEventListener('mousedown', function (downEvent) {
        var startY = downEvent.clientY;
        var dragging = false;
        function onMove(moveEvent) {
          if (!dragging && Math.abs(moveEvent.clientY - startY) < 4) return;
          dragging = true;
          rowEl.classList.add('is-dragging');
          var siblings = Array.prototype.slice.call(sortListEl.querySelectorAll('.crmtm-fsb-sort-row'));
          var myIndex = siblings.indexOf(rowEl);
          siblings.forEach(function (sib, i) {
            if (sib === rowEl) return;
            var rect = sib.getBoundingClientRect();
            var mid = rect.top + rect.height / 2;
            if (moveEvent.clientY < mid && i < myIndex) {
              var moved = draftSort.splice(myIndex, 1)[0];
              draftSort.splice(i, 0, moved);
              renderSortPanel();
              commitSortSilently();
            } else if (moveEvent.clientY > mid && i > myIndex) {
              var moved2 = draftSort.splice(myIndex, 1)[0];
              draftSort.splice(i, 0, moved2);
              renderSortPanel();
              commitSortSilently();
            }
          });
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          if (dragging) commitSort();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      return rowEl;
    }

    var sortListEl = null;

    function commitSortSilently() {
      currentView.sort = draftSort.slice();
    }

    function commitSort() {
      currentView.sort = draftSort.slice();
      App.tasks.viewsStore.update(currentView.id, { sort: currentView.sort });
      onChange(currentView.id, { sort: currentView.sort });
      renderToolbarState();
    }

    function renderSortPanel() {
      sortPanel.innerHTML = '';
      sortListEl = el('div', 'crmtm-fsb-sort-list');
      draftSort.forEach(function (row, index) {
        sortListEl.appendChild(renderSortRow(row, index));
      });
      sortPanel.appendChild(sortListEl);

      var addWrap = el('div', 'crmtm-fsb-picker-anchor');
      var addBtn = el('button', 'crmtm-fsb-add-btn');
      addBtn.type = 'button';
      var plusIcon = el('span', 'crmtm-fsb-add-icon');
      plusIcon.innerHTML = ICON_PLUS;
      addBtn.appendChild(plusIcon);
      addBtn.appendChild(el('span', null, 'Add sort'));
      addBtn.addEventListener('click', function () {
        openPropertyPicker(addWrap, App.tasks.taskViews.FIELD_ORDER.concat(['lastUpdated']), function (fieldId) {
          draftSort.push({ field: fieldId, direction: 'asc' });
          closeAnyPopover();
          renderSortPanel();
          commitSort();
        });
      });
      addWrap.appendChild(addBtn);
      sortPanel.appendChild(addWrap);
    }

    // --- Toolbar button states (spec §3) ---
    function renderToolbarBtn(btn, kind, count, activeLabel) {
      btn.innerHTML = '';
      btn.classList.remove('is-active');
      var icon = el('span', 'crmtm-fsb-btn-icon');
      icon.innerHTML = kind === 'filter' ? ICON_FUNNEL : ICON_SORT;
      btn.appendChild(icon);
      if (count === 0) {
        btn.appendChild(el('span', null, kind === 'filter' ? 'Filter' : 'Sort'));
        return;
      }
      btn.classList.add('is-active');
      if (count === 1) {
        btn.appendChild(el('span', null, activeLabel));
        return;
      }
      btn.appendChild(el('span', null, kind === 'filter' ? 'Filter' : 'Sort'));
      var badge = el('span', 'crmtm-fsb-badge', '' + count);
      btn.appendChild(badge);
    }

    function renderToolbarState() {
      var filterCount = countLeafConditions(draftFilter);
      var firstFilterField = filterCount === 1 && !isGroupNode(draftFilter.conditions[0])
        ? fieldMeta(draftFilter.conditions[0].field)
        : null;
      renderToolbarBtn(filterBtn, 'filter', filterCount, firstFilterField ? firstFilterField.label : '');

      var sortCount = draftSort.length;
      var firstSortField = sortCount === 1 ? fieldMeta(draftSort[0].field) : null;
      renderToolbarBtn(sortBtn, 'sort', sortCount, firstSortField ? firstSortField.label : '');
    }

    function toggleFilterPanel() {
      closeAnyPopover();
      sortPanel.hidden = true;
      filterPanel.hidden = !filterPanel.hidden;
      if (!filterPanel.hidden) renderFilterPanel();
    }

    function toggleSortPanel() {
      closeAnyPopover();
      filterPanel.hidden = true;
      sortPanel.hidden = !sortPanel.hidden;
      if (!sortPanel.hidden) renderSortPanel();
    }

    filterBtn.addEventListener('click', toggleFilterPanel);
    sortBtn.addEventListener('click', toggleSortPanel);

    function onDocMouseDownClosePanels(e) {
      // A click inside an open portal (the property picker, the condition submenu, or a value input's
      // own flyout like the date picker) is never "outside" the filter/sort panel it was opened from,
      // even though composedPath() won't include filterWrap/sortWrap post-portal — see floatingPanel.js.
      // Without this guard, picking a filter property or a condition operator force-closed the whole
      // panel out from under the click that was supposed to just make a selection.
      if (App.ui.floatingPanel.isEventInPortal(e)) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (!filterPanel.hidden && path.indexOf(filterWrap) === -1) filterPanel.hidden = true;
      if (!sortPanel.hidden && path.indexOf(sortWrap) === -1) sortPanel.hidden = true;
    }
    function onDocKeyDownClosePanels(e) {
      if (e.key !== 'Escape') return;
      if (!filterPanel.hidden) filterPanel.hidden = true;
      if (!sortPanel.hidden) sortPanel.hidden = true;
    }
    document.addEventListener('mousedown', onDocMouseDownClosePanels, true);
    document.addEventListener('keydown', onDocKeyDownClosePanels, true);

    // fullScreen.js calls setView(view) on every render pass, including the ones its own onChange
    // triggers right after a filter/sort edit commits (commitFilter/commitSort -> onChange ->
    // renderContent -> setView) — every single edit was re-entering this function and unconditionally
    // force-closing whatever panel the user had just been editing. Only reset panel visibility (and the
    // in-progress draft) when the view actually changed; re-affirming the same view mid-edit is a no-op
    // besides refreshing the toolbar button labels.
    function setView(view) {
      var isSameView = currentView && currentView.id === view.id;
      currentView = view;
      if (isSameView) {
        renderToolbarState();
        return;
      }
      draftFilter = normalizeGroup(view.filter);
      draftSort = (view.sort || []).slice();
      filterPanel.hidden = true;
      sortPanel.hidden = true;
      closeAnyPopover();
      renderToolbarState();
    }

    function destroy() {
      closeAnyPopover();
      document.removeEventListener('mousedown', onDocMouseDownClosePanels, true);
      document.removeEventListener('keydown', onDocKeyDownClosePanels, true);
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }

    function setVisible(visible) {
      bar.style.display = visible ? '' : 'none';
      if (!visible) {
        closeAnyPopover();
        filterPanel.hidden = true;
        sortPanel.hidden = true;
      }
    }

    return { setView: setView, setVisible: setVisible, destroy: destroy };
  }

  return { mount: mount };
})();
