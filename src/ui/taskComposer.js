// requires: App.core.timezone, App.tasks.timeBuckets, App.tasks.workflowEngine, App.ui.datePicker
'use strict';
App.ui = App.ui || {};
// Shared "workflow-encoded state -> due date" logic, used by App.ui.quickAdd, App.ui.taskEditPanel, and
// App.ui.followUpPrompt so none of them duplicate it (CLAUDE.md §1 — shared helpers never get
// copy-pasted across modules). Callers hand it a plain state object shaped { stage, day, call, total,
// modifier, note, dateMode, customDate, timeBucket, customTime } — quick-add's live form state, or a
// task-edit-panel state seeded from an existing task's real Stage/Day/Call/Total/Note/Due Date
// properties. Unlike the predecessor project, composeTitle here is write-only cosmetic display text —
// Stage/Day/Call/Total/Modifier/Note are real Notion properties and are always the source of truth,
// never parsed back out of the title.
App.ui.taskComposer = (function () {
  // Resolves the auto-fill date + time bucket for a workflow step at selection time. "day" offsets are
  // always measured from *today*, since nothing here tracks a contact's actual stage-entry date. A step
  // doesn't have to define `day` or `time` at all — date and time are resolved independently, and
  // either comes back `undefined` when the step doesn't define it, which applyStepOnto below reads as
  // "leave whatever is already selected alone" rather than forcing a value.
  function resolveStepSchedule(step, now) {
    var result = {};
    if (step.time === 'smart_next' || step.time === 'smart_next_day') {
      var smart = App.tasks.timeBuckets.resolveSmartTime(now, step.time);
      var bucket = App.tasks.timeBuckets.getBucketForTime(smart.timeValue);
      result.date = smart.date;
      result.timeBucket = bucket || 'custom';
      result.customTime = bucket ? '09:00' : smart.timeValue;
      return result;
    }
    // `dateOffsetDays` is a plain data field, not a rule: some steps' due date is meant to diverge from
    // their own `day` label — `day` still drives identity unchanged, this only overrides where the
    // date computation looks.
    if (step.dateOffsetDays !== undefined && step.dateOffsetDays !== null) {
      var base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      base.setDate(base.getDate() + step.dateOffsetDays);
      result.date = base;
    } else if (step.day !== undefined && step.day !== null) {
      result.date = App.tasks.workflowEngine.resolveStepDayOffset(step, now, now);
    }
    if (step.time) {
      if (App.tasks.timeBuckets.bucketTime(step.time)) {
        result.timeBucket = step.time;
        result.customTime = '09:00';
      } else {
        // Literal "HH:mm" from the workflow config.
        result.timeBucket = 'custom';
        result.customTime = step.time;
      }
    }
    return result;
  }

  // Modifier is never a manually-typed field — it comes only from the selected step's workflow config
  // and rides along into the task's Modifier property.
  function applyStepOnto(target, step, now) {
    var schedule = resolveStepSchedule(step, now);
    target.stage = step.stage;
    target.day = step.day;
    target.call = step.call;
    target.total = step.total;
    target.modifier = step.modifier || '';
    if (schedule.date !== undefined) {
      var dateInfo = App.ui.datePicker.modeFromDate(schedule.date, now);
      target.dateMode = dateInfo.mode;
      target.customDate = dateInfo.date;
    }
    if (schedule.timeBucket !== undefined) {
      target.timeBucket = schedule.timeBucket;
      target.customTime = schedule.customTime;
    }
  }

  // Builds the Notion page's Task (title) text from the current state — cosmetic only. Unlike the
  // predecessor's titleEncoder, this is never parsed back: Stage/Day/Call/Total/Modifier/Note are always
  // read directly from their own real Notion properties, so a stale or hand-edited title in Notion can
  // never desync the app's understanding of a task.
  function composeTitle(state) {
    var title = state.stage || '';
    if (state.day !== undefined && state.day !== null) title += state.day;
    if (state.call !== undefined && state.call !== null && state.total !== undefined && state.total !== null) {
      title += ' ' + state.call + '/' + state.total;
    }
    if (state.modifier) title += ' + ' + state.modifier;
    if (state.note) title += ' | ' + state.note;
    return title || 'Task';
  }

  // Every hh/mm/date this function touches is meant as the configured-timezone wall-clock time, not
  // the browser's local time. The date/time fields are all built and read as wall-clock components
  // right up until the last line, where fromWallClock converts them to the one real, correct-instant
  // Date this function hands back (as an ISO string, ready for Notion's Due Date property).
  function composeDueDate(state) {
    var timeValue =
      state.timeBucket === 'custom' ? state.customTime : App.tasks.timeBuckets.bucketTime(state.timeBucket);
    var match = /^(\d{1,2}):(\d{2})$/.exec(timeValue || '');
    var hh = match ? parseInt(match[1], 10) : 0;
    var mm = match ? parseInt(match[2], 10) : 0;
    // dateMode is only ever null before a type is selected; every caller gates submission on a type
    // being selected first, so the "|| wallClockNow" fallback is defensive, not expected to fire.
    var wallClockNow = App.core.timezone.now();
    var d = App.ui.datePicker.resolveDate(state.dateMode, state.customDate, wallClockNow) || wallClockNow;
    var wallClock = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
    return App.core.timezone.fromWallClock(wallClock).toISOString();
  }

  return {
    resolveStepSchedule: resolveStepSchedule,
    applyStepOnto: applyStepOnto,
    composeTitle: composeTitle,
    composeDueDate: composeDueDate,
  };
})();
