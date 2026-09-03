// requires: App.core.timezone, App.ui.floatingPanel
'use strict';
App.ui = App.ui || {};
// A Todoist-style time field, structurally the twin of App.ui.datePicker: a trigger chip ("Time" +
// neutral clock icon until a value exists), and a dropdown with 4 colorful preset rows (Morning/
// Afternoon/Evening/All day) plus a free-text "HH:mm" row. Typing or clicking that row shows every
// 15-minute slot in the day, starting from the next one after "now" and wrapping fully around the
// clock, filterable by typing — picking one (or typing a valid time and pressing Enter/blurring) sets
// a custom time. Fully self-contained, no dependency on App.ui.quickAdd. The trigger chip, panel box,
// and preset-row look are shared chrome from App.ui.styles.flyout; only the input row and suggestion
// list are this module's own CSS (App.ui.styles.timePicker).
App.ui.timePicker = (function () {
  var SLOT_MINUTES = 15;
  var SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES; // 96
  var VISIBLE_SLOT_COUNT = 7; // owner spec: suggestion list is tall enough to show 7 spots, scrollable beyond that.

  var ICON_CLOCK_NEUTRAL =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle>' +
    '<polyline points="12 7 12 12 15.5 13.5"></polyline></svg>';

  // Same 4 named buckets App.tasks.timeBuckets works with — this module only changes how they're
  // presented, not what they mean.
  var PRESETS = [
    {
      value: 'morning',
      label: 'Morning',
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#f2994a" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="17" r="4"></circle>' +
        '<line x1="12" y1="2" x2="12" y2="6"></line><line x1="4" y1="17" x2="1.5" y2="17"></line>' +
        '<line x1="22.5" y1="17" x2="20" y2="17"></line><line x1="5.6" y1="10.6" x2="4" y2="9"></line>' +
        '<line x1="20" y1="9" x2="18.4" y2="10.6"></line></svg>',
    },
    {
      value: 'afternoon',
      label: 'Afternoon',
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#f2c94c" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"></circle>' +
        '<line x1="12" y1="2" x2="12" y2="4.5"></line><line x1="12" y1="19.5" x2="12" y2="22"></line>' +
        '<line x1="4" y1="12" x2="1.5" y2="12"></line><line x1="22.5" y1="12" x2="20" y2="12"></line>' +
        '<line x1="5.6" y1="5.6" x2="4" y2="4"></line><line x1="20" y1="20" x2="18.4" y2="18.4"></line>' +
        '<line x1="18.4" y1="5.6" x2="20" y2="4"></line><line x1="4" y1="20" x2="5.6" y2="18.4"></line></svg>',
    },
    {
      value: 'evening',
      label: 'Evening',
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#5b6dfa" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path></svg>',
    },
    {
      value: 'allday',
      label: 'All day',
      icon:
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#1cadb5" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle>' +
        '<polyline points="12 7 12 12 15.5 13.5"></polyline></svg>',
    },
  ];

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function findPreset(value) {
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].value === value) return PRESETS[i];
    }
    return null;
  }

  // "HH:mm" 24-hour only — the one format used everywhere else in this app (native <input type=time>
  // overlays, App.tasks.timeBuckets bucket defaults, etc.), so this never invents a second convention.
  function parseTypedTime(text) {
    var match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((text || '').trim());
    if (!match) return null;
    return pad2(parseInt(match[1], 10)) + ':' + match[2];
  }

  // Every 15-minute slot in the day (96 total), rotated to start at the next slot at-or-after "now"
  // (rounded up) and wrap fully around the clock — e.g. at 16:03 the list starts at 16:15 and ends at
  // 16:00, per owner spec ("a list of all possible times... up to the furthest time spot").
  function buildRotatedSlots(now) {
    var minutesNow = now.getHours() * 60 + now.getMinutes();
    var startSlot = Math.ceil(minutesNow / SLOT_MINUTES) % SLOTS_PER_DAY;
    var slots = [];
    for (var i = 0; i < SLOTS_PER_DAY; i++) {
      var slotIndex = (startSlot + i) % SLOTS_PER_DAY;
      var totalMinutes = slotIndex * SLOT_MINUTES;
      slots.push(pad2(Math.floor(totalMinutes / 60)) + ':' + pad2(totalMinutes % 60));
    }
    return slots;
  }

  // config: { container, getState(): {bucket, customTime}, onChange(bucket, customTime) }
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
      // Keeps focus off the button and on whatever had it (usually nothing yet) so a later click
      // inside the panel never gets cut short by the text input's blur handler hiding the panel —
      // same guard as the input's suggestion buttons below.
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

    // Explicit "no time" reset (owner, 2026-07-22) — resets back to the null/placeholder state a step
    // without a predefined time now deliberately leaves alone (App.ui.taskComposer.applyStepOnto).
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'crmtm-flyout-clear';
    clearBtn.textContent = 'No time';
    clearBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });
    clearBtn.addEventListener('click', function () {
      onChange(null, null);
      close();
    });
    panel.appendChild(clearBtn);

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'crmtm-tp-input';
    input.placeholder = 'HH:mm';
    input.autocomplete = 'off';
    panel.appendChild(input);

    var suggestionsEl = document.createElement('div');
    suggestionsEl.className = 'crmtm-tp-suggestions';
    panel.appendChild(suggestionsEl);

    wrap.appendChild(panel);
    container.appendChild(wrap);

    function currentCustomTime() {
      var s = getState();
      return s.bucket === 'custom' && s.customTime ? s.customTime : '';
    }

    function renderSuggestions(filterText) {
      suggestionsEl.innerHTML = '';
      var typed = (filterText || '').trim();
      var selected = currentCustomTime();
      var slots = buildRotatedSlots(App.core.timezone.now()).filter(function (slot) {
        return !typed || slot.indexOf(typed) === 0;
      });
      slots.forEach(function (slot) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'crmtm-tp-slot';
        if (slot === selected) btn.classList.add('is-selected');
        btn.textContent = slot;
        // Same focus guard as the preset buttons above — without it, the input's blur fires first,
        // hides the panel (display: none), and the click that should pick this slot never arrives.
        btn.addEventListener('mousedown', function (e) {
          e.preventDefault();
        });
        btn.addEventListener('click', function () {
          input.value = slot;
          onChange('custom', slot);
          close();
        });
        suggestionsEl.appendChild(btn);
      });
    }

    function commitTyped() {
      var normalized = parseTypedTime(input.value);
      if (normalized) {
        onChange('custom', normalized);
        input.value = normalized;
      } else {
        // Garbage input is never silently accepted — revert to whatever the real current value is
        // rather than leaving stray unparsed text sitting in the field.
        input.value = currentCustomTime();
      }
    }

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
      input.value = currentCustomTime();
      renderSuggestions(input.value);
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

    input.addEventListener('input', function () {
      renderSuggestions(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitTyped();
        close();
      }
    });
    input.addEventListener('blur', function () {
      commitTyped();
      close();
    });

    function renderTrigger() {
      var s = getState();
      var preset = s.bucket ? findPreset(s.bucket) : null;
      if (preset) {
        iconWrap.innerHTML = preset.icon;
        labelEl.textContent = preset.label;
        trigger.classList.remove('is-placeholder');
        trigger.classList.add('is-set');
      } else if (s.bucket === 'custom' && s.customTime) {
        iconWrap.innerHTML = ICON_CLOCK_NEUTRAL;
        labelEl.textContent = s.customTime;
        trigger.classList.remove('is-placeholder');
        trigger.classList.add('is-set');
      } else {
        iconWrap.innerHTML = ICON_CLOCK_NEUTRAL;
        labelEl.textContent = 'Time';
        trigger.classList.add('is-placeholder');
        trigger.classList.remove('is-set');
      }
      // `error` (optional on getState's return value, owner 2026-07-22): caller sets this once a
      // submit was attempted with no time picked — highlights the trigger red until a time is set.
      trigger.classList.toggle('is-error', !!s.error);
    }

    function refresh() {
      renderTrigger();
      if (!panel.hidden) renderSuggestions(input.value);
    }

    function destroy() {
      close();
    }

    refresh();

    return { refresh: refresh, close: close, destroy: destroy };
  }

  return {
    PRESETS: PRESETS,
    create: create,
  };
})();
