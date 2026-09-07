// requires: App.core.settings, App.tasks.workflowEngine, App.ui.floatingPanel
'use strict';
App.ui = App.ui || {};
// The day/call-total ("number") field, rebuilt as the same "whisperer" combobox as App.ui.typePicker:
// a plain text input that opens a flip-aware, type-to-filter list of the *currently selected stage's*
// steps — never a global list, since each stage config defines its own distinct set of day/call/total
// combinations (owner: "each task type has a different number available"). Selecting works the same
// two ways as the type field: click a suggestion, or type the exact "day call/total" text and commit
// with Enter/blur; an unmatched typed value reverts to the last real step and reports onInvalid.
App.ui.stepPicker = (function () {
  // Matches the step chip's old display convention (day, two spaces, call/total) for a step that has
  // both. Grammar generalization (2026-07-22): a step may have only a day (e.g. "3"), only a call/total
  // (e.g. "2/2", SPLÁTKA), or neither (a bare-code stage with a single fixed step, e.g. M/MD/WP) — an
  // em dash stands in for that last case so the picker still has a clickable, distinct label.
  function formatStep(step) {
    var parts = [];
    if (step.day !== undefined && step.day !== null) parts.push(step.day);
    if (step.call !== undefined && step.call !== null && step.total !== undefined && step.total !== null) {
      parts.push(step.call + '/' + step.total);
    }
    return parts.length ? parts.join('  ') : '—';
  }

  function normalize(text) {
    return (text || '').replace(/\s+/g, '');
  }

  function stepsForStage(stage) {
    var config = App.core.settings.load().workflow;
    return App.tasks.workflowEngine.flattenSteps(App.tasks.workflowEngine.scopeToStage(config, stage));
  }

  function matchStep(stage, typed) {
    var target = normalize(typed);
    var steps = stepsForStage(stage);
    for (var i = 0; i < steps.length; i++) {
      if (normalize(formatStep(steps[i])) === target) return steps[i];
    }
    return null;
  }

  // config: { container, getState(): {stage, day, call, total}, onChange(step), onInvalid(typed) }
  function create(config) {
    var container = config.container;
    var getState = config.getState;
    var onChange = config.onChange;
    var onInvalid = config.onInvalid || function () {};

    var wrap = document.createElement('div');
    wrap.className = 'crmtm-flyout-wrap crmtm-step-wrap';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'crmtm-step-input';
    input.autocomplete = 'off';
    wrap.appendChild(input);

    var panel = document.createElement('div');
    panel.className = 'crmtm-flyout-panel';
    panel.hidden = true;

    var suggestionsEl = document.createElement('div');
    suggestionsEl.className = 'crmtm-step-suggestions';
    panel.appendChild(suggestionsEl);

    // Portaled straight into document.body (or the nearest shadow root) instead of `wrap`, and
    // positioned via App.ui.floatingPanel.positionPortal on every open — see floatingPanel.js. Otherwise
    // this panel is `position: absolute` inside `wrap`, and gets visually clipped whenever `wrap` sits
    // inside a scrollable ancestor.
    App.ui.floatingPanel.portalHost(wrap).appendChild(panel);
    container.appendChild(wrap);

    function currentLabel() {
      var s = getState();
      return formatStep({ day: s.day, call: s.call, total: s.total });
    }

    // Prefix-filtered against the normalized (whitespace-stripped) label, same convention as
    // App.ui.typePicker's stage-code filtering — full list on open, narrows as you type.
    function renderSuggestions(filterText) {
      suggestionsEl.innerHTML = '';
      var typed = normalize(filterText);
      var selected = currentLabel();
      var steps = stepsForStage(getState().stage).filter(function (step) {
        return !typed || normalize(formatStep(step)).indexOf(typed) === 0;
      });
      steps.forEach(function (step) {
        var label = formatStep(step);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'crmtm-step-option';
        if (label === selected) btn.classList.add('is-selected');
        btn.textContent = label;
        // Same guard as every other flyout's list buttons: without this, the input's blur handler
        // fires first on mousedown and hides the panel before the click can land on the button.
        btn.addEventListener('mousedown', function (e) {
          e.preventDefault();
        });
        btn.addEventListener('click', function () {
          input.value = label;
          onChange(step);
          close();
        });
        suggestionsEl.appendChild(btn);
      });
    }

    function commitTyped() {
      var typed = input.value.trim();
      if (!typed) {
        input.value = currentLabel();
        return;
      }
      var matched = matchStep(getState().stage, typed);
      if (matched) {
        onChange(matched);
        input.value = formatStep(matched);
      } else {
        input.value = currentLabel();
        onInvalid(typed);
      }
    }

    function onDocMouseDown(e) {
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(wrap) === -1 && path.indexOf(panel) === -1) close();
    }

    function onDocKeyDown(e) {
      if (e.key === 'Escape') close();
    }

    function open() {
      panel.hidden = false;
      renderSuggestions('');
      App.ui.floatingPanel.positionPortal(panel, input);
      App.ui.floatingPanel.registerPortal(panel);
      document.addEventListener('mousedown', onDocMouseDown, true);
      document.addEventListener('keydown', onDocKeyDown, true);
    }

    function close() {
      if (panel.hidden) return;
      panel.hidden = true;
      App.ui.floatingPanel.unregisterPortal(panel);
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onDocKeyDown, true);
    }

    input.addEventListener('focus', function () {
      open();
    });
    input.addEventListener('input', function () {
      if (panel.hidden) open();
      else renderSuggestions(input.value);
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

    function refresh() {
      input.value = currentLabel();
      if (!panel.hidden) renderSuggestions(input.value);
    }

    function destroy() {
      close();
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }

    refresh();

    return { refresh: refresh, close: close, destroy: destroy };
  }

  return { create: create, formatStep: formatStep };
})();
