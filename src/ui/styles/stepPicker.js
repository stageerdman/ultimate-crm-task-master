// requires: App.ui.styles.theme, App.ui.styles.flyout
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Only the always-visible text input and its filtered suggestion list — same split as
// src/ui/styles/typePicker.js, reusing the shared App.ui.styles.flyout dropdown box/flip positioning.
// Sized to fit the existing step-chip convention ("D  C/T", e.g. "5  1/1") — owner: "number picker
// size is good," i.e. keep it about as narrow as the old chip, no need to grow or shrink it further.
App.ui.styles.stepPicker = [
  '.crmtm-step-wrap { width: 48px; }',
  '',
  '.crmtm-step-input {',
  '  width: 100%; background: var(--crmtm-bg-hover); border: 1px solid var(--crmtm-border);',
  '  color: var(--crmtm-text); border-radius: var(--crmtm-radius-sm); padding: 5px 6px; font-size: 12px;',
  '  text-align: center;',
  '}',
  '.crmtm-step-input:focus { outline: 2px solid var(--crmtm-accent); }',
  '',
  '.crmtm-step-suggestions { max-height: 189px; overflow-y: auto; }',
  '.crmtm-step-suggestions:empty::after {',
  '  content: "No matching steps"; display: block; padding: 8px 6px; font-size: 11.5px;',
  '  color: var(--crmtm-text-muted); text-align: center;',
  '}',
  '',
  '.crmtm-step-option {',
  '  display: block; width: 100%; background: none; border: none;',
  '  color: var(--crmtm-text); font-size: 12px; text-align: left; padding: 6px 8px; cursor: pointer;',
  '  border-radius: var(--crmtm-radius-sm);',
  '}',
  '.crmtm-step-option:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-step-option.is-selected { background: var(--crmtm-accent-bg); color: var(--crmtm-accent); font-weight: 600; }',
].join('\n');
