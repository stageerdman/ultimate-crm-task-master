// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Dot / compact bar / full-screen panel chrome — everything owned by src/ui/shell.js. Colors come
// from var(--crmtm-*) tokens (src/ui/styles/theme.js) so this file never hardcodes a palette.
App.ui.styles.shell = [
  '* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont,',
  '  "Segoe UI", Roboto, sans-serif; }',
  '',
  '.crmtm-dot {',
  '  position: fixed; bottom: 20px; right: 20px; width: 44px; height: 44px; border-radius: 50%;',
  '  background: var(--crmtm-accent); color: #fff; display: flex; align-items: center; justify-content: center;',
  '  font-size: 18px; cursor: grab; box-shadow: var(--crmtm-shadow); z-index: 2147483647;',
  '  user-select: none;',
  '}',
  '.crmtm-dot:active { cursor: grabbing; }',
  '',
  // Column layout: a slim header row (drag handle, task name, expand/collapse) on top, the full
  // quick-add control row below it — kept as two separate rows (rather than one row with the title
  // stacked inside the quick-add mount) specifically so the expand/collapse buttons always share the
  // header's height with the task name and never sit beside/overlap the taller input row underneath,
  // regardless of how wide that row grows (owner: "the expand buttons and name should move up and be
  // in the same height").
  '.crmtm-compact-bar {',
  '  position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 4px;',
  '  background: var(--crmtm-bg); color: var(--crmtm-text); padding: 8px 10px; border-radius: var(--crmtm-radius);',
  '  box-shadow: var(--crmtm-shadow); border: 1px solid var(--crmtm-border); z-index: 2147483647;',
  '  max-width: 560px;',
  '}',
  '',
  '.crmtm-bar-header { display: flex; align-items: center; gap: 6px; }',
  '.crmtm-bar-title-mount { flex: 1; min-width: 0; }',
  '',
  '.crmtm-drag-handle {',
  '  cursor: grab; padding: 0 2px; color: var(--crmtm-text-faint); user-select: none; font-size: 14px;',
  '  flex-shrink: 0;',
  '}',
  '.crmtm-drag-handle:active { cursor: grabbing; }',
  '',
  '.crmtm-quick-add-mount { min-width: 0; }',
  '',
  '.crmtm-btn {',
  '  background: var(--crmtm-bg-hover); color: var(--crmtm-text-muted); border: none;',
  '  border-radius: var(--crmtm-radius-sm); width: 26px; height: 26px; cursor: pointer; font-size: 13px;',
  '  display: flex; align-items: center; justify-content: center; flex-shrink: 0;',
  '}',
  '.crmtm-btn:hover { background: var(--crmtm-bg-pressed); color: var(--crmtm-text); }',
  '',
  '.crmtm-fullscreen-panel {',
  '  position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh;',
  '  background: var(--crmtm-bg); color: var(--crmtm-text); z-index: 2147483647; display: flex;',
  '  flex-direction: column; overflow: hidden;',
  '}',
  '',
  '.crmtm-fullscreen-header {',
  '  display: flex; align-items: center; gap: 6px; background: var(--crmtm-bg-raised); padding: 10px 14px;',
  '  border-bottom: 1px solid var(--crmtm-border); user-select: none;',
  '}',
  '',
  '.crmtm-fullscreen-title { flex: 1; font-weight: 600; font-size: 14px; }',
  '',
  '.crmtm-fullscreen-body { flex: 1; padding: 16px; overflow: auto; font-size: 13px; color: var(--crmtm-text-muted); }',
].join('\n');
