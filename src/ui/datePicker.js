// requires: App.core.timezone, App.ui.floatingPanel
'use strict';
App.ui = App.ui || {};
// A Todoist-style date field: a trigger chip that reads "Date" with a neutral calendar icon until a
// value exists (either picked manually or auto-filled by the workflow automation), and a dropdown
// panel with 4 colorful preset rows plus an infinite-scroll calendar (starts today, no past dates).
// Fully self-contained — no dependency on App.ui.quickAdd — so any other module can mount a date
// field the same way. The trigger chip, panel box, and preset-row look are shared chrome from
// App.ui.styles.flyout (the crmtm-flyout-* classes below); only the calendar grid is this module's own
// CSS (App.ui.styles.datePicker).
App.ui.datePicker = (function () {
  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  var WEEKDAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  var MAX_MONTHS = 24; // ~2 years of infinite scroll is plenty; avoids unbounded DOM growth.
  var SCROLL_THRESHOLD_PX = 150;

  var ICON_CALENDAR_NEUTRAL =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect>' +
    '<line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="2" x2="8" y2="6"></line>' +
    '<line x1="16" y1="2" x2="16" y2="6"></line></svg>';

  var PRESETS = [
    {
      value: 'today',
      label: 'Today',
      offset: 0,
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#058527" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect>' +
        '<line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="2" x2="8" y2="6"></line>' +
        '<line x1="16" y1="2" x2="16" y2="6"></line><circle cx="12" cy="15" r="2.4" fill="#058527" stroke="none"></circle></svg>',
    },
    {
      value: 'tomorrow',
      label: 'Tomorrow',
      offset: 1,
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#e58e26" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"></circle>' +
        '<line x1="12" y1="2" x2="12" y2="4.5"></line><line x1="12" y1="19.5" x2="12" y2="22"></line>' +
        '<line x1="4" y1="12" x2="1.5" y2="12"></line><line x1="22.5" y1="12" x2="20" y2="12"></line>' +
        '<line x1="5.6" y1="5.6" x2="4" y2="4"></line><line x1="20" y1="20" x2="18.4" y2="18.4"></line>' +
        '<line x1="18.4" y1="5.6" x2="20" y2="4"></line><line x1="4" y1="20" x2="5.6" y2="18.4"></line></svg>',
    },
    {
      value: 'in3days',
      label: 'In 3 days',
      offset: 3,
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1cadb5" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 13 12 6 20"></polyline>' +
        '<polyline points="13 4 20 12 13 20"></polyline></svg>',
    },
    {
      value: 'nextweek',
      label: 'Next week',
      offset: 7,
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#7c3aed" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect>' +
        '<line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="2" x2="8" y2="6"></line>' +
        '<line x1="16" y1="2" x2="16" y2="6"></line><line x1="7.5" y1="16" x2="14.5" y2="16"></line>' +
        '<polyline points="12 13.2 14.8 16 12 18.8"></polyline></svg>',
    },
  ];

  function dayOnly(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function sameDay(a, b) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function formatShortDate(date) {
    return MONTH_ABBR[date.getMonth()] + ' ' + date.getDate();
  }

  function findPreset(value) {
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].value === value) return PRESETS[i];
    }
    return null;
  }

  // mode: null (nothing chosen yet), a preset value, or 'custom'. Returns null only for the
  // never-set case — callers that need a concrete date should fall back to "now" themselves.
  function resolveDate(mode, customDate, now) {
    if (mode === 'custom') return customDate ? dayOnly(customDate) : dayOnly(now);
    var preset = findPreset(mode);
    if (preset) return addDays(now, preset.offset);
    return null;
  }

  // Inverse of resolveDate: given a concrete date, finds the matching named preset or falls back to
  // 'custom' with the exact date — nothing is ever silently rounded to the wrong day.
  function modeFromDate(date, now) {
    var diffDays = Math.round((dayOnly(date) - dayOnly(now)) / 86400000);
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].offset === diffDays) return { mode: PRESETS[i].value, date: dayOnly(date) };
    }
    return { mode: 'custom', date: dayOnly(date) };
  }

  function label(mode, customDate) {
    if (!mode) return 'Date';
    var preset = findPreset(mode);
    if (preset) return preset.label;
    return formatShortDate(customDate || App.core.timezone.now());
  }

  function blankCell() {
    var el = document.createElement('div');
    el.className = 'crmtm-dp-day crmtm-dp-day-blank';
    return el;
  }

  function dayCell(date) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'crmtm-dp-day';
    btn.textContent = '' + date.getDate();
    btn.dataset.time = '' + date.getTime();
    return btn;
  }

  function buildMonthSection(year, month, today) {
    var section = document.createElement('div');
    section.className = 'crmtm-dp-month';

    var title = document.createElement('div');
    title.className = 'crmtm-dp-month-title';
    title.textContent = MONTH_NAMES[month] + ' ' + year;
    section.appendChild(title);

    var weekdays = document.createElement('div');
    weekdays.className = 'crmtm-dp-weekdays';
    WEEKDAY_ABBR.forEach(function (w) {
      var el = document.createElement('span');
      el.textContent = w;
      weekdays.appendChild(el);
    });
    section.appendChild(weekdays);

    var grid = document.createElement('div');
    grid.className = 'crmtm-dp-days';

    var firstWeekday = new Date(year, month, 1).getDay();
    var totalDays = new Date(year, month + 1, 0).getDate();

    for (var i = 0; i < firstWeekday; i++) {
      grid.appendChild(blankCell());
    }
    for (var d = 1; d <= totalDays; d++) {
      var cellDate = new Date(year, month, d);
      // "You can't see the past" — days before today render as blank, unclickable cells rather than
      // disabled-but-visible ones, so the grid stays aligned with no dead weight.
      if (cellDate < today) {
        grid.appendChild(blankCell());
        continue;
      }
      var cell = dayCell(cellDate);
      if (sameDay(cellDate, today)) cell.classList.add('is-today');
      grid.appendChild(cell);
    }

    section.appendChild(grid);
    return section;
  }

  // config: { container, getState(): {mode, date}, onChange(mode, date) }
  function create(config) {
    var container = config.container;
    var getState = config.getState;
    var onChange = config.onChange;

    var wrap = document.createElement('div');
    wrap.className = 'crmtm-flyout-wrap';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'crmtm-flyout-trigger';
    var iconWrap = document.createElement('span');
    iconWrap.className = 'crmtm-flyout-trigger-icon';
    var labelEl = document.createElement('span');
    labelEl.className = 'crmtm-flyout-trigger-label';
    trigger.appendChild(iconWrap);
    trigger.appendChild(labelEl);
    wrap.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'crmtm-flyout-panel';
    panel.hidden = true;

    var presetsWrap = document.createElement('div');
    presetsWrap.className = 'crmtm-flyout-options';
    PRESETS.forEach(function (preset) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crmtm-flyout-option';
      var icon = document.createElement('span');
      icon.className = 'crmtm-flyout-option-icon';
      icon.innerHTML = preset.icon;
      var text = document.createElement('span');
      text.textContent = preset.label;
      btn.appendChild(icon);
      btn.appendChild(text);
      // mousedown+preventDefault keeps focus from ever leaving the panel on click, so nothing else in
      // the panel can hide it out from under this click before it registers.
      btn.addEventListener('mousedown', function (e) {
        e.preventDefault();
      });
      btn.addEventListener('click', function () {
        onChange(preset.value, null);
        close();
      });
      presetsWrap.appendChild(btn);
    });
    panel.appendChild(presetsWrap);

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'crmtm-flyout-clear';
    clearBtn.textContent = 'No date';
    clearBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
    clearBtn.addEventListener('click', function () {
      onChange(null, null);
      close();
    });
    panel.appendChild(clearBtn);

    var calendarEl = document.createElement('div');
    calendarEl.className = 'crmtm-dp-calendar';
    panel.appendChild(calendarEl);

    wrap.appendChild(panel);
    container.appendChild(wrap);

    var monthCursor = null;
    var monthsRendered = 0;

    function today() {
      return dayOnly(App.core.timezone.now());
    }

    function selectedDate() {
      var s = getState();
      return resolveDate(s.mode, s.date, App.core.timezone.now());
    }

    function updateSelectedHighlight() {
      var sel = selectedDate();
      var cells = calendarEl.querySelectorAll('.crmtm-dp-day[data-time]');
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var d = new Date(parseInt(cell.dataset.time, 10));
        if (sameDay(d, sel)) {
          cell.classList.add('is-selected');
        } else {
          cell.classList.remove('is-selected');
        }
      }
    }

    function renderMonth(year, month) {
      var section = buildMonthSection(year, month, today());
      calendarEl.appendChild(section);
      monthsRendered++;
      updateSelectedHighlight();
    }

    function appendNextMonth() {
      if (monthsRendered >= MAX_MONTHS) return;
      monthCursor.month++;
      if (monthCursor.month > 11) {
        monthCursor.month = 0;
        monthCursor.year++;
      }
      renderMonth(monthCursor.year, monthCursor.month);
    }

    function resetCalendar() {
      calendarEl.innerHTML = '';
      var t = today();
      monthCursor = { year: t.getFullYear(), month: t.getMonth() };
      monthsRendered = 0;
      renderMonth(monthCursor.year, monthCursor.month);
      appendNextMonth();
    }

    function onCalendarScroll() {
      if (calendarEl.scrollHeight - calendarEl.scrollTop - calendarEl.clientHeight < SCROLL_THRESHOLD_PX) {
        appendNextMonth();
      }
    }
    calendarEl.addEventListener('scroll', onCalendarScroll);

    calendarEl.addEventListener('click', function (e) {
      var target = e.target.closest ? e.target.closest('.crmtm-dp-day') : null;
      if (!target || !target.dataset.time) return;
      var date = new Date(parseInt(target.dataset.time, 10));
      onChange('custom', date);
      close();
    });

    function onDocMouseDown(e) {
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(wrap) === -1) close();
    }

    function onDocKeyDown(e) {
      if (e.key === 'Escape') close();
    }

    function open() {
      panel.hidden = false;
      panel.classList.toggle('is-open-below', App.ui.floatingPanel.pickSide(trigger) === 'below');
      resetCalendar();
      document.addEventListener('mousedown', onDocMouseDown, true);
      document.addEventListener('keydown', onDocKeyDown, true);
    }

    function close() {
      if (panel.hidden) return;
      panel.hidden = true;
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onDocKeyDown, true);
    }

    trigger.addEventListener('click', function () {
      if (panel.hidden) open(); else close();
    });

    function renderTrigger() {
      var s = getState();
      var preset = s.mode ? findPreset(s.mode) : null;
      if (!s.mode) {
        iconWrap.innerHTML = ICON_CALENDAR_NEUTRAL;
        labelEl.textContent = 'Date';
        trigger.classList.add('is-placeholder');
        trigger.classList.remove('is-set');
      } else if (preset) {
        iconWrap.innerHTML = preset.icon;
        labelEl.textContent = preset.label;
        trigger.classList.remove('is-placeholder');
        trigger.classList.add('is-set');
      } else {
        iconWrap.innerHTML = ICON_CALENDAR_NEUTRAL;
        labelEl.textContent = formatShortDate(s.date || App.core.timezone.now());
        trigger.classList.remove('is-placeholder');
        trigger.classList.add('is-set');
      }
      // `error` (optional on getState's return value): caller sets this once a submit was attempted
      // with no date picked — highlights the trigger red until a date is set.
      trigger.classList.toggle('is-error', !!s.error);
    }

    function refresh() {
      renderTrigger();
      if (!panel.hidden) updateSelectedHighlight();
    }

    function destroy() {
      close();
    }

    refresh();

    return { refresh: refresh, close: close, destroy: destroy };
  }

  return {
    PRESETS: PRESETS,
    resolveDate: resolveDate,
    modeFromDate: modeFromDate,
    label: label,
    create: create,
  };
})();
