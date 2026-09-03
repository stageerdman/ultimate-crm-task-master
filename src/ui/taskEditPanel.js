// requires: App.core.log, App.core.notionClient, App.core.settings, App.core.timezone,
// App.tasks.workflowEngine, App.tasks.timeBuckets, App.tasks.contactNameCache, App.ui.typePicker,
// App.ui.stepPicker, App.ui.datePicker, App.ui.timePicker, App.ui.taskComposer
'use strict';
App.ui = App.ui || {};
// Notion-style side panel: opens over the full-screen task list to edit an existing task, mounted once
// (App.ui.taskEditPanel.mount) and toggled open/closed per task via open(task)/close(). Reuses the exact
// same whisperer controls quick-add uses for type/step/date/time plus App.ui.taskComposer, so editing a
// task looks and behaves identically to creating one.
App.ui.taskEditPanel = (function () {
  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  // Seeds an edit-form state object from a decorated task (App.core.notionClient.decorateTask) — reads
  // Stage/Day/Call/Total/Modifier/Note directly, never parsed out of a title.
  function stateFromTask(task) {
    var due = task.due || new Date();
    // task.due is a real absolute instant; convert to the configured-zone wall-clock before reading any
    // calendar/time-of-day component from it.
    var wallClock = App.core.timezone.toWallClock(due);
    var hhmm = pad2(wallClock.getHours()) + ':' + pad2(wallClock.getMinutes());
    var bucket = App.tasks.timeBuckets.getBucketForTime(hhmm);
    var dateInfo = App.ui.datePicker.modeFromDate(wallClock, App.core.timezone.now());
    return {
      stage: task.stage || '',
      day: task.day,
      call: task.call,
      total: task.total,
      modifier: task.modifier || '',
      note: task.note || '',
      dateMode: dateInfo.mode,
      customDate: dateInfo.date,
      timeBucket: bucket || 'custom',
      customTime: bucket ? '09:00' : hhmm,
      completed: task.status === 'Completed',
      saving: false,
      error: null,
      validationAttempted: false,
    };
  }

  // config: { container, onOpenContact(contactId) }
  function mount(container, config) {
    config = config || {};
    var onOpenContact = config.onOpenContact || function () {};

    var editState = null;
    var currentTask = null;

    var overlay = document.createElement('div');
    overlay.className = 'crmtm-tep-overlay';
    container.appendChild(overlay);

    var panel = document.createElement('div');
    panel.className = 'crmtm-tep-panel';
    overlay.appendChild(panel);

    var header = document.createElement('div');
    header.className = 'crmtm-tep-header';
    panel.appendChild(header);

    var contactBtn = document.createElement('button');
    contactBtn.type = 'button';
    contactBtn.className = 'crmtm-tep-contact';
    header.appendChild(contactBtn);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'crmtm-tep-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close';
    header.appendChild(closeBtn);

    function field(labelText) {
      var wrap = document.createElement('div');
      wrap.className = 'crmtm-tep-field';
      var label = document.createElement('div');
      label.className = 'crmtm-tep-label';
      label.textContent = labelText;
      wrap.appendChild(label);
      var mountEl = document.createElement('div');
      wrap.appendChild(mountEl);
      panel.appendChild(wrap);
      return mountEl;
    }

    var typeMount = field('Type');
    var stepMount = field('Step');
    var dateMount = field('Date');
    var timeMount = field('Time');

    var noteWrap = document.createElement('div');
    noteWrap.className = 'crmtm-tep-field';
    var noteLabel = document.createElement('div');
    noteLabel.className = 'crmtm-tep-label';
    noteLabel.textContent = 'Note';
    noteWrap.appendChild(noteLabel);
    var noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'crmtm-tep-note';
    noteInput.maxLength = 28;
    noteWrap.appendChild(noteInput);
    panel.appendChild(noteWrap);

    var completedRow = document.createElement('label');
    completedRow.className = 'crmtm-tep-completed';
    var completedCheckbox = document.createElement('input');
    completedCheckbox.type = 'checkbox';
    var completedText = document.createElement('span');
    completedText.textContent = 'Completed';
    completedRow.appendChild(completedCheckbox);
    completedRow.appendChild(completedText);
    panel.appendChild(completedRow);

    var titlePreview = document.createElement('div');
    titlePreview.className = 'crmtm-tep-title';
    panel.appendChild(titlePreview);

    var errorEl = document.createElement('div');
    errorEl.className = 'crmtm-tep-error';
    errorEl.style.display = 'none';
    panel.appendChild(errorEl);

    var actions = document.createElement('div');
    actions.className = 'crmtm-tep-actions';
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'crmtm-btn crmtm-tep-save';
    saveBtn.textContent = 'Save';
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'crmtm-btn crmtm-tep-cancel';
    cancelBtn.textContent = 'Cancel';
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'crmtm-btn crmtm-tep-delete';
    deleteBtn.title = 'Delete task';
    deleteBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
      '<line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(deleteBtn);
    panel.appendChild(actions);

    function refreshAll() {
      titlePreview.textContent = App.ui.taskComposer.composeTitle(editState);
      typePickerCtrl.refresh();
      stepPickerCtrl.refresh();
      datePickerCtrl.refresh();
      timePickerCtrl.refresh();
      noteInput.value = editState.note;
      completedCheckbox.checked = editState.completed;
    }

    function showError(message) {
      editState.error = message;
      errorEl.textContent = message;
      errorEl.style.display = '';
    }

    function clearError() {
      editState.error = null;
      errorEl.style.display = 'none';
    }

    // Shared across save and delete so neither path can leave a button stuck disabled after the other's
    // close() — open() only ever resets all three together.
    function setBusy(busy) {
      saveBtn.disabled = busy;
      cancelBtn.disabled = busy;
      deleteBtn.disabled = busy;
      saveBtn.textContent = busy ? 'Saving…' : 'Save';
    }

    var typePickerCtrl = App.ui.typePicker.create({
      container: typeMount,
      getState: function () {
        return { stage: editState ? editState.stage : '' };
      },
      onChange: function (stage) {
        var config = App.core.settings.load().workflow;
        var firstStep = App.tasks.workflowEngine.flattenSteps(
          App.tasks.workflowEngine.scopeToStage(config, stage)
        )[0];
        if (firstStep) {
          App.ui.taskComposer.applyStepOnto(editState, firstStep, App.core.timezone.now());
        } else {
          editState.stage = stage;
        }
        refreshAll();
        clearError();
      },
      onInvalid: function (typed) {
        showError('Unknown task type "' + typed + '".');
      },
    });

    var stepPickerCtrl = App.ui.stepPicker.create({
      container: stepMount,
      getState: function () {
        return editState
          ? { stage: editState.stage, day: editState.day, call: editState.call, total: editState.total }
          : { stage: '', day: null, call: null, total: null };
      },
      onChange: function (step) {
        App.ui.taskComposer.applyStepOnto(editState, step, App.core.timezone.now());
        refreshAll();
        clearError();
      },
      onInvalid: function (typed) {
        showError('Unknown step "' + typed + '".');
      },
    });

    var datePickerCtrl = App.ui.datePicker.create({
      container: dateMount,
      getState: function () {
        return editState
          ? { mode: editState.dateMode, date: editState.customDate, error: editState.validationAttempted && !editState.dateMode }
          : { mode: null, date: null };
      },
      onChange: function (mode, date) {
        editState.dateMode = mode;
        editState.customDate = date;
        refreshAll();
        clearError();
      },
    });

    var timePickerCtrl = App.ui.timePicker.create({
      container: timeMount,
      getState: function () {
        return editState
          ? {
              bucket: editState.timeBucket,
              customTime: editState.customTime,
              error: editState.validationAttempted && !editState.timeBucket,
            }
          : { bucket: null, customTime: null };
      },
      onChange: function (bucket, customTime) {
        editState.timeBucket = bucket;
        if (customTime) editState.customTime = customTime;
        refreshAll();
        clearError();
      },
    });

    noteInput.addEventListener('input', function () {
      editState.note = noteInput.value.slice(0, 28);
      titlePreview.textContent = App.ui.taskComposer.composeTitle(editState);
      clearError();
    });

    completedCheckbox.addEventListener('change', function () {
      editState.completed = completedCheckbox.checked;
    });

    contactBtn.addEventListener('click', function () {
      if (currentTask && currentTask.contactId) onOpenContact(currentTask.contactId);
    });

    function close() {
      overlay.classList.remove('is-open');
      currentTask = null;
      editState = null;
    }

    function handleSave() {
      if (!currentTask || !currentTask.id) return;
      clearError();
      if (!editState.dateMode || !editState.timeBucket) {
        editState.validationAttempted = true;
        refreshAll();
        showError(
          !editState.dateMode && !editState.timeBucket
            ? 'Pick a date and time.'
            : !editState.dateMode
            ? 'Pick a date.'
            : 'Pick a time.'
        );
        return;
      }
      editState.saving = true;
      setBusy(true);

      var title = App.ui.taskComposer.composeTitle(editState);
      var due = App.ui.taskComposer.composeDueDate(editState);
      var taskId = currentTask.id;

      App.core.notionClient
        .updateTask(taskId, {
          title: title,
          due: due,
          status: editState.completed ? 'Completed' : 'Planned',
          note: editState.note,
          stage: editState.stage,
          day: editState.day === undefined ? null : editState.day,
          call: editState.call === undefined ? null : editState.call,
          total: editState.total === undefined ? null : editState.total,
          modifier: editState.modifier,
        })
        .then(
          function () {
            App.core.log('taskEditPanel: saved task:', title);
            setBusy(false);
            if (config.onSaved) config.onSaved();
            close();
          },
          function (error) {
            App.core.log('taskEditPanel: save failed:', error.message);
            editState.saving = false;
            setBusy(false);
            showError('Failed to save: ' + error.message);
          }
        );
    }

    // Single archive call — the predecessor's two-step unassign-then-delete only existed to work
    // around a real GHL task-search-index bug that never reconciled deletions; Notion has no equivalent
    // issue.
    function handleDelete() {
      if (!currentTask || !currentTask.id) return;
      if (!window.confirm('Delete this task? This cannot be undone.')) return;
      clearError();
      var taskId = currentTask.id;
      setBusy(true);
      App.core.notionClient.deleteTask(taskId).then(
        function () {
          App.core.log('taskEditPanel: deleted task:', taskId);
          setBusy(false);
          if (config.onSaved) config.onSaved();
          close();
        },
        function (error) {
          App.core.log('taskEditPanel: delete failed:', error.message);
          setBusy(false);
          showError('Failed to delete: ' + error.message);
        }
      );
    }

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', close);
    deleteBtn.addEventListener('click', handleDelete);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });

    function onDocKeyDown(e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    }
    document.addEventListener('keydown', onDocKeyDown, true);

    // task: a decorated task (App.core.notionClient.decorateTask).
    function open(task) {
      currentTask = task;
      editState = stateFromTask(task);
      contactBtn.textContent = App.tasks.contactNameCache.get(task.contactId) || 'Loading contact…';
      if (task.contactId) {
        App.tasks.contactNameCache.fetch(task.contactId, function (name) {
          if (currentTask === task) contactBtn.textContent = name || 'Unknown contact';
        });
      }
      refreshAll();
      clearError();
      setBusy(false);
      overlay.classList.add('is-open');
    }

    function destroy() {
      close();
      document.removeEventListener('keydown', onDocKeyDown, true);
    }

    return {
      open: open,
      close: close,
      destroy: destroy,
    };
  }

  return {
    mount: mount,
  };
})();
