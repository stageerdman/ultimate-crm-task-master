// requires: App.ui.styles.theme, App.ui.styles.flyout
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Only the free-text row and the scrollable time-suggestion list — the trigger chip, dropdown box,
// positioning, and preset-row look are all shared chrome from src/ui/styles/flyout.js
// (App.ui.styles.flyout), consumed via the crmtm-flyout-* classes in src/ui/timePicker.js's markup.
App.ui.styles.timePicker = [
  '.crmtm-tp-input {',
  '  width: 100%; background: var(--crmtm-bg-hover); border: 1px solid var(--crmtm-border);',
  '  color: var(--crmtm-text); border-radius: var(--crmtm-radius-sm); padding: 5px 6px; font-size: 12px;',
  '  margin-bottom: 6px;',
  '}',
  '.crmtm-tp-input:focus { outline: 2px solid var(--crmtm-accent); }',
  '',
  // 7 rows tall — each slot button is a fixed height (see .crmtm-tp-slot below) so the math is exact,
  // per owner spec ("high enough to show 7 time spots"), scrollable beyond that.
  '.crmtm-tp-suggestions { max-height: 189px; overflow-y: auto; }',
  '.crmtm-tp-suggestions:empty::after {',
  '  content: "No matching times"; display: block; padding: 8px 6px; font-size: 11.5px;',
  '  color: var(--crmtm-text-muted); text-align: center;',
  '}',
  '',
  '.crmtm-tp-slot {',
  '  display: block; width: 100%; height: 27px; background: none; border: none;',
  '  color: var(--crmtm-text); font-size: 12px; text-align: left; padding: 0 8px; cursor: pointer;',
  '  border-radius: var(--crmtm-radius-sm);',
  '}',
  '.crmtm-tp-slot:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-tp-slot.is-selected { background: var(--crmtm-accent-bg); color: var(--crmtm-accent); font-weight: 600; }',
].join('\n');
