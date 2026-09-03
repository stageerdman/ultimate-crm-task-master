// requires: App.core.settings
'use strict';
App.ui = App.ui || {};
// A plain form over App.core.settings: Notion API key + Contacts/Tasks database IDs, timezone, the
// time-of-day bucket defaults, and the workflow config as raw validated JSON. Mostly rebuilt from the
// predecessor's settingsPanel.js, not ported — PIT/Location ID, GHL user linking, and the remote
// update-checking section were all GHL-loader-specific (this project has no remote distribution
// mechanism, CLAUDE.md §4/§1). Kept: the form pattern itself (labeled rows, JSON-textarea-with-
// validation, all-or-nothing save) and `render(container)` rebuilding fresh from whatever's saved, same
// stateless pattern App.ui.fullScreen's other tabs use.
App.ui.settingsPanel = (function () {
  function labeledRow(labelText, controlEl) {
    var row = document.createElement('div');
    row.className = 'crmtm-settings-row';
    var label = document.createElement('label');
    label.className = 'crmtm-settings-label';
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(controlEl);
    return row;
  }

  function timeInput(value) {
    var input = document.createElement('input');
    input.type = 'time';
    input.className = 'crmtm-fs-input';
    input.value = value || '';
    return input;
  }

  function textInput(value, type) {
    var input = document.createElement('input');
    input.type = type || 'text';
    input.className = 'crmtm-fs-input';
    input.value = value || '';
    return input;
  }

  function render(container) {
    container.innerHTML = '';
    var settings = App.core.settings.load();

    var box = document.createElement('div');
    box.className = 'crmtm-settings';
    container.appendChild(box);

    var apiKeyInput = textInput(settings.notionApiKey, 'password');
    box.appendChild(labeledRow('Notion API key', apiKeyInput));

    var contactsDbInput = textInput(settings.contactsDatabaseId, 'text');
    box.appendChild(labeledRow('Contacts database ID', contactsDbInput));

    var tasksDbInput = textInput(settings.tasksDatabaseId, 'text');
    box.appendChild(labeledRow('Tasks database ID', tasksDbInput));

    var timezoneInput = textInput(settings.timezone, 'text');
    timezoneInput.placeholder = 'e.g. America/New_York';
    box.appendChild(labeledRow('Timezone (IANA)', timezoneInput));

    var reservedInputs = {
      morning: timeInput(settings.reservedTimes.morning),
      afternoon: timeInput(settings.reservedTimes.afternoon),
      evening: timeInput(settings.reservedTimes.evening),
      allday: timeInput(settings.reservedTimes.allday),
    };
    box.appendChild(labeledRow('Morning bucket default time', reservedInputs.morning));
    box.appendChild(labeledRow('Afternoon bucket default time', reservedInputs.afternoon));
    box.appendChild(labeledRow('Evening bucket default time', reservedInputs.evening));
    box.appendChild(labeledRow('All-day bucket default time', reservedInputs.allday));

    var workflowTextarea = document.createElement('textarea');
    workflowTextarea.className = 'crmtm-settings-textarea';
    workflowTextarea.value = JSON.stringify(settings.workflow, null, 2);
    box.appendChild(labeledRow('Workflow config (JSON)', workflowTextarea));

    var statusEl = document.createElement('div');
    statusEl.className = 'crmtm-settings-status';
    var errorEl = document.createElement('div');
    errorEl.className = 'crmtm-settings-error';
    errorEl.style.display = 'none';

    function showError(message) {
      errorEl.textContent = message;
      errorEl.style.display = '';
      statusEl.textContent = '';
    }

    function showStatus(message) {
      statusEl.textContent = message;
      errorEl.style.display = 'none';
    }

    // All-or-nothing save: a malformed workflow JSON or bad time format blocks the whole save rather
    // than silently discarding it or saving everything else around it.
    function handleSave() {
      var timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
      var reservedTimes = {};
      for (var bucket in reservedInputs) {
        if (!Object.prototype.hasOwnProperty.call(reservedInputs, bucket)) continue;
        var value = reservedInputs[bucket].value;
        if (!timePattern.test(value)) {
          showError('Bucket times must be in HH:mm 24-hour format (got "' + value + '" for ' + bucket + ').');
          return;
        }
        reservedTimes[bucket] = value;
      }
      var workflow;
      try {
        workflow = JSON.parse(workflowTextarea.value);
      } catch (parseError) {
        showError('Workflow config is not valid JSON: ' + parseError.message);
        return;
      }
      var timezone = timezoneInput.value.trim();
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC' });
      } catch (tzError) {
        showError('Timezone "' + timezone + '" is not a recognized IANA zone name.');
        return;
      }

      App.core.settings.save({
        notionApiKey: apiKeyInput.value.trim(),
        contactsDatabaseId: contactsDbInput.value.trim(),
        tasksDatabaseId: tasksDbInput.value.trim(),
        timezone: timezone || 'UTC',
        reservedTimes: reservedTimes,
        workflow: workflow,
      });
      showStatus('Saved.');
    }

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'crmtm-btn crmtm-settings-save';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', handleSave);

    var actions = document.createElement('div');
    actions.className = 'crmtm-settings-actions';
    actions.appendChild(saveBtn);
    box.appendChild(actions);
    box.appendChild(statusEl);
    box.appendChild(errorEl);
  }

  return {
    render: render,
  };
})();
