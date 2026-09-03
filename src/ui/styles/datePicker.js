// requires: App.ui.styles.theme, App.ui.styles.flyout
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Only the calendar grid — the trigger chip, dropdown box, positioning, and preset-row look are all
// shared chrome from src/ui/styles/flyout.js (App.ui.styles.flyout), consumed via the crmtm-flyout-*
// classes in src/ui/datePicker.js's markup.
App.ui.styles.datePicker = [
  '.crmtm-dp-calendar { max-height: 210px; overflow-y: auto; }',
  '',
  '.crmtm-dp-month { padding: 2px 2px 8px; }',
  '.crmtm-dp-month-title {',
  '  font-size: 11.5px; font-weight: 600; color: var(--crmtm-text); padding: 4px 2px; text-align: center;',
  '}',
  '.crmtm-dp-weekdays, .crmtm-dp-days { display: grid; grid-template-columns: repeat(7, 1fr); }',
  '.crmtm-dp-weekdays span { font-size: 10px; color: var(--crmtm-text-muted); text-align: center; padding: 2px 0; }',
  '',
  '.crmtm-dp-day {',
  '  aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: none;',
  '  border: none; font-size: 11.5px; color: var(--crmtm-text); border-radius: 50%; cursor: pointer;',
  '}',
  '.crmtm-dp-day:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-dp-day.is-today { color: var(--crmtm-accent); font-weight: 700; }',
  '.crmtm-dp-day.is-selected { background: var(--crmtm-accent); color: #fff; }',
  '.crmtm-dp-day.is-selected.is-today { color: #fff; }',
  '.crmtm-dp-day-blank { cursor: default; pointer-events: none; }',
].join('\n');
