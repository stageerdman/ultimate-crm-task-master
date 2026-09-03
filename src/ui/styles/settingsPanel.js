// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Phase 9 settings form layout only — inputs/selects/buttons reuse the existing `.crmtm-fs-input`/
// `.crmtm-btn` look from src/ui/styles/fullScreen.js rather than redefining control chrome twice.
App.ui.styles.settingsPanel = [
  '.crmtm-settings { display: flex; flex-direction: column; gap: 12px; max-width: 480px; }',
  '.crmtm-settings-row { display: flex; flex-direction: column; gap: 4px; }',
  '.crmtm-settings-label { font-size: 12px; color: var(--crmtm-text-muted); }',
  '.crmtm-settings-textarea {',
  '  border: 1px solid var(--crmtm-border); border-radius: var(--crmtm-radius-sm); padding: 8px;',
  '  font-size: 12px; font-family: ui-monospace, monospace; color: var(--crmtm-text); background: var(--crmtm-bg);',
  '  min-height: 160px; resize: vertical;',
  '}',
  '.crmtm-settings-user-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }',
  '.crmtm-settings-user-status { font-size: 12px; color: var(--crmtm-text-muted); }',
  '.crmtm-settings-link { width: auto; padding: 0 12px; }',
  '.crmtm-settings-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }',
  '.crmtm-settings-save { width: auto; padding: 0 12px; background: var(--crmtm-accent); color: #fff; }',
  '.crmtm-settings-save:hover { background: var(--crmtm-accent); opacity: 0.9; }',
  '.crmtm-settings-status { color: var(--crmtm-success); font-size: 12px; min-height: 16px; }',
  '.crmtm-settings-error { color: var(--crmtm-danger); font-size: 12px; }',
  '.crmtm-settings-updates { display: flex; flex-direction: column; gap: 6px; }',
  '.crmtm-settings-update-line { font-size: 12px; color: var(--crmtm-text-muted); }',
  '.crmtm-settings-update-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 2px; }',
  '.crmtm-settings-update-btn { width: auto; padding: 0 12px; }',
  '.crmtm-settings-update-btn-available { background: var(--crmtm-accent); color: #fff; }',
  '.crmtm-settings-update-btn-available:hover { background: var(--crmtm-accent); opacity: 0.9; }',
  '.crmtm-settings-update-nosettings {',
  '  width: auto; border: none; background: none; color: var(--crmtm-text-muted); font-size: 12px;',
  '  cursor: pointer; padding: 0;',
  '}',
  '.crmtm-settings-update-nosettings:hover { color: var(--crmtm-text); text-decoration: underline; }',
].join('\n');
