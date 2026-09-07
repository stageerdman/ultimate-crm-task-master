// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Shared chrome for every trigger-chip + dropdown-panel field in the UI (date picker, time picker,
// and anything future) — the trigger look, the panel box, the "flip above/below" positioning, and the
// preset-option-row look are all identical across fields, so they live here once instead of being
// duplicated per component. Each field's own style file (src/ui/styles/datePicker.js,
// src/ui/styles/timePicker.js) only holds CSS for content that's actually unique to it (the calendar
// grid, the time-suggestion list).
App.ui.styles.flyout = [
  '.crmtm-flyout-wrap { position: relative; display: inline-block; }',
  '',
  '.crmtm-flyout-trigger {',
  '  display: flex; align-items: center; gap: 4px; background: var(--crmtm-bg-hover);',
  '  border: 1px solid var(--crmtm-border); border-radius: var(--crmtm-radius-sm); color: var(--crmtm-text);',
  '  font-size: 12px; padding: 5px 8px; cursor: pointer; white-space: nowrap;',
  '}',
  '.crmtm-flyout-trigger:hover { background: var(--crmtm-bg-pressed); }',
  '.crmtm-flyout-trigger.is-placeholder { color: var(--crmtm-text-muted); }',
  '.crmtm-flyout-trigger.is-set {',
  '  color: var(--crmtm-accent); border-color: var(--crmtm-accent-bg); background: var(--crmtm-accent-bg);',
  '}',
  // Missing-required-field highlight (owner, 2026-07-22: task cannot be added without a date/time, and
  // whichever one is missing should highlight red) — wins over is-placeholder/is-set since a required
  // field left empty is a real error, not just an unset-but-fine default.
  '.crmtm-flyout-trigger.is-error {',
  '  color: var(--crmtm-danger); border-color: var(--crmtm-danger); background: var(--crmtm-danger-bg);',
  '}',
  '.crmtm-flyout-trigger-icon { display: flex; flex-shrink: 0; }',
  '.crmtm-flyout-trigger-icon svg { display: block; }',
  '',
  // position/top/left/bottom below are just a sane default before JS ever measures anything — every
  // instance is portaled out of `.crmtm-flyout-wrap` and repositioned (position: fixed) against its
  // trigger's live bounding rect via App.ui.floatingPanel.positionPortal on each open, which is what
  // actually decides above-vs-below and keeps it from being clipped by a scrollable ancestor.
  // z-index must match the shell's own (src/ui/styles/shell.js, src/ui/styles/filterSortBar.js) —
  // portaled out of `.crmtm-flyout-wrap`, this panel is now a *sibling* of the shell/full-screen
  // container in the shadow root rather than its descendant, so it competes against the shell's
  // z-index directly instead of inheriting a stacking context where any value would do.
  '.crmtm-flyout-panel {',
  '  position: fixed; width: 220px;',
  '  background: var(--crmtm-bg-raised); border: 1px solid var(--crmtm-border); border-radius: var(--crmtm-radius);',
  '  box-shadow: var(--crmtm-shadow); padding: 6px; z-index: 2147483647;',
  '}',
  '.crmtm-flyout-panel[hidden] { display: none; }',
  '',
  '.crmtm-flyout-options {',
  '  display: flex; flex-direction: column; gap: 1px; padding-bottom: 6px; margin-bottom: 6px;',
  '  border-bottom: 1px solid var(--crmtm-border);',
  '}',
  '',
  '.crmtm-flyout-option {',
  '  display: flex; align-items: center; gap: 8px; background: none; border: none; width: 100%;',
  '  padding: 6px 8px; border-radius: var(--crmtm-radius-sm); font-size: 12.5px; color: var(--crmtm-text);',
  '  cursor: pointer; text-align: left;',
  '}',
  '.crmtm-flyout-option:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-flyout-option-icon { display: flex; flex-shrink: 0; }',
  '.crmtm-flyout-option-icon svg { display: block; }',
  '',
  // Explicit reset-to-placeholder action (owner, 2026-07-22: "or just empty date... when that option
  // is selected") — a plain text row, deliberately not styled like a colored preset, since it un-sets
  // rather than sets a value.
  '.crmtm-flyout-clear {',
  '  display: block; width: 100%; background: none; border: none; padding: 4px 8px;',
  '  font-size: 11.5px; color: var(--crmtm-text-muted); cursor: pointer; text-align: left;',
  '}',
  '.crmtm-flyout-clear:hover { color: var(--crmtm-text); text-decoration: underline; }',
].join('\n');
