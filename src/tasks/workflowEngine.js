// requires: (none)
'use strict';
App.tasks = App.tasks || {};
// Generic "flatten a nested stage->steps config, find/cycle through it" utilities driving the
// type/step pickers' arrow-key cycling and the follow-up-task prefill. Ported verbatim from the
// predecessor project — no GHL coupling in any of it, and the owner confirmed (2026-09-03) the
// day/call/total call-cadence concept generalizes to any CRM, not just GHL.
App.tasks.workflowEngine = (function () {
  // Flattened, ordered list of every step across every stage, in config.stages key order then each
  // stage's own steps order — the arrow-key cycling order for quick-add.
  function flattenSteps(config) {
    var flattened = [];
    var stages = (config && config.stages) || {};
    Object.keys(stages).forEach(function (stageCode) {
      var steps = stages[stageCode].steps || [];
      steps.forEach(function (step) {
        flattened.push(Object.assign({ stage: stageCode }, step));
      });
    });
    return flattened;
  }

  // Hands back a config containing only one stage, so flattenSteps/nextStep/prevStep naturally cap
  // themselves to that stage's own step list — used by quick-add's step cycling and the step picker so
  // neither can ever suggest or cycle into a different stage's steps.
  function scopeToStage(config, stage) {
    var stages = {};
    if (config && config.stages && config.stages[stage]) {
      stages[stage] = config.stages[stage];
    }
    return { stages: stages };
  }

  // Compares all four identifying fields, not just stage/day/call — a day-less stage can have multiple
  // steps that share the same (absent) day and the same call with a different total, so total must be
  // part of identity or findIndex would always match the first of them and cycling would get stuck.
  function sameStep(a, b) {
    return a.stage === b.stage && a.day === b.day && a.call === b.call && a.total === b.total;
  }

  function findIndex(flattened, currentState) {
    for (var i = 0; i < flattened.length; i++) {
      if (sameStep(flattened[i], currentState)) return i;
    }
    return -1;
  }

  function nextStep(config, currentState) {
    var flattened = flattenSteps(config);
    var index = findIndex(flattened, currentState);
    if (index === -1 || index === flattened.length - 1) return null;
    return flattened[index + 1];
  }

  function prevStep(config, currentState) {
    var flattened = flattenSteps(config);
    var index = findIndex(flattened, currentState);
    if (index <= 0) return null;
    return flattened[index - 1];
  }

  // Like nextStep, but when currentState is already the last step in config it hands back that same
  // step instead of null — the follow-up-task popup's rule: "if task is at the end of the sequence, it
  // should just pre-fill identical sequence" rather than leaving nothing to prefill. Returns null only
  // if currentState isn't found in config at all.
  function nextStepOrSame(config, currentState) {
    var flattened = flattenSteps(config);
    var index = findIndex(flattened, currentState);
    if (index === -1) return null;
    return index === flattened.length - 1 ? flattened[index] : flattened[index + 1];
  }

  // "day" is an offset from the day the contact entered the stage, or from "today" if creating the
  // first step of a stage right now. day=1 means the entry day itself (zero offset); day=2 is the next
  // calendar day, etc.
  function resolveStepDayOffset(step, stageEnteredDate, now) {
    var base = stageEnteredDate || now;
    var result = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    result.setDate(result.getDate() + (step.day - 1));
    return result;
  }

  return {
    flattenSteps: flattenSteps,
    nextStep: nextStep,
    prevStep: prevStep,
    nextStepOrSame: nextStepOrSame,
    resolveStepDayOffset: resolveStepDayOffset,
    scopeToStage: scopeToStage,
  };
})();
