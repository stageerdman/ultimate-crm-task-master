// requires: App.core.log, App.core.notionClient, App.core.timezone, App.tasks.taskViews,
// App.tasks.taskStore, App.tasks.viewsStore, App.tasks.contactNameCache, App.ui.indicators,
// App.ui.filterSortBar, App.ui.settingsPanel, App.ui.taskEditPanel, App.ui.followUpPrompt
'use strict';
App.ui = App.ui || {};
// The full-screen panel's body: a tab bar for every stored view (Notion-style, fully add/edit/delete-
// able, backed by App.tasks.viewsStore) plus 2 fixed pinned tabs (Timeline, Settings), a Notion-style
// Filter/Sort toolbar (App.ui.filterSortBar) above the task list for whichever view is active, and a
// manual refresh control. Reads its dataset from App.tasks.taskStore (never fetches directly) and never
// mutates a row's displayed state until the server has confirmed the change — except the one deliberate
// exception (toggleCompleted below), ported from the predecessor unchanged. GHL Fast-Nav ("Performance
// Mode") and Lost n Found are dropped entirely — both were GHL-specific, out of scope here.
App.ui.fullScreen = (function () {
  // opts.onCollapseToDot: called right before navigating to a contact so the widget starts back up as a
  // dot instead of full-screen once the contact page finishes loading — supplied by src/ui/shell.js.
  function mount(container, opts) {
    opts = opts || {};
    var collapseToDot = opts.onCollapseToDot || function () {};

    var wrap = document.createElement('div');
    wrap.className = 'crmtm-fs';
    container.appendChild(wrap);

    // Persistent next-task glow badge — mounted above the tab bar so it's visible regardless of which
    // view is active; owns its own countdown timer, see App.ui.indicators.
    var badgeCtrl = App.ui.indicators.createBadge(wrap);

    // Opens a contact's CRM page(s) and collapses the floating widget to its dot form first — collapsing
    // before navigating means the persisted density is already "dot" by the time the contact page
    // finishes loading, so the re-mounted widget doesn't cover the page the user just opened. Unlike the
    // predecessor's single GHL URL, a Notion contact can have both a "URL Contact" and a
    // "URL Opportunity" — opens whichever exists, preferring URL Contact, in a new tab so the current
    // CRM page (and this widget) stays put rather than navigating away from it.
    function openContact(contactId) {
      if (!contactId) return;
      App.core.notionClient.getContact(contactId).then(function (page) {
        var contact = App.core.notionClient.decorateContact(page);
        var url = contact.urlContact || contact.urlOpportunity;
        if (url) {
          collapseToDot();
          window.open(url, '_blank');
        }
      });
    }

    // The Notion-style task-edit side panel — mounted once here and toggled open/closed per task by
    // renderTaskRow's click handler below.
    var editPanelCtrl = App.ui.taskEditPanel.mount(wrap, {
      onOpenContact: openContact,
      onSaved: function () { App.tasks.taskStore.refresh(); },
    });

    // "When user finishes a task I want a popup... where user can immediately add a new task to the
    // contact." Mounted once here (like editPanelCtrl above) and shown per-task by toggleCompleted below,
    // only on a confirmed mark-complete.
    var followUpPromptCtrl = App.ui.followUpPrompt.mount(wrap);

    // A failed write (e.g. the completed-toggle call below) must be visibly surfaced, not just logged —
    // a silent failure combined with "never update ahead of a confirmed response" would otherwise look
    // exactly like the click did nothing at all.
    var errorBannerEl = document.createElement('div');
    errorBannerEl.className = 'crmtm-fs-error-banner';
    errorBannerEl.style.display = 'none';
    wrap.appendChild(errorBannerEl);

    function showRowError(message) {
      errorBannerEl.textContent = message;
      errorBannerEl.style.display = '';
    }

    function clearRowError() {
      errorBannerEl.style.display = 'none';
    }

    // Minimalistic manual refresh — a small icon button next to a live "updated Xs ago" label, so
    // staleness (or a stuck poll loop) is visible at a glance. Calls the exact same non-optimistic
    // App.tasks.taskStore.refresh() the timer uses, just fired on demand.
    var toolbarEl = document.createElement('div');
    toolbarEl.className = 'crmtm-fs-toolbar';
    wrap.appendChild(toolbarEl);

    var refreshStatusEl = document.createElement('span');
    refreshStatusEl.className = 'crmtm-fs-refresh-status';
    toolbarEl.appendChild(refreshStatusEl);

    var refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.className = 'crmtm-btn crmtm-fs-refresh';
    refreshBtn.title = 'Refresh now';
    refreshBtn.textContent = '⟳';
    refreshBtn.addEventListener('click', function () {
      if (refreshBtn.disabled) return;
      refreshBtn.disabled = true;
      refreshBtn.classList.add('is-spinning');
      App.tasks.taskStore.refresh().then(function () {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('is-spinning');
        renderRefreshStatus();
      }, function () {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('is-spinning');
        renderRefreshStatus();
      });
    });
    toolbarEl.appendChild(refreshBtn);

    function secondsAgoLabel(timestamp) {
      var seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
      if (seconds < 5) return 'just now';
      if (seconds < 60) return seconds + 's ago';
      var minutes = Math.round(seconds / 60);
      return minutes + 'm ago';
    }

    function renderRefreshStatus() {
      var status = App.tasks.taskStore.getStatus();
      var text = status.lastPolledAt ? 'Updated ' + secondsAgoLabel(status.lastPolledAt) : 'Not updated yet';
      if (status.lastError) text += ' — last refresh failed: ' + status.lastError;
      refreshStatusEl.textContent = text;
      refreshStatusEl.classList.toggle('is-error', !!status.lastError);
    }

    renderRefreshStatus();
    var refreshStatusTimer = setInterval(renderRefreshStatus, 5000);

    var tabsEl = document.createElement('div');
    tabsEl.className = 'crmtm-fs-tabs';
    wrap.appendChild(tabsEl);

    // Notion-style Filter/Sort toolbar — mounted once, as a persistent sibling of contentEl (never wiped
    // by contentEl.innerHTML = ''), same lifecycle as badgeCtrl/editPanelCtrl above. setView()/
    // setVisible() are called on every renderContent() pass.
    var filterSortBarContainerEl = document.createElement('div');
    filterSortBarContainerEl.className = 'crmtm-fs-filtersort-container';
    wrap.appendChild(filterSortBarContainerEl);
    var filterSortBarCtrl = App.ui.filterSortBar.mount({
      container: filterSortBarContainerEl,
      onChange: function () { renderContent(); },
    });

    var contentEl = document.createElement('div');
    contentEl.className = 'crmtm-fs-content';
    wrap.appendChild(contentEl);

    var localState = {
      activeId: null, // set to the first stored view's id once renderTabs runs
      tasks: [],
      lastTasksFingerprint: null, // skips a rebuild when a poll changes nothing
      timelineSelectedDayKey: null, // which Timeline bar's tasks the table below shows; defaults to today
      // The Timeline's own horizontal scroll position, captured just before a rebuild and restored
      // after, so a background poll update never resets/fights whatever the user last scrolled to. null
      // means "never opened/scrolled yet" — renderTimeline treats that as first-open and scrolls to
      // today once.
      timelineScrollLeft: null,
      // Set only by an explicit action (the Today button) to request a real scrollIntoView on the next
      // render; consumed and cleared immediately. Passive re-renders (a poll ticking) never set this.
      timelinePendingScrollDayKey: null,
      // The widest date range ever seen with real data this session — see buildTimelineSlots. Only ever
      // grows, never shrinks, so a transient smaller snapshot can't visually shrink the chart.
      timelineSeenRangeStart: null,
      timelineSeenRangeEnd: null,
      pendingToggleIds: {}, // taskId -> true while its status-update call is in flight
      // taskId -> the completed value the user just clicked to, shown immediately. Cleared once a
      // confirmed poll snapshot agrees with it, or immediately on a failed request — never left pointing
      // at a value the server didn't actually confirm.
      optimisticCompleted: {},
    };

    function switchTab(id) {
      localState.activeId = id;
      clearRowError();
      renderTabs();
      renderContent();
    }

    function makeFixedTabButton(label, id) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crmtm-fs-tab' + (localState.activeId === id ? ' is-active' : '');
      btn.textContent = label;
      btn.addEventListener('click', function () { switchTab(id); });
      return btn;
    }

    // Notion-style editable view tab — every entry in App.tasks.viewsStore.list() (seeded defaults and
    // anything the owner adds later) renders the same way: label + a rename (pencil) icon + a delete (×)
    // icon, both hidden until hover so the tab bar doesn't look cluttered at rest.
    function makeViewTabButton(view) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crmtm-fs-tab crmtm-fs-view-tab' + (localState.activeId === view.id ? ' is-active' : '');

      var labelEl = document.createElement('span');
      labelEl.className = 'crmtm-fs-view-tab-label';
      labelEl.textContent = view.name;
      btn.appendChild(labelEl);

      function startRename(e) {
        e.stopPropagation();
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'crmtm-fs-view-tab-rename';
        input.value = view.name;
        btn.replaceChild(input, labelEl);
        input.focus();
        input.select();
        function commit() {
          var name = input.value.trim() || view.name;
          App.tasks.viewsStore.rename(view.id, name);
          renderTabs();
        }
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', function (ke) {
          if (ke.key === 'Enter') input.blur();
          if (ke.key === 'Escape') { input.value = view.name; input.blur(); }
        });
      }

      var renameBtn = document.createElement('span');
      renameBtn.className = 'crmtm-fs-view-tab-icon';
      renameBtn.title = 'Rename view';
      renameBtn.textContent = '✎';
      renameBtn.addEventListener('click', startRename);
      btn.appendChild(renameBtn);

      var deleteBtn = document.createElement('span');
      deleteBtn.className = 'crmtm-fs-view-tab-icon crmtm-fs-view-tab-delete';
      deleteBtn.title = 'Delete view';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (App.tasks.viewsStore.list().length <= 1) {
          window.alert('At least one view must remain.');
          return;
        }
        if (!window.confirm('Delete view "' + view.name + '"?')) return;
        App.tasks.viewsStore.remove(view.id);
        if (localState.activeId === view.id) {
          localState.activeId = App.tasks.viewsStore.list()[0].id;
        }
        renderTabs();
        renderContent();
      });
      btn.appendChild(deleteBtn);

      btn.addEventListener('click', function () { switchTab(view.id); });
      return btn;
    }

    function renderTabs() {
      tabsEl.innerHTML = '';
      var views = App.tasks.viewsStore.list();
      if (!localState.activeId) localState.activeId = views[0].id;
      views.forEach(function (view) {
        tabsEl.appendChild(makeViewTabButton(view));
      });

      var newViewBtn = document.createElement('button');
      newViewBtn.type = 'button';
      newViewBtn.className = 'crmtm-fs-tab crmtm-fs-tab-new';
      newViewBtn.title = 'New view';
      newViewBtn.textContent = '+';
      newViewBtn.addEventListener('click', function () {
        var view = App.tasks.viewsStore.create('New view');
        switchTab(view.id);
      });
      tabsEl.appendChild(newViewBtn);

      // Timeline (a bar-graph day-grouping, not a filterable table) and Settings are fixed pinned tabs —
      // neither is an entry in App.tasks.viewsStore.
      tabsEl.appendChild(makeFixedTabButton('Timeline', 'timeline'));
      tabsEl.appendChild(makeFixedTabButton('⚙ Settings', 'settings'));
    }

    function renderEmpty(target, message) {
      var empty = document.createElement('div');
      empty.className = 'crmtm-fs-empty';
      empty.textContent = message;
      target.appendChild(empty);
    }

    // All-completed celebration — a different condition from the glow badge's absence: triggers whenever
    // every task in the whole store is completed, replacing whatever empty state this particular view
    // would otherwise show.
    function renderEmptyOrCelebrate(target, message) {
      if (App.ui.indicators.allCompleted(localState.tasks)) {
        var celebrate = document.createElement('div');
        celebrate.className = 'crmtm-fs-celebrate';
        celebrate.textContent = 'All caught up — nothing left to do.';
        target.appendChild(celebrate);
        return;
      }
      renderEmpty(target, message);
    }

    // The "displayed" completed value: the optimistic override while one is pending (see
    // toggleCompleted below), otherwise whatever the last confirmed poll said.
    function effectiveCompleted(task) {
      return Object.prototype.hasOwnProperty.call(localState.optimisticCompleted, task.id)
        ? localState.optimisticCompleted[task.id]
        : task.status === 'Completed';
    }

    // Row status (overdue text-color rule, plus completed dimming) — always recomputed from
    // effectiveCompleted rather than the timeline's own precomputed timelineStatus
    // (App.tasks.taskViews.timeline), since that snapshot can't know about an optimistic toggle that
    // hasn't been confirmed by a poll yet.
    function rowStatus(task) {
      if (effectiveCompleted(task)) return 'completed';
      if (App.ui.indicators.isOverdue(Object.assign({}, task, { status: 'Planned' }), new Date())) return 'forgotten';
      return 'incomplete';
    }

    function renderTaskRow(task) {
      var row = document.createElement('div');
      row.className = 'crmtm-fs-row is-' + rowStatus(task);

      var completed = effectiveCompleted(task);
      var pending = !!localState.pendingToggleIds[task.id];

      var checkbox = document.createElement('button');
      checkbox.type = 'button';
      checkbox.className = 'crmtm-fs-check' + (completed ? ' is-checked' : '') + (pending ? ' is-syncing' : '');
      checkbox.title = completed ? 'Mark not completed' : 'Mark completed';
      checkbox.textContent = completed ? '✓' : '';
      checkbox.disabled = !task.id || pending;
      checkbox.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleCompleted(task);
      });
      row.appendChild(checkbox);

      var main = document.createElement('div');
      main.className = 'crmtm-fs-row-main';
      // Opening the Notion-style edit panel is the row's default click action everywhere except the
      // checkbox (stopPropagation'd above) and the contact-name link (stopPropagation'd below).
      if (task.id) {
        main.addEventListener('click', function () {
          editPanelCtrl.open(task);
        });
      }

      var titleEl = document.createElement('div');
      titleEl.className = 'crmtm-fs-row-title';
      titleEl.textContent = task.title || '(untitled)';
      main.appendChild(titleEl);

      var meta = document.createElement('div');
      meta.className = 'crmtm-fs-row-meta';
      var tagColor = App.ui.indicators.getTagColor(task.due);
      if (tagColor) {
        var tag = document.createElement('span');
        tag.className = 'crmtm-fs-tag crmtm-fs-tag-' + tagColor;
        tag.title = tagColor;
        meta.appendChild(tag);
      }
      if (task.contactId) {
        var contactBtn = document.createElement('button');
        contactBtn.type = 'button';
        contactBtn.className = 'crmtm-fs-contact';
        contactBtn.textContent = App.tasks.contactNameCache.get(task.contactId) || 'Loading contact…';
        App.tasks.contactNameCache.fetch(task.contactId, function (name) {
          contactBtn.textContent = name || 'Unknown contact';
        });
        contactBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openContact(task.contactId);
        });
        meta.appendChild(contactBtn);
      }
      if (task.note) {
        var pill = document.createElement('span');
        pill.className = 'crmtm-fs-pill';
        pill.textContent = task.note;
        meta.appendChild(pill);
      }
      var dueLabel = App.ui.indicators.formatDueLabel(task.due);
      if (dueLabel) {
        var due = document.createElement('span');
        due.className = 'crmtm-fs-due';
        due.textContent = dueLabel;
        meta.appendChild(due);
      }
      main.appendChild(meta);
      row.appendChild(main);
      return row;
    }

    // "When I press Task Completed it takes a while before it updates... I want the animation for
    // completed task be updated immediately... even though it's not yet in sync." So: flip the visual
    // state (localState.optimisticCompleted) the instant the button is clicked, fire the real request in
    // the background, and only ever *revert* that optimistic value on a confirmed failure — a confirmed
    // success is left in place (still marked "syncing" via pendingToggleIds until the next poll snapshot
    // agrees) rather than being cleared early, so the row never flickers back to the old state in the gap
    // between the write succeeding and the next poll confirming it.
    function toggleCompleted(task) {
      if (!task.id) return;
      clearRowError();
      var newValue = !effectiveCompleted(task);
      localState.optimisticCompleted[task.id] = newValue;
      localState.pendingToggleIds[task.id] = true;
      renderContent();
      App.core.notionClient.updateTask(task.id, { status: newValue ? 'Completed' : 'Planned' }).then(
        function () {
          delete localState.pendingToggleIds[task.id];
          App.tasks.taskStore.refresh();
          renderContent();
          // Only on a confirmed *completion* (never on un-checking) — task still has its pre-toggle
          // title/stage/contactId here since toggleCompleted never mutates anything but status.
          if (newValue) followUpPromptCtrl.show(task);
        },
        function (error) {
          App.core.log('fullScreen: toggle completed failed:', error.message);
          delete localState.pendingToggleIds[task.id];
          delete localState.optimisticCompleted[task.id];
          renderContent();
          showRowError('Could not update that task — ' + error.message);
        }
      );
    }

    function renderList(target, tasks) {
      if (tasks.length === 0) {
        renderEmptyOrCelebrate(target, 'No tasks in this view.');
        return;
      }
      var list = document.createElement('div');
      list.className = 'crmtm-fs-list';
      tasks.forEach(function (task) {
        list.appendChild(renderTaskRow(task));
      });
      target.appendChild(list);
    }

    function dayKeyLocal(date) {
      return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
    }

    var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // An absolute "Jul 21, 2026" label — used by the Timeline (tooltips/table header), which shows
    // month/year context directly in its own axis, so relative labels (Today/Tomorrow) would be
    // redundant with what the chart already shows.
    function formatShortDateLocal(date) {
      return MONTH_NAMES[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }

    // --- Timeline: a real bar graph with two axes. Geometry constants named rather than inlined so the
    // math below reads against a spec, not magic numbers.
    var TL_DAY_WIDTH = 34; // px per real day column
    var TL_GAP_WIDTH = 20; // px per collapsed empty-run marker, regardless of how many days it covers
    var TL_YAXIS_WIDTH = 34; // px, sticky left rail
    var TL_BARS_HEIGHT = 120; // px — the plot area only; day-number/month/year rows sit below it
    // Bar width itself (22px) and the 4px segment radius live in src/ui/styles/fullScreen.js's
    // .crmtm-tl-bar-inner/.crmtm-tl-seg-cap — pure CSS, no per-render JS math needed for either.
    var TL_SEGMENT_GAP = 2; // px — a surface gap separates stacked segments
    var TL_MAX_RANGE_DAYS = 730; // defensive cap in case a bad due date is years off in either direction

    // Walks every calendar day from the earliest to the latest loaded task's due date (always including
    // today even with no tasks on it), classifying each as a real 'day' slot or folding a run of
    // consecutive taskless days into one compact 'gap' slot. A run never crosses a month boundary, so
    // every gap slot belongs to exactly one month.
    function buildTimelineSlots(groups, now) {
      var byKey = {};
      groups.forEach(function (g) {
        byKey[g.dayKey] = g;
      });
      var todayKey = dayKeyLocal(now);
      var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      var rangeStart = todayStart;
      var rangeEnd = todayStart;
      groups.forEach(function (g) {
        if (g.date.getTime() < rangeStart.getTime()) rangeStart = g.date;
        if (g.date.getTime() > rangeEnd.getTime()) rangeEnd = g.date;
      });

      // Once a date has been seen with real data this session, the visible range never shrinks back
      // below it, even if some future snapshot is transiently smaller for any other reason.
      if (localState.timelineSeenRangeStart === null || rangeStart.getTime() < localState.timelineSeenRangeStart.getTime()) {
        localState.timelineSeenRangeStart = rangeStart;
      }
      if (localState.timelineSeenRangeEnd === null || rangeEnd.getTime() > localState.timelineSeenRangeEnd.getTime()) {
        localState.timelineSeenRangeEnd = rangeEnd;
      }
      rangeStart = localState.timelineSeenRangeStart;
      rangeEnd = localState.timelineSeenRangeEnd;

      var spanDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000);
      if (spanDays > TL_MAX_RANGE_DAYS) {
        App.core.log('fullScreen: Timeline date range (' + spanDays + ' days) exceeds the safety cap, clipping.');
        var half = Math.round(TL_MAX_RANGE_DAYS / 2);
        var clippedStart = new Date(todayStart);
        clippedStart.setDate(clippedStart.getDate() - half);
        var clippedEnd = new Date(todayStart);
        clippedEnd.setDate(clippedEnd.getDate() + half);
        if (rangeStart.getTime() < clippedStart.getTime()) rangeStart = clippedStart;
        if (rangeEnd.getTime() > clippedEnd.getTime()) rangeEnd = clippedEnd;
      }

      var slots = [];
      var runStart = null;
      var runDays = 0;

      function flushRun(beforeDate) {
        if (runStart === null) return;
        slots.push({ type: 'gap', year: runStart.getFullYear(), month: runStart.getMonth(), days: runDays, fromDate: runStart, toDate: beforeDate });
        runStart = null;
        runDays = 0;
      }

      var cursor = new Date(rangeStart);
      while (cursor.getTime() <= rangeEnd.getTime()) {
        var key = dayKeyLocal(cursor);
        var group = byKey[key];
        var isToday = key === todayKey;
        if (group || isToday) {
          var dayBefore = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
          flushRun(dayBefore);
          var completed = 0;
          var open = 0;
          var expired = 0;
          (group ? group.tasks : []).forEach(function (t) {
            if (t.timelineStatus === 'completed') completed++;
            else if (t.timelineStatus === 'forgotten') expired++;
            else open++;
          });
          slots.push({
            type: 'day',
            date: new Date(cursor),
            dayKey: key,
            year: cursor.getFullYear(),
            month: cursor.getMonth(),
            isToday: isToday,
            tasks: group ? group.tasks : [],
            completed: completed,
            open: open,
            expired: expired,
            total: completed + open + expired,
          });
        } else {
          if (runStart !== null && (cursor.getMonth() !== runStart.getMonth() || cursor.getFullYear() !== runStart.getFullYear())) {
            flushRun(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1));
          }
          if (runStart === null) runStart = new Date(cursor);
          runDays++;
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }
      flushRun(rangeEnd);
      return slots;
    }

    // Assigns each slot a pixel width + left offset, and groups them into month/year runs (each with its
    // own start index/column-span/pixel width) — everything the sticky month/year labels and the
    // month/year divider lines below need, computed once rather than re-derived per DOM element.
    function groupTimelineSlots(slots) {
      var months = [];
      var years = [];
      var offsets = [];
      var runningLeft = 0;
      slots.forEach(function (slot, index) {
        offsets.push(runningLeft);
        var widthPx = slot.type === 'day' ? TL_DAY_WIDTH : TL_GAP_WIDTH;
        slot.widthPx = widthPx;
        runningLeft += widthPx;

        var lastMonth = months[months.length - 1];
        if (lastMonth && lastMonth.year === slot.year && lastMonth.month === slot.month) {
          lastMonth.count++;
          lastMonth.widthPx += widthPx;
        } else {
          months.push({ year: slot.year, month: slot.month, startIndex: index, count: 1, widthPx: widthPx });
        }

        var lastYear = years[years.length - 1];
        if (lastYear && lastYear.year === slot.year) {
          lastYear.count++;
          lastYear.widthPx += widthPx;
        } else {
          years.push({ year: slot.year, startIndex: index, count: 1, widthPx: widthPx });
        }
      });
      return { months: months, years: years, offsets: offsets, totalWidthPx: runningLeft };
    }

    // "Nice" Y-axis tick step (0, step, 2*step, ... covering maxValue) — 1/2/5×10^n, the standard
    // clean-axis-number rule.
    function niceTickStep(maxValue) {
      if (maxValue <= 4) return 1;
      var rough = maxValue / 4;
      var mag = Math.pow(10, Math.floor(Math.log10(rough)));
      var norm = rough / mag;
      var step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
      return step * mag;
    }

    // A bar graph, one column per calendar day (bars stacked green-completed/gray-open/red-expired,
    // fixed bottom-to-top order so position is a second cue beyond color alone), a real Y-axis (task
    // count, clean gridlines) and X-axis (day number, with sticky month/year headers), a legend, and a
    // "Today" button that re-centers + re-selects today. Days with no tasks collapse into a compact
    // marker instead of an empty bar. Clicking a real day fills the table underneath with that day's
    // tasks (same row renderer as every other view); the table defaults to today's tasks on first open.
    function renderTimeline(target, groups) {
      // groups' own day keys/dates are already configured-timezone calendar-day values
      // (App.tasks.taskViews.timeline converts each task's due date before bucketing), so "today" here
      // must be that same wall-clock today too, or the chart's today-highlight/scroll target would land
      // on the wrong column for a browser in a different timezone.
      var now = App.core.timezone.now();
      var todayKey = dayKeyLocal(now);
      var slots = buildTimelineSlots(groups, now);
      if (slots.length === 0) {
        renderEmptyOrCelebrate(target, 'No scheduled tasks yet.');
        return;
      }
      if (!localState.timelineSelectedDayKey) {
        var hasToday = slots.some(function (s) {
          return s.type === 'day' && s.dayKey === todayKey;
        });
        localState.timelineSelectedDayKey = hasToday ? todayKey : null;
      }
      var geometry = groupTimelineSlots(slots);
      var maxCount = slots.reduce(function (max, s) {
        return s.type === 'day' ? Math.max(max, s.total) : max;
      }, 1);
      var tickStep = niceTickStep(maxCount);
      var topTick = Math.max(tickStep, Math.ceil(maxCount / tickStep) * tickStep);

      var wrap = document.createElement('div');
      wrap.className = 'crmtm-tl';

      // Legend + Today button — a legend is mandatory once color carries meaning; "Today" always returns
      // to today's column.
      var toolbar = document.createElement('div');
      toolbar.className = 'crmtm-tl-toolbar';
      var legend = document.createElement('div');
      legend.className = 'crmtm-tl-legend';
      [
        ['completed', 'Completed'],
        ['open', 'Open'],
        ['expired', 'Expired'],
      ].forEach(function (pair) {
        var item = document.createElement('span');
        item.className = 'crmtm-tl-legend-item';
        var dot = document.createElement('span');
        dot.className = 'crmtm-tl-legend-dot crmtm-tl-legend-dot-' + pair[0];
        item.appendChild(dot);
        var text = document.createElement('span');
        text.textContent = pair[1];
        item.appendChild(text);
        legend.appendChild(item);
      });
      toolbar.appendChild(legend);
      var todayBtn = document.createElement('button');
      todayBtn.type = 'button';
      todayBtn.className = 'crmtm-btn crmtm-tl-today-btn';
      todayBtn.textContent = 'Today';
      toolbar.appendChild(todayBtn);
      wrap.appendChild(toolbar);

      var scroller = document.createElement('div');
      scroller.className = 'crmtm-tl-scroll';
      var grid = document.createElement('div');
      grid.className = 'crmtm-tl-grid';
      grid.style.gridTemplateColumns = TL_YAXIS_WIDTH + 'px ' + slots.map(function (s) { return s.widthPx + 'px'; }).join(' ');
      grid.style.gridTemplateRows = TL_BARS_HEIGHT + 'px auto auto auto';

      // Gridlines (hairline, one shade off-surface, solid — never dashed) drawn first so bars paint over
      // them; spans every day/gap column in the bars row only.
      var gridlines = document.createElement('div');
      gridlines.className = 'crmtm-tl-gridlines';
      gridlines.style.gridColumn = '2 / -1';
      gridlines.style.gridRow = '1';
      for (var tick = 0; tick <= topTick; tick += tickStep) {
        var lineEl = document.createElement('div');
        lineEl.className = 'crmtm-tl-gridline';
        lineEl.style.bottom = (tick / topTick) * 100 + '%';
        gridlines.appendChild(lineEl);
      }
      grid.appendChild(gridlines);

      // Y-axis: sticky left rail, tick labels at the same heights as the gridlines above.
      var yAxis = document.createElement('div');
      yAxis.className = 'crmtm-tl-yaxis';
      yAxis.style.left = '0';
      for (var t2 = 0; t2 <= topTick; t2 += tickStep) {
        var tickLabel = document.createElement('div');
        tickLabel.className = 'crmtm-tl-ytick';
        tickLabel.style.bottom = (t2 / topTick) * 100 + '%';
        tickLabel.textContent = String(t2);
        yAxis.appendChild(tickLabel);
      }
      grid.appendChild(yAxis);

      // Month/year vertical divider lines — one per group boundary (skipping the very first, which has
      // no "previous" group to divide from), spanning the grid's full height.
      geometry.months.forEach(function (m, i) {
        if (i === 0) return;
        var divider = document.createElement('div');
        divider.className = 'crmtm-tl-divider crmtm-tl-divider-month';
        divider.style.left = TL_YAXIS_WIDTH + geometry.offsets[m.startIndex] + 'px';
        grid.appendChild(divider);
      });
      geometry.years.forEach(function (y, i) {
        if (i === 0) return;
        var yDivider = document.createElement('div');
        yDivider.className = 'crmtm-tl-divider crmtm-tl-divider-year';
        yDivider.style.left = TL_YAXIS_WIDTH + geometry.offsets[y.startIndex] + 'px';
        grid.appendChild(yDivider);
      });

      var dayCols = {}; // dayKey -> bar cell, so the "Today"/selection logic can find+scroll to it

      slots.forEach(function (slot, index) {
        var col = index + 2; // grid columns are 1-based; column 1 is the y-axis rail
        if (slot.type === 'gap') {
          var gapMarker = document.createElement('div');
          gapMarker.className = 'crmtm-tl-gap';
          gapMarker.style.gridColumn = String(col);
          gapMarker.style.gridRow = '1 / span 2';
          gapMarker.title =
            slot.days +
            ' day' +
            (slot.days === 1 ? '' : 's') +
            ' with no tasks (' +
            formatShortDateLocal(slot.fromDate) +
            ' – ' +
            formatShortDateLocal(slot.toDate) +
            ')';
          gapMarker.appendChild(document.createTextNode('⋯'));
          grid.appendChild(gapMarker);
          return;
        }

        var isSelected = slot.dayKey === localState.timelineSelectedDayKey;

        var bar = document.createElement('button');
        bar.type = 'button';
        bar.className = 'crmtm-tl-bar' + (slot.isToday ? ' is-today' : '') + (isSelected ? ' is-selected' : '');
        bar.style.gridColumn = String(col);
        bar.style.gridRow = '1';
        bar.title =
          formatShortDateLocal(slot.date) +
          ' — ' +
          slot.total +
          ' task' +
          (slot.total === 1 ? '' : 's') +
          (slot.total ? ': ' + slot.completed + ' completed, ' + slot.open + ' open, ' + slot.expired + ' expired' : '');
        bar.addEventListener('click', function () {
          localState.timelineSelectedDayKey = slot.dayKey;
          renderContent();
        });

        if (slot.total > 0) {
          var barInner = document.createElement('div');
          barInner.className = 'crmtm-tl-bar-inner';
          var totalHeight = Math.max(4, Math.round((slot.total / topTick) * TL_BARS_HEIGHT));
          barInner.style.height = totalHeight + 'px';
          var segDefs = [
            ['completed', slot.completed],
            ['open', slot.open],
            ['expired', slot.expired],
          ].filter(function (d) {
            return d[1] > 0;
          });
          var gapsTotal = (segDefs.length - 1) * TL_SEGMENT_GAP;
          var usableHeight = Math.max(0, totalHeight - gapsTotal);
          var segEls = [];
          segDefs.forEach(function (d) {
            var seg = document.createElement('div');
            seg.className = 'crmtm-tl-seg crmtm-tl-seg-' + d[0];
            var segHeight = Math.max(2, Math.round((d[1] / slot.total) * usableHeight));
            seg.style.height = segHeight + 'px';
            barInner.appendChild(seg);
            segEls.push(seg);
          });
          // 4px rounded data-end on the topmost segment only, square everywhere else including the
          // baseline — with flex-direction: column-reverse below, the LAST appended segment sits
          // visually on top.
          if (segEls.length) segEls[segEls.length - 1].classList.add('crmtm-tl-seg-cap');
          bar.appendChild(barInner);
        }

        var dayNum = document.createElement('div');
        dayNum.className = 'crmtm-tl-daynum' + (slot.isToday ? ' is-today' : '');
        dayNum.style.gridColumn = String(col);
        dayNum.style.gridRow = '2';
        dayNum.textContent = String(slot.date.getDate());
        grid.appendChild(dayNum);

        grid.appendChild(bar);
        dayCols[slot.dayKey] = bar;
      });

      geometry.months.forEach(function (m) {
        var label = document.createElement('div');
        label.className = 'crmtm-tl-month-label';
        label.style.gridColumn = (m.startIndex + 2) + ' / span ' + m.count;
        label.style.gridRow = '3';
        label.style.left = TL_YAXIS_WIDTH + 'px';
        label.textContent = MONTH_NAMES[m.month];
        grid.appendChild(label);
      });
      geometry.years.forEach(function (y) {
        var label = document.createElement('div');
        label.className = 'crmtm-tl-year-label';
        label.style.gridColumn = (y.startIndex + 2) + ' / span ' + y.count;
        label.style.gridRow = '4';
        label.style.left = TL_YAXIS_WIDTH + 'px';
        label.textContent = String(y.year);
        grid.appendChild(label);
      });

      scroller.appendChild(grid);
      wrap.appendChild(scroller);

      function scrollToDay(dayKey) {
        var el = dayCols[dayKey];
        if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'center', block: 'nearest' });
      }

      todayBtn.addEventListener('click', function () {
        localState.timelineSelectedDayKey = todayKey;
        localState.timelinePendingScrollDayKey = todayKey;
        renderContent();
      });

      var tableWrap = document.createElement('div');
      tableWrap.className = 'crmtm-tl-table';
      var selectedSlot = slots.filter(function (s) {
        return s.type === 'day' && s.dayKey === localState.timelineSelectedDayKey;
      })[0];
      if (selectedSlot) {
        var tableHeader = document.createElement('div');
        tableHeader.className = 'crmtm-tl-table-header';
        tableHeader.textContent =
          formatShortDateLocal(selectedSlot.date) + ' — ' + selectedSlot.total + ' task' + (selectedSlot.total === 1 ? '' : 's');
        tableWrap.appendChild(tableHeader);
        if (selectedSlot.total === 0) {
          renderEmpty(tableWrap, 'No tasks on this day.');
        } else {
          var list = document.createElement('div');
          list.className = 'crmtm-fs-list';
          selectedSlot.tasks
            .slice()
            .sort(function (a, b) {
              return a.due.getTime() - b.due.getTime();
            })
            .forEach(function (task) {
              list.appendChild(renderTaskRow(task));
            });
          tableWrap.appendChild(list);
        }
      } else {
        renderEmpty(tableWrap, 'Click a day above to see its tasks.');
      }
      wrap.appendChild(tableWrap);

      target.appendChild(wrap);

      // A real scrollIntoView only ever happens for an explicit reason — the Today button
      // (timelinePendingScrollDayKey) or genuinely opening the tab for the first time
      // (timelineScrollLeft still null). Every other render (a passive poll tick, clicking a bar,
      // switching away and back) restores exactly the scroll position the user left it at.
      if (localState.timelinePendingScrollDayKey) {
        scrollToDay(localState.timelinePendingScrollDayKey);
        localState.timelinePendingScrollDayKey = null;
        localState.timelineScrollLeft = scroller.scrollLeft;
      } else if (localState.timelineScrollLeft === null) {
        scrollToDay(localState.timelineSelectedDayKey || todayKey);
        localState.timelineScrollLeft = scroller.scrollLeft;
      } else {
        scroller.scrollLeft = localState.timelineScrollLeft;
      }
    }

    function renderContent() {
      // Capture the chart's current scroll position before wiping it out, so a rebuild (a background
      // poll, an unrelated tab's toggle, etc.) can restore it afterward instead of resetting to 0.
      if (localState.activeId === 'timeline') {
        var prevScroller = contentEl.querySelector('.crmtm-tl-scroll');
        if (prevScroller) localState.timelineScrollLeft = prevScroller.scrollLeft;
      }
      contentEl.innerHTML = '';
      // The Filter/Sort bar only ever applies to a real stored view's table — hidden on the 2 fixed
      // pinned tabs (Timeline has nothing to filter a single flat list of; Settings isn't a task view).
      var isEditableView = localState.activeId !== 'timeline' && localState.activeId !== 'settings';
      filterSortBarCtrl.setVisible(isEditableView);
      if (localState.activeId === 'settings') {
        App.ui.settingsPanel.render(contentEl);
        return;
      }
      if (localState.activeId === 'timeline') {
        renderTimeline(contentEl, App.tasks.taskViews.timeline(localState.tasks, new Date()));
        return;
      }
      var view = App.tasks.viewsStore.get(localState.activeId);
      if (!view) {
        renderEmpty(contentEl, 'Unknown view.');
        return;
      }
      filterSortBarCtrl.setView(view);
      var filtered = App.tasks.taskViews.applyFilter(view.filter, localState.tasks);
      var sorted = App.tasks.taskViews.applySort(view.sort, filtered);
      renderList(contentEl, sorted);
    }

    // A cheap content signature so a poll that returns identical data (the common case) can skip the
    // expensive full-DOM rebuild below entirely, rather than tearing down and rebuilding every view (the
    // Timeline chart especially) on a timer regardless of whether anything actually changed.
    // App.core.notionClient.decorateTask creates a fresh object every poll even when the underlying data
    // is byte-identical, so reference equality can't be used here.
    function fingerprintTasks(tasks) {
      return tasks
        .map(function (t) {
          return t.id + ':' + t.status + ':' + (t.due ? t.due.getTime() : '') + ':' + t.title;
        })
        .sort()
        .join('|');
    }

    var unsubscribe = App.tasks.taskStore.subscribe(function (tasks) {
      localState.tasks = tasks;
      // Once a confirmed poll snapshot agrees with an optimistic completed-toggle value, the override
      // has done its job — drop it so a future click starts clean and this map doesn't grow forever.
      Object.keys(localState.optimisticCompleted).forEach(function (taskId) {
        var match = localState.tasks.filter(function (t) {
          return t.id === taskId;
        })[0];
        if (match && (match.status === 'Completed') === localState.optimisticCompleted[taskId]) {
          delete localState.optimisticCompleted[taskId];
        }
      });
      badgeCtrl.update(localState.tasks);
      renderRefreshStatus();
      var fingerprint = fingerprintTasks(localState.tasks);
      if (fingerprint !== localState.lastTasksFingerprint) {
        localState.lastTasksFingerprint = fingerprint;
        renderContent();
      }
    });

    App.tasks.taskStore.startPolling();
    renderTabs();

    return {
      destroy: function () {
        unsubscribe();
        badgeCtrl.destroy();
        editPanelCtrl.destroy();
        followUpPromptCtrl.destroy();
        filterSortBarCtrl.destroy();
        clearInterval(refreshStatusTimer);
      },
    };
  }

  return {
    mount: mount,
  };
})();
