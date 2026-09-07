// requires: App.core.settings, App.ui.floatingPanel
'use strict';
App.ui = App.ui || {};
// A Todoist/combobox-style "whisperer" for the stage/type field: the visible element is always a
// plain text input (never a click-to-open trigger button, since typing is the primary way in), but
// focusing or typing it opens a floating list of matching stage codes underneath — portaled and
// positioned the same way as App.ui.datePicker / App.ui.timePicker (App.ui.floatingPanel.positionPortal),
// same panel chrome (App.ui.styles.flyout). The user can either click a filtered suggestion, or just type
// the full code and press Enter/blur — both paths commit through the same case-insensitive match against
// the current settings.workflow.stages keys. An unmatched typed value is never silently accepted: the
// field reverts to the last real stage and the caller is told via onInvalid so it can surface an
// error, exactly like the old native-datalist field did.
App.ui.typePicker = (function () {
  function stageCodes() {
    var config = App.core.settings.load().workflow;
    var stages = (config && config.stages) || {};
    return Object.keys(stages);
  }

  function matchStage(typed) {
    var codes = stageCodes();
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].toLowerCase() === typed.toLowerCase()) return codes[i];
    }
    return null;
  }

  // config: { container, getState(): {stage}, onChange(stage), onInvalid(typed) }
  function create(config) {
    var container = config.container;
    var getState = config.getState;
    var onChange = config.onChange;
    var onInvalid = config.onInvalid || function () {};

    var wrap = document.createElement('div');
    wrap.className = 'crmtm-flyout-wrap crmtm-typ-wrap';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'crmtm-typ-input';
    input.placeholder = 'Type';
    input.autocomplete = 'off';
    wrap.appendChild(input);

    var panel = document.createElement('div');
    panel.className = 'crmtm-flyout-panel';
    panel.hidden = true;

    var suggestionsEl = document.createElement('div');
    suggestionsEl.className = 'crmtm-typ-suggestions';
    panel.appendChild(suggestionsEl);

    // Portaled straight into document.body (or the nearest shadow root) instead of `wrap`, and
    // positioned via App.ui.floatingPanel.positionPortal on every open — see floatingPanel.js. Otherwise
    // this panel is `position: absolute` inside `wrap`, and gets visually clipped whenever `wrap` sits
    // inside a scrollable ancestor.
    App.ui.floatingPanel.portalHost(wrap).appendChild(panel);
    container.appendChild(wrap);

    function currentStage() {
      return getState().stage || '';
    }

    // Prefix-filtered, same convention as App.ui.timePicker's typed-time suggestions — narrows as you
    // type instead of requiring an exact match before anything shows.
    function renderSuggestions(filterText) {
      suggestionsEl.innerHTML = '';
      var typed = (filterText || '').trim().toLowerCase();
      var selected = currentStage();
      var codes = stageCodes().filter(function (code) {
        return !typed || code.toLowerCase().indexOf(typed) === 0;
      });
      codes.forEach(function (code) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'crmtm-typ-option';
        if (code === selected) btn.classList.add('is-selected');
        btn.textContent = code;
        // Same guard as every other flyout's list buttons: without this, the input's blur handler
        // fires first on mousedown and hides the panel before the click can land on the button.
        btn.addEventListener('mousedown', function (e) {
          e.preventDefault();
        });
        btn.addEventListener('click', function () {
          input.value = code;
          onChange(code);
          close();
        });
        suggestionsEl.appendChild(btn);
      });
    }

    function commitTyped() {
      var typed = input.value.trim();
      if (!typed) {
        input.value = currentStage();
        return;
      }
      var matched = matchStage(typed);
      if (matched) {
        onChange(matched);
        input.value = matched;
      } else {
        input.value = currentStage();
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
      // Show the full list on open rather than filtering by whatever value is already sitting in the
      // field (the current stage) — narrowing only starts once the user actually types, same as the
      // suggestion list staying unfiltered until you overwrite the field.
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
      input.value = currentStage();
      if (!panel.hidden) renderSuggestions(input.value);
    }

    function destroy() {
      close();
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }

    refresh();

    return { refresh: refresh, close: close, destroy: destroy };
  }

  return { create: create };
})();
