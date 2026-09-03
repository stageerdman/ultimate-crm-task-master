// requires: App.core.log, App.core.notionClient, App.core.settings, App.core.timezone,
// App.tasks.workflowEngine, App.tasks.contactNameCache, App.ui.typePicker, App.ui.stepPicker,
// App.ui.datePicker, App.ui.timePicker, App.ui.taskComposer
'use strict';
App.ui = App.ui || {};
// Shown right after a completed-toggle is confirmed: "Add follow-up task" popup, prefilled with the
// next workflow step for the same stage. Reuses the exact same type/step/date/time/note row as quick-add
// (same look), but owns its own per-show state and a fixed, explicit contactId (the just-finished task's
// contact, which is often not whatever contact the current page happens to be on).
App.ui.followUpPrompt = (function () {
  // Seeds the popup's state from the task that was just marked completed: same stage as before, but
  // stepped to the workflow's next entry in that stage (or, if that step was the stage's last one, the
  // same step again) — App.tasks.workflowEngine.nextStepOrSame is the one place this rule lives.
  // Schedule (date/time) is always freshly resolved from "now," never copied from the finished task's
  // own (now-past) due date.
  function buildPrefillState(task) {
    var state = {
      stage: task.stage || '',
      day: task.day,
      call: task.call,
      total: task.total,
      modifier: task.modifier || '',
      note: task.note || '',
      dateMode: null,
      customDate: null,
      timeBucket: null,
      customTime: null,
      submitting: false,
      error: null,
      validationAttempted: false,
    };
    var config = App.core.settings.load().workflow;
    if (task.stage && config && config.stages && config.stages[task.stage]) {
      var scoped = App.tasks.workflowEngine.scopeToStage(config, task.stage);
      var next = App.tasks.workflowEngine.nextStepOrSame(scoped, {
        stage: task.stage,
        day: task.day,
        call: task.call,
      });
      if (next) App.ui.taskComposer.applyStepOnto(state, next, App.core.timezone.now());
    }
    return state;
  }

  function mount(container) {
    var state = null;
    var contactId = null;

    var overlay = document.createElement('div');
    overlay.className = 'crmtm-fup-overlay';
    container.appendChild(overlay);

    var box = document.createElement('div');
    box.className = 'crmtm-fup-box';
    overlay.appendChild(box);

    var heading = document.createElement('div');
    heading.className = 'crmtm-fup-heading';
    heading.textContent = 'Add follow-up task';
    box.appendChild(heading);

    var contactLabel = document.createElement('div');
    contactLabel.className = 'crmtm-fup-contact';
    box.appendChild(contactLabel);

    // Identical control row to App.ui.quickAdd's compact-bar row — same mount-point classes so the
    // shared crmtm-qa-* styles apply unchanged.
    var row = document.createElement('div');
    row.className = 'crmtm-qa-row';
    box.appendChild(row);

    var typeMount = document.createElement('div');
    typeMount.className = 'crmtm-qa-type-mount';
    row.appendChild(typeMount);

    var stepMount = document.createElement('div');
    stepMount.className = 'crmtm-qa-step-mount';
    row.appendChild(stepMount);

    var dateMount = document.createElement('div');
    dateMount.className = 'crmtm-qa-date-mount';
    row.appendChild(dateMount);

    var timeMount = document.createElement('div');
    timeMount.className = 'crmtm-qa-time-mount';
    row.appendChild(timeMount);

    var noteWrap = document.createElement('div');
    noteWrap.className = 'crmtm-qa-note-wrap';
    var noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'crmtm-qa-input crmtm-qa-note';
    noteInput.maxLength = 28;
    noteInput.placeholder = 'note';
    var noteCounter = document.createElement('span');
    noteCounter.className = 'crmtm-qa-counter';
    noteWrap.appendChild(noteInput);
    noteWrap.appendChild(noteCounter);
    row.appendChild(noteWrap);

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'crmtm-btn crmtm-qa-add';
    addBtn.textContent = 'Add';
    row.appendChild(addBtn);

    var titlePreview = document.createElement('div');
    titlePreview.className = 'crmtm-qa-title';
    box.appendChild(titlePreview);

    var error = document.createElement('div');
    error.className = 'crmtm-qa-error';
    error.style.display = 'none';
    box.appendChild(error);

    function composeTitle() {
      return App.ui.taskComposer.composeTitle(state);
    }

    function refreshFields() {
      titlePreview.textContent = composeTitle();
      typePickerCtrl.refresh();
      stepPickerCtrl.refresh();
      datePickerCtrl.refresh();
      timePickerCtrl.refresh();
      noteInput.value = state.note;
      noteCounter.textContent = state.note.length + '/28';
    }

    function showError(message) {
      state.error = message;
      error.textContent = message;
      error.style.display = '';
    }

    function clearError() {
      if (state) state.error = null;
      error.style.display = 'none';
    }

    function setBusy(busy) {
      addBtn.disabled = busy;
      addBtn.textContent = busy ? 'Adding…' : 'Add';
    }

    function hide() {
      overlay.classList.remove('is-open');
      state = null;
      contactId = null;
    }

    function handleSubmit() {
      if (!state || state.submitting) return;
      clearError();
      if (!contactId) {
        showError('No contact on the finished task — cannot create a follow-up.');
        return;
      }
      if (!state.stage) {
        showError('No task type selected.');
        return;
      }
      if (!state.dateMode || !state.timeBucket) {
        state.validationAttempted = true;
        refreshFields();
        showError(!state.dateMode && !state.timeBucket ? 'Pick a date and time.' : !state.dateMode ? 'Pick a date.' : 'Pick a time.');
        return;
      }

      var title = composeTitle();
      var fields = {
        title: title,
        contactId: contactId,
        due: App.ui.taskComposer.composeDueDate(state),
        status: 'Planned',
        note: state.note,
        stage: state.stage,
        day: state.day === undefined ? null : state.day,
        call: state.call === undefined ? null : state.call,
        total: state.total === undefined ? null : state.total,
        modifier: state.modifier,
      };

      state.submitting = true;
      setBusy(true);

      App.core.notionClient.createTask(fields).then(
        function () {
          App.core.log('followUpPrompt: created task:', title);
          setBusy(false);
          hide();
        },
        function (err) {
          App.core.log('followUpPrompt: create failed:', err.message);
          if (!state) return;
          state.submitting = false;
          setBusy(false);
          showError('Failed to create task: ' + err.message);
        }
      );
    }

    var typePickerCtrl = App.ui.typePicker.create({
      container: typeMount,
      getState: function () {
        return { stage: state ? state.stage : '' };
      },
      onChange: function (stage) {
        var config = App.core.settings.load().workflow;
        var firstStep = App.tasks.workflowEngine.flattenSteps(
          App.tasks.workflowEngine.scopeToStage(config, stage)
        )[0];
        if (firstStep) {
          App.ui.taskComposer.applyStepOnto(state, firstStep, App.core.timezone.now());
        } else {
          state.stage = stage;
        }
        refreshFields();
        clearError();
      },
      onInvalid: function (typed) {
        showError('Unknown task type "' + typed + '".');
      },
    });

    var stepPickerCtrl = App.ui.stepPicker.create({
      container: stepMount,
      getState: function () {
        return state
          ? { stage: state.stage, day: state.day, call: state.call, total: state.total }
          : { stage: '', day: null, call: null, total: null };
      },
      onChange: function (step) {
        App.ui.taskComposer.applyStepOnto(state, step, App.core.timezone.now());
        refreshFields();
        clearError();
      },
      onInvalid: function (typed) {
        showError('Unknown step "' + typed + '".');
      },
    });

    var datePickerCtrl = App.ui.datePicker.create({
      container: dateMount,
      getState: function () {
        return state
          ? { mode: state.dateMode, date: state.customDate, error: state.validationAttempted && !state.dateMode }
          : { mode: null, date: null };
      },
      onChange: function (mode, date) {
        state.dateMode = mode;
        state.customDate = date;
        refreshFields();
        clearError();
      },
    });

    var timePickerCtrl = App.ui.timePicker.create({
      container: timeMount,
      getState: function () {
        return state
          ? { bucket: state.timeBucket, customTime: state.customTime, error: state.validationAttempted && !state.timeBucket }
          : { bucket: null, customTime: null };
      },
      onChange: function (bucket, customTime) {
        state.timeBucket = bucket;
        if (customTime) state.customTime = customTime;
        refreshFields();
        clearError();
      },
    });

    noteInput.addEventListener('input', function () {
      if (!state) return;
      state.note = noteInput.value.slice(0, 28);
      titlePreview.textContent = composeTitle();
      noteCounter.textContent = state.note.length + '/28';
      clearError();
    });
    noteInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSubmit();
    });
    addBtn.addEventListener('click', handleSubmit);

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) hide();
    });
    function onDocKeyDown(e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) hide();
    }
    document.addEventListener('keydown', onDocKeyDown, true);

    // task: a decorated task (App.core.notionClient.decorateTask), needs .contactId.
    function show(task) {
      if (!task || !task.contactId) return;
      contactId = task.contactId;
      state = buildPrefillState(task);
      contactLabel.textContent = App.tasks.contactNameCache.get(contactId) || 'Loading contact…';
      App.tasks.contactNameCache.fetch(contactId, function (name) {
        if (contactId === task.contactId) contactLabel.textContent = name || 'Unknown contact';
      });
      refreshFields();
      clearError();
      setBusy(false);
      overlay.classList.add('is-open');
    }

    function destroy() {
      hide();
      document.removeEventListener('keydown', onDocKeyDown, true);
    }

    return {
      show: show,
      hide: hide,
      destroy: destroy,
    };
  }

  return {
    mount: mount,
  };
})();
