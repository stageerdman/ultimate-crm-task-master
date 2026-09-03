// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// The compact bar's per-contact task list (src/ui/compactContactTasks.js) — deliberately minimal
// (complete button, title, due date only), a hairline-separated column that sits below the compact
// bar's own header/quick-add rows, inside the same `.crmtm-compact-bar` element so it scrolls/drags
// with the bar as one unit (see src/ui/styles/shell.js's `.crmtm-compact-bar`).
App.ui.styles.compactContactTasks = [
  '.crmtm-cct { display: flex; flex-direction: column; gap: 2px; border-top: 1px solid var(--crmtm-border); padding-top: 6px; max-height: 160px; overflow-y: auto; }',
  '',
  '.crmtm-cct-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }',
  '',
  '.crmtm-cct-complete {',
  '  background: none; border: 1px solid var(--crmtm-border); color: var(--crmtm-success);',
  '  border-radius: 50%; width: 18px; height: 18px; min-width: 18px; font-size: 11px; cursor: pointer;',
  '  display: flex; align-items: center; justify-content: center; flex-shrink: 0;',
  '}',
  '.crmtm-cct-complete:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-cct-complete:disabled { opacity: 0.5; cursor: default; }',
  '',
  '.crmtm-cct-title {',
  '  flex: 1; min-width: 0; font-size: 12px; color: var(--crmtm-text); white-space: nowrap;',
  '  overflow: hidden; text-overflow: ellipsis;',
  '}',
  '',
  '.crmtm-cct-due { font-size: 11px; color: var(--crmtm-text-muted); flex-shrink: 0; white-space: nowrap; }',
  '',
  '.crmtm-cct-error { font-size: 11px; color: var(--crmtm-danger); padding: 2px 0; }',
  '',
  '.crmtm-cct-banner {',
  '  display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--crmtm-text-muted);',
  '  padding: 2px 0; flex-wrap: wrap;',
  '}',
  '.crmtm-cct-map-btn { font-size: 11px; padding: 2px 8px; }',
].join('\n');
