// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Settings form layout only — inputs/buttons reuse the existing `.crmtm-fs-input`/`.crmtm-btn` look from
// src/ui/styles/fullScreen.js and src/ui/styles/shell.js rather than redefining control chrome twice.
App.ui.styles.settingsPanel = [
  '.crmtm-settings { display: flex; flex-direction: column; gap: 12px; max-width: 480px; }',
  '.crmtm-settings-row { display: flex; flex-direction: column; gap: 4px; }',
  '.crmtm-settings-label { font-size: 11px; color: var(--crmtm-text-muted); }',
  '.crmtm-settings-textarea {',
  '  border: 1px solid var(--crmtm-border); border-radius: var(--crmtm-radius-sm); padding: 8px;',
  '  font-size: 12px; font-family: ui-monospace, monospace; color: var(--crmtm-text); background: var(--crmtm-bg);',
  '  min-height: 160px; resize: vertical;',
  '}',
  '.crmtm-settings-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }',
  '.crmtm-settings-save { width: auto; padding: 0 12px; background: var(--crmtm-accent); color: #fff; }',
  '.crmtm-settings-save:hover { background: var(--crmtm-accent); opacity: 0.9; }',
  '.crmtm-settings-reset { width: auto; padding: 0 12px; font-size: 11px; }',
  '.crmtm-settings-status { color: var(--crmtm-success); font-size: 11px; min-height: 14px; }',
  '.crmtm-settings-error { color: var(--crmtm-danger); font-size: 11px; }',
].join('\n');
