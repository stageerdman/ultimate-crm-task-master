// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Phase 8 (Project Brief §7.1/§7.2): the glow badge, the bucket tag-color dot, and the all-completed
// celebration message. Row overdue text color reuses the existing --crmtm-danger token/`.is-forgotten`
// rule already defined in src/ui/styles/fullScreen.js — not duplicated here.
App.ui.styles.indicators = [
  '.crmtm-indicator-badge {',
  '  align-self: flex-start; display: flex; align-items: center; padding: 6px 12px;',
  '  border-radius: var(--crmtm-radius-sm); background: var(--crmtm-accent-bg); color: var(--crmtm-accent);',
  '  font-size: 12px; font-weight: 600; animation: crmtm-indicator-glow 2.2s ease-in-out infinite;',
  '}',
  '@keyframes crmtm-indicator-glow {',
  '  0%, 100% { box-shadow: 0 0 6px rgba(36, 111, 224, 0.25); }',
  '  50% { box-shadow: 0 0 14px rgba(36, 111, 224, 0.55); }',
  '}',
  '',
  '.crmtm-fs-tag {',
  '  display: inline-block; width: 8px; height: 8px; border-radius: 50%; align-self: center;',
  '}',
  '.crmtm-fs-tag-red { background: var(--crmtm-tag-red); }',
  '.crmtm-fs-tag-orange { background: var(--crmtm-tag-orange); }',
  '.crmtm-fs-tag-purple { background: var(--crmtm-tag-purple); }',
  '.crmtm-fs-tag-gray { background: var(--crmtm-tag-gray); }',
  '',
  '.crmtm-fs-celebrate {',
  '  color: var(--crmtm-accent); font-size: 13px; font-weight: 600; text-align: center; padding: 40px 0;',
  '}',
].join('\n');
