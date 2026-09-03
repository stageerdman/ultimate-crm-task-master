// requires: App.core.log, App.core.notionClient, App.core.settings, App.core.timezone,
// App.tasks.workflowEngine, App.ui.typePicker, App.ui.stepPicker, App.ui.datePicker, App.ui.timePicker,
// App.ui.taskComposer
'use strict';
App.ui = App.ui || {};
// Compact-bar quick-add row: type/step/date/time/note controls, composing a Notion task create call
// instead of the predecessor's title-encoded GHL task. Ported structure verbatim from the predecessor's
// quickAdd.js; the only real changes are the create payload (real Stage/Day/Call/Total/Note properties
// via App.core.notionClient instead of a title string) and contact resolution, which now comes from the
// mapping engine's matched contact (opts.getContactId()) instead of a GHL URL regex.
App.ui.quickAdd = (function () {
  // Module-level (not per-mount) so a half-built entry survives collapsing/expanding the bar — the
  // shell tears down and rebuilds the bar's DOM on every density change, but this state object is not
  // part of that DOM and outlives it.
  var state = null;

  function applyStep(step, now) {
    App.ui.taskComposer.applyStepOnto(state, step, now);
  }

  function defaultState() {
    var fresh = {
      stage: '',
      day: null,
      call: null,
      total: null,
      modifier: '',
      note: '',
      // Stays null (renders as the "Date"/"Time" placeholder) until a workflow step that defines one
      // auto-fills it, or the user explicitly picks something. Steps that don't define a day/time
      // deliberately leave these untouched rather than forcing a value — see taskComposer.applyStepOnto.
      dateMode: null,
      customDate: null,
      timeBucket: null,
      customTime: null,
      submitting: false,
      error: null,
      // Flips true the first time a submit is blocked for a missing date/time, so the missing field(s)
      // highlight red. Deliberately NOT cleared on every field change — only a fresh defaultState()
      // resets it.
      validationAttempted: false,
    };
    var config = App.core.settings.load().workflow;
    var firstStage = config && config.stages ? Object.keys(config.stages)[0] : null;
    if (firstStage) {
      var firstStep = App.tasks.workflowEngine.flattenSteps(
        App.tasks.workflowEngine.scopeToStage(config, firstStage)
      )[0];
      if (firstStep) App.ui.taskComposer.applyStepOnto(fresh, firstStep, App.core.timezone.now());
    }
    return fresh;
  }

  function composeTitle() {
    return App.ui.taskComposer.composeTitle(state);
  }

  function refreshFields(els) {
    els.titlePreview.textContent = composeTitle();

    els.typePickerCtrl.refresh();
    els.stepPickerCtrl.refresh();

    els.datePickerCtrl.refresh();
    els.timePickerCtrl.refresh();

    els.noteInput.value = state.note;
    updateNotePill(els);
    updateCounter(els);
  }

  function updateNotePill(els) {
    if (state.note) {
      els.notePill.textContent = state.note;
      els.notePill.style.display = '';
    } else {
      els.notePill.style.display = 'none';
    }
  }

  function updateCounter(els) {
    els.noteCounter.textContent = state.note.length + '/28';
  }

  function showError(els, message) {
    state.error = message;
    els.error.textContent = message;
    els.error.style.display = '';
  }

  function clearError(els) {
    state.error = null;
    els.error.style.display = 'none';
  }

  function setBusy(els, busy) {
    els.addBtn.disabled = busy;
    els.addBtn.textContent = busy ? 'Adding…' : 'Add';
  }

  function selectType(els, stage) {
    var config = App.core.settings.load().workflow;
    var firstStep = App.tasks.workflowEngine.flattenSteps(
      App.tasks.workflowEngine.scopeToStage(config, stage)
    )[0];
    if (firstStep) {
      applyStep(firstStep, App.core.timezone.now());
    } else {
      state.stage = stage;
      state.day = null;
      state.call = null;
      state.total = null;
      state.modifier = '';
    }
    refreshFields(els);
    clearError(els);
  }

  function chooseStep(els, step) {
    applyStep(step, App.core.timezone.now());
    refreshFields(els);
    clearError(els);
  }

  function handleSubmit(els, opts) {
    if (state.submitting) return;
    clearError(els);

    var contactId = opts.getContactId();
    if (!contactId) {
      showError(els, 'No contact matched for this page yet — map this site or create the contact first.');
      return;
    }
    // A step no longer implies day/call/total all being set (a bare-code step may have none of them) —
    // state.stage alone is what a real step selection guarantees, so it's the only thing worth gating
    // submission on.
    if (!state.stage) {
      showError(els, 'No task type selected.');
      return;
    }
    // Both a date and a time are required to submit — a step may leave either unset (see
    // taskComposer.applyStepOnto), so this can't be folded into the stage check above.
    if (!state.dateMode || !state.timeBucket) {
      state.validationAttempted = true;
      refreshFields(els);
      showError(els, !state.dateMode && !state.timeBucket ? 'Pick a date and time.' : !state.dateMode ? 'Pick a date.' : 'Pick a time.');
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
    setBusy(els, true);

    App.core.notionClient.createTask(fields).then(
      function () {
        App.core.log('quickAdd: created task:', title);
        els.status.textContent = 'Added ' + title;
        els.status.style.display = '';
        if (opts.onCreated) opts.onCreated();
        // Resets to the first configured step of the first stage after a successful add — the
        // simplest predictable behavior.
        state = defaultState();
        refreshFields(els);
        state.submitting = false;
        setBusy(els, false);
      },
      function (error) {
        App.core.log('quickAdd: create failed:', error.message);
        // Never update optimistically: the form keeps every value the user had entered so they can
        // fix and retry, nothing is cleared on failure.
        showError(els, 'Failed to create task: ' + error.message);
        state.submitting = false;
        setBusy(els, false);
      }
    );
  }

  function bindField(input, event, onChange) {
    input.addEventListener(event, onChange);
  }

  function build(container, titleContainer) {
    var wrap = document.createElement('div');
    wrap.className = 'crmtm-quickadd';

    // Every control lives in one non-wrapping row.
    var row = document.createElement('div');
    row.className = 'crmtm-qa-row';
    wrap.appendChild(row);

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

    // Read-only computed task name — never a text input, fully derived from the type/step fields + note.
    // Rendered into the caller-supplied titleContainer (shell's header row) when one is given, so it
    // shares the header's height instead of living inside the (taller, wider) control row below.
    var titlePreview = document.createElement('div');
    titlePreview.className = 'crmtm-qa-title';
    (titleContainer || wrap).appendChild(titlePreview);

    var notePill = document.createElement('span');
    notePill.className = 'crmtm-qa-pill';
    wrap.appendChild(notePill);

    var status = document.createElement('div');
    status.className = 'crmtm-qa-status';
    status.style.display = 'none';
    wrap.appendChild(status);

    var error = document.createElement('div');
    error.className = 'crmtm-qa-error';
    error.style.display = 'none';
    wrap.appendChild(error);

    container.appendChild(wrap);

    return {
      titlePreview: titlePreview,
      typeMount: typeMount,
      stepMount: stepMount,
      dateMount: dateMount,
      timeMount: timeMount,
      noteInput: noteInput,
      noteCounter: noteCounter,
      notePill: notePill,
      addBtn: addBtn,
      status: status,
      error: error,
    };
  }

  function wireEvents(els, opts) {
    bindField(els.noteInput, 'input', function () {
      state.note = els.noteInput.value.slice(0, 28);
      els.titlePreview.textContent = composeTitle();
      updateNotePill(els);
      updateCounter(els);
      clearError(els);
    });
    els.noteInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSubmit(els, opts);
    });
    els.addBtn.addEventListener('click', function () {
      handleSubmit(els, opts);
    });
  }

  // opts: { titleContainer, getContactId(): pageId|null, onCreated() }
  function mount(container, opts) {
    opts = opts || {};
    if (!opts.getContactId) opts.getContactId = function () { return null; };
    if (!state) state = defaultState();
    var els = build(container, opts.titleContainer);

    els.typePickerCtrl = App.ui.typePicker.create({
      container: els.typeMount,
      getState: function () {
        return { stage: state.stage };
      },
      onChange: function (stage) {
        selectType(els, stage);
      },
      onInvalid: function (typed) {
        showError(els, 'Unknown task type "' + typed + '".');
      },
    });

    els.stepPickerCtrl = App.ui.stepPicker.create({
      container: els.stepMount,
      getState: function () {
        return { stage: state.stage, day: state.day, call: state.call, total: state.total };
      },
      onChange: function (step) {
        chooseStep(els, step);
      },
      onInvalid: function (typed) {
        showError(els, 'Unknown step "' + typed + '".');
      },
    });

    els.datePickerCtrl = App.ui.datePicker.create({
      container: els.dateMount,
      getState: function () {
        return { mode: state.dateMode, date: state.customDate, error: state.validationAttempted && !state.dateMode };
      },
      onChange: function (mode, date) {
        state.dateMode = mode;
        state.customDate = date;
        refreshFields(els);
        clearError(els);
      },
    });

    els.timePickerCtrl = App.ui.timePicker.create({
      container: els.timeMount,
      getState: function () {
        return {
          bucket: state.timeBucket,
          customTime: state.customTime,
          error: state.validationAttempted && !state.timeBucket,
        };
      },
      onChange: function (bucket, customTime) {
        state.timeBucket = bucket;
        if (customTime) state.customTime = customTime;
        refreshFields(els);
        clearError(els);
      },
    });

    wireEvents(els, opts);
    els.status.style.display = 'none';
    refreshFields(els);
  }

  return {
    mount: mount,
  };
})();
