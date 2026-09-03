// requires: App.ui.styles.theme, App.ui.styles.flyout
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Only the always-visible text input and its filtered suggestion list — the dropdown box and its
// flip-above/below positioning are shared chrome from src/ui/styles/flyout.js (App.ui.styles.flyout),
// consumed via the crmtm-flyout-* classes in src/ui/typePicker.js's markup. Unlike the date/time
// pickers, there's no separate trigger-button look here since the input itself is always the visible,
// directly-typable field (owner: "user starts typing").
// Width fits the longest configured stage code ("OPP") rather than an arbitrary chip size — owner:
// "the longest word in the type selector will be OPP," so the field should be no wider than that.
App.ui.styles.typePicker = [
  '.crmtm-typ-wrap { width: 36px; }',
  '',
  '.crmtm-typ-input {',
  '  width: 100%; background: var(--crmtm-bg-hover); border: 1px solid var(--crmtm-border);',
  '  color: var(--crmtm-text); border-radius: var(--crmtm-radius-sm); padding: 5px 3px; font-size: 12px;',
  '  text-align: center;',
  '}',
  '.crmtm-typ-input:focus { outline: 2px solid var(--crmtm-accent); }',
  '',
  '.crmtm-typ-suggestions { max-height: 189px; overflow-y: auto; }',
  '.crmtm-typ-suggestions:empty::after {',
  '  content: "No matching types"; display: block; padding: 8px 6px; font-size: 11.5px;',
  '  color: var(--crmtm-text-muted); text-align: center;',
  '}',
  '',
  '.crmtm-typ-option {',
  '  display: block; width: 100%; background: none; border: none;',
  '  color: var(--crmtm-text); font-size: 12px; text-align: left; padding: 6px 8px; cursor: pointer;',
  '  border-radius: var(--crmtm-radius-sm);',
  '}',
  '.crmtm-typ-option:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-typ-option.is-selected { background: var(--crmtm-accent-bg); color: var(--crmtm-accent); font-weight: 600; }',
].join('\n');
