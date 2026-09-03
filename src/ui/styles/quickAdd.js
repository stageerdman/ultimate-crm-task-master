// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Quick-add chrome (control row, note, pill, status/error). The task-name preview
// (.crmtm-qa-title) is rendered by src/ui/quickAdd.js but, when mounted from the compact bar, lives
// physically inside src/ui/styles/shell.js's header row (.crmtm-bar-header) — this file still owns
// its look since quickAdd.js creates the element, but not its position. The type/step/date/time
// fields' own styling lives in src/ui/styles/typePicker.js, stepPicker.js, datePicker.js, and
// timePicker.js (plus shared flyout chrome in src/ui/styles/flyout.js) — kept separate so a future
// field-only change never has to touch this file (and vice versa).
App.ui.styles.quickAdd = [
  '.crmtm-quickadd { display: flex; flex-direction: column; gap: 4px; max-width: 540px; }',
  '',
  // Every control on one line, no wrap (owner: "let's make it a one liner") — the type field was
  // narrowed so this row fits without overflowing even with a wider note field.
  '.crmtm-qa-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 5px; }',
  '',
  // Task name is fully derived, never typed — small and gray (owner: "keep it small and gray"), and
  // deliberately styled with no layout assumptions of its own (no flex-basis, no margin) since it's
  // positioned by whatever container it's mounted into (the bar header's title slot in the compact
  // bar; falls back to this module's own wrap if mounted without one).
  '.crmtm-qa-title {',
  '  font-size: 11px; font-weight: 400; color: var(--crmtm-text-muted); white-space: nowrap;',
  '  overflow: hidden; text-overflow: ellipsis;',
  '}',
  '',
  '.crmtm-qa-type-mount, .crmtm-qa-step-mount, .crmtm-qa-date-mount, .crmtm-qa-time-mount {',
  '  display: inline-flex; flex-shrink: 0;',
  '}',
  '',
  '.crmtm-qa-input {',
  '  background: var(--crmtm-bg-hover); border: 1px solid var(--crmtm-border); color: var(--crmtm-text);',
  '  border-radius: var(--crmtm-radius-sm); padding: 5px 6px; font-size: 12px;',
  '}',
  '.crmtm-qa-input:focus { outline: 2px solid var(--crmtm-accent); }',
  '',
  // Widened again per owner feedback ("make the note wider") — still fixed rather than flex: 1, since
  // it only ever holds 28 characters and doesn't need to grow further with the row.
  '.crmtm-qa-note-wrap { position: relative; flex: 0 0 auto; width: 130px; }',
  '.crmtm-qa-note { width: 100%; padding-right: 28px; }',
  '.crmtm-qa-counter {',
  '  position: absolute; right: 5px; top: 50%; transform: translateY(-50%); font-size: 9.5px;',
  '  color: var(--crmtm-text-faint); pointer-events: none;',
  '}',
  '',
  '.crmtm-qa-pill {',
  '  display: none; background: var(--crmtm-bg-hover); color: var(--crmtm-text-muted); border-radius: 10px;',
  '  padding: 2px 8px; font-size: 11px; max-width: 120px; overflow: hidden; text-overflow: ellipsis;',
  '  white-space: nowrap;',
  '}',
  '',
  '.crmtm-qa-add {',
  '  flex-shrink: 0; width: auto; padding: 0 10px; font-size: 12px; background: var(--crmtm-accent);',
  '  color: #fff;',
  '}',
  '.crmtm-qa-add:hover { background: var(--crmtm-accent); opacity: 0.9; }',
  '.crmtm-qa-add:disabled { opacity: 0.5; cursor: default; }',
  '',
  '.crmtm-qa-status { font-size: 11px; color: var(--crmtm-success); }',
  '.crmtm-qa-error { font-size: 11px; color: var(--crmtm-danger); }',
].join('\n');
