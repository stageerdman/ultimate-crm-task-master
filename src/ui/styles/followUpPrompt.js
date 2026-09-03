// requires: App.ui.styles.theme, App.ui.styles.quickAdd
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// The post-completion follow-up popup (src/ui/followUpPrompt.js): a small centered modal, not a
// side panel like src/ui/styles/taskEditPanel.js's overlay, since this is meant to be glanced at and
// dismissed/submitted quickly right after checking a task off. The control row itself reuses
// App.ui.styles.quickAdd's .crmtm-qa-* classes unchanged (owner: "looks like our current compact
// view") — this file only owns the popup's own chrome (overlay, box, heading, contact label).
App.ui.styles.followUpPrompt = [
  '.crmtm-fup-overlay {',
  '  position: fixed; inset: 0; background: rgba(15,15,15,0.35); z-index: 2147483200;',
  '  display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none;',
  '  transition: opacity 0.15s ease;',
  '}',
  '.crmtm-fup-overlay.is-open { opacity: 1; pointer-events: auto; }',
  '',
  '.crmtm-fup-box {',
  '  width: 460px; max-width: 92vw; background: var(--crmtm-bg); color: var(--crmtm-text);',
  '  box-shadow: var(--crmtm-shadow); border-radius: var(--crmtm-radius); padding: 16px;',
  '  display: flex; flex-direction: column; gap: 8px; transform: scale(0.97); transition: transform 0.15s ease;',
  '}',
  '.crmtm-fup-overlay.is-open .crmtm-fup-box { transform: scale(1); }',
  '',
  '.crmtm-fup-heading { font-size: 13px; font-weight: 600; color: var(--crmtm-text); }',
  '.crmtm-fup-contact { font-size: 11px; color: var(--crmtm-text-muted); margin-bottom: 4px; }',
  '',
  // The control row can wrap here (unlike the compact bar's forced one-liner) since the popup box has
  // room to spare and isn't fighting a floating-bar width constraint.
  '.crmtm-fup-box .crmtm-qa-row { flex-wrap: wrap; }',
].join('\n');
