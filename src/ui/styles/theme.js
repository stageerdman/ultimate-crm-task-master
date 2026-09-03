// requires: (none)
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// Shared color/spacing tokens as CSS custom properties on :host (the shadow root's host element),
// so every other style file in src/ui/styles/*.js can reference var(--crmtm-*) without importing
// anything — a light, Todoist-like palette (owner feedback: "make it white instead of black").
// Swapping the whole UI's theme means editing only this file.
App.ui.styles.theme = [
  ':host {',
  '  --crmtm-bg: #ffffff;',
  '  --crmtm-bg-raised: #ffffff;',
  '  --crmtm-bg-hover: #f4f5f7;',
  '  --crmtm-bg-pressed: #ececec;',
  '  --crmtm-border: #e3e4e8;',
  '  --crmtm-border-hover: #c9cbd1;',
  '  --crmtm-text: #1f2430;',
  '  --crmtm-text-muted: #6b7280;',
  '  --crmtm-text-faint: #c2c2c2;',
  '  --crmtm-text-tertiary: #9ca3af;',
  '  --crmtm-accent: #2f6fed;',
  '  --crmtm-accent-bg: #eaf1fe;',
  '  --crmtm-accent-border: #bbd3fb;',
  '  --crmtm-success: #058527;',
  '  --crmtm-danger: #e5484d;',
  '  --crmtm-danger-bg: #fdecea;',
  '  --crmtm-neutral: #9a9a9a;',
  '  --crmtm-tag-red: #e44332;',
  '  --crmtm-tag-orange: #eb8909;',
  '  --crmtm-tag-purple: #8b5cf6;',
  '  --crmtm-tag-gray: #9a9a9a;',
  '  --crmtm-shadow: 0 2px 10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);',
  '  --crmtm-radius: 10px;',
  '  --crmtm-radius-sm: 6px;',
  '  color-scheme: light;',
  '}',
].join('\n');
