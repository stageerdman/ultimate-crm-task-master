// requires: App.ui.styles.theme
'use strict';
App.ui = App.ui || {};
App.ui.styles = App.ui.styles || {};
// The full-screen panel's own body content (src/ui/fullScreen.js): toolbar/refresh, tab bar, task
// list rows, and the Timeline bar graph + table. Row/tab chrome only — the panel shell itself
// (.crmtm-fullscreen-panel/-header/-body) is owned by src/ui/styles/shell.js.
App.ui.styles.fullScreen = [
  '.crmtm-fs { display: flex; flex-direction: column; gap: 10px; height: 100%; }',
  '',
  '.crmtm-fs-error-banner {',
  '  background: var(--crmtm-danger-bg); color: var(--crmtm-danger); font-size: 12px;',
  '  padding: 6px 10px; border-radius: var(--crmtm-radius-sm); border: 1px solid var(--crmtm-danger);',
  '}',
  '',
  // Manual refresh (owner, 2026-07-21) — a small icon button + a live "updated Xs ago"/error label,
  // so a stuck poll loop or a stale view is visible at a glance instead of silently invisible. Also
  // holds "Performance Mode" (owner, 2026-07-22 rename of "Open in GHL Fast-Nav"; relocated here from
  // its own row under the tab bar so it sits next to the refresh button) — applies to every task in
  // the active view at once (there's no per-task/multi-select UI in this app), hidden entirely unless
  // that view currently has more than one task.
  '.crmtm-fs-toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }',
  '.crmtm-fs-perfmode-btn { width: auto; padding: 0 12px; font-size: 12px; }',
  '.crmtm-fs-perfmode-msg { font-size: 11px; color: var(--crmtm-text-faint); }',
  '.crmtm-fs-refresh-status { font-size: 11px; color: var(--crmtm-text-faint); }',
  '.crmtm-fs-refresh-status.is-error { color: var(--crmtm-danger); }',
  '.crmtm-fs-refresh.is-spinning { animation: crmtm-fs-spin 0.8s linear infinite; }',
  '@keyframes crmtm-fs-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
  '',
  '.crmtm-fs-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }',
  '.crmtm-fs-tab {',
  '  background: none; border: 1px solid transparent; color: var(--crmtm-text-muted); font-size: 12px;',
  '  padding: 5px 10px; border-radius: var(--crmtm-radius-sm); cursor: pointer;',
  '}',
  '.crmtm-fs-tab:hover { background: var(--crmtm-bg-hover); color: var(--crmtm-text); }',
  '.crmtm-fs-tab.is-active { background: var(--crmtm-accent-bg); color: var(--crmtm-accent); font-weight: 600; }',
  '',
  // Notion-style editable view tabs (docs/notion-views-plan.md Phase D) — rename/delete icons stay
  // invisible until hover/focus so the bar reads the same as before at rest.
  '.crmtm-fs-view-tab { display: inline-flex; align-items: center; gap: 4px; }',
  '.crmtm-fs-view-tab-icon { opacity: 0; font-size: 11px; padding: 1px 3px; border-radius: 4px; }',
  '.crmtm-fs-view-tab:hover .crmtm-fs-view-tab-icon, .crmtm-fs-view-tab.is-active .crmtm-fs-view-tab-icon { opacity: 0.65; }',
  '.crmtm-fs-view-tab-icon:hover { opacity: 1 !important; background: var(--crmtm-bg-pressed); }',
  '.crmtm-fs-view-tab-delete:hover { color: var(--crmtm-danger); }',
  '.crmtm-fs-view-tab-rename {',
  '  font: inherit; color: var(--crmtm-text); background: var(--crmtm-bg); border: 1px solid var(--crmtm-accent);',
  '  border-radius: 4px; padding: 1px 4px; width: 110px;',
  '}',
  '.crmtm-fs-tab-new { font-weight: 700; color: var(--crmtm-text-tertiary); padding: 5px 8px; }',
  '.crmtm-fs-tab-new:hover { color: var(--crmtm-text); }',
  '',
  '.crmtm-fs-content { flex: 1; overflow: auto; }',
  '.crmtm-fs-empty { color: var(--crmtm-text-muted); font-size: 13px; text-align: center; padding: 40px 0; }',
  '',
  '.crmtm-fs-list { display: flex; flex-direction: column; }',
  '.crmtm-fs-row {',
  '  display: flex; align-items: flex-start; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--crmtm-border);',
  '}',
  // Clicking anywhere in the row body (not the checkbox, not the contact-name link) opens the
  // Notion-style task-edit panel — the pointer + hover tint is the only affordance for that, since
  // there's no dedicated "edit" button in the row.
  '.crmtm-fs-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; cursor: pointer; border-radius: var(--crmtm-radius-sm); }',
  '.crmtm-fs-row-main:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-fs-row-title { font-size: 13px; color: var(--crmtm-text); word-break: break-word; }',
  '.crmtm-fs-row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; color: var(--crmtm-text-muted); }',
  '.crmtm-fs-pill { background: var(--crmtm-accent-bg); color: var(--crmtm-accent); border-radius: var(--crmtm-radius-sm); padding: 1px 6px; }',
  // Contact-name link: opens the contact page and collapses the widget to its dot form (owner,
  // 2026-07-21) — stopPropagation'd in src/ui/fullScreen.js so clicking it never also opens the
  // row's edit panel.
  '.crmtm-fs-contact { background: none; border: none; color: var(--crmtm-accent); font-size: 11px; cursor: pointer; padding: 0; }',
  '.crmtm-fs-contact:hover { text-decoration: underline; }',
  '',
  // Minimal status styling only — completed dims + strikes through, forgotten (overdue) turns the
  // title text red, matching the one text-color rule Project Brief §7.1 specifies. The full bucket
  // tag-color system belongs to Phase 8, not this file.
  '.crmtm-fs-row.is-completed .crmtm-fs-row-title { color: var(--crmtm-text-muted); text-decoration: line-through; }',
  '.crmtm-fs-row.is-forgotten .crmtm-fs-row-title { color: var(--crmtm-danger); }',
  '',
  '.crmtm-fs-check {',
  '  flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--crmtm-border);',
  '  background: var(--crmtm-bg); color: #fff; font-size: 11px; line-height: 1; cursor: pointer;',
  '  display: flex; align-items: center; justify-content: center; margin-top: 2px;',
  '}',
  '.crmtm-fs-check.is-checked { background: var(--crmtm-success); border-color: var(--crmtm-success); }',
  '.crmtm-fs-check:disabled { opacity: 0.5; cursor: default; }',
  // Owner (2026-07-21): the completed toggle must flip its look immediately, before GHL confirms it —
  // "syncing" gets a lighter/pulsing look so it still reads as distinct from a fully-confirmed state,
  // even though the checkmark/strikethrough already show right away (see rowStatus/toggleCompleted in
  // src/ui/fullScreen.js).
  '.crmtm-fs-check.is-syncing { opacity: 0.65; }',
  '@keyframes crmtm-fs-pulse { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; } }',
  '.crmtm-fs-check.is-checked.is-syncing { animation: crmtm-fs-pulse 1s ease-in-out infinite; }',
  '',
  // Timeline (owner, 2026-07-21 full rebuild — "a real bar graph with two axis... super
  // professional"): a proper stacked-column chart (see src/ui/fullScreen.js's renderTimeline for the
  // geometry) — Y-axis (task count) + X-axis (day, with sticky month/year headers), gridlines, a
  // legend (status color is never the only way to tell Completed/Open/Expired apart), and a task table
  // for whichever day is selected underneath. Mark specs follow the project's dataviz guidance: bars
  // capped at 22px, 4px rounded cap only on the topmost stacked segment, square everywhere else
  // including the baseline, a 2px surface gap between stacked segments, hairline solid (never dashed)
  // gridlines one step off the surface.
  '.crmtm-tl { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; }',
  '',
  '.crmtm-tl-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0; }',
  '.crmtm-tl-legend { display: flex; align-items: center; gap: 14px; }',
  '.crmtm-tl-legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--crmtm-text); }',
  '.crmtm-tl-legend-dot { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }',
  '.crmtm-tl-legend-dot-completed { background: var(--crmtm-success); }',
  '.crmtm-tl-legend-dot-open { background: var(--crmtm-neutral); }',
  '.crmtm-tl-legend-dot-expired { background: var(--crmtm-danger); }',
  '.crmtm-tl-today-btn { width: auto; padding: 0 12px; font-size: 12px; }',
  '',
  // flex: 0 0 auto (not flex: 1) — the chart sizes to its own content; the table below it, not this,
  // is what should grow to fill the remaining vertical space (see .crmtm-tl-table below). Was
  // previously flex: 1, which stretched this empty-ish wrapper to fill the whole panel height and left
  // the table stranded far below the actual (much shorter) chart content — a real layout bug, not
  // intentional spacing.
  '.crmtm-tl-scroll { flex: 0 0 auto; overflow-x: auto; overflow-y: hidden; border-bottom: 1px solid var(--crmtm-border); }',
  '.crmtm-tl-grid { display: grid; position: relative; column-gap: 0; row-gap: 2px; padding-bottom: 4px; width: max-content; }',
  '',
  // Gridlines: hairline, solid, one shade off the surface — never dashed (reads as a threshold/
  // projection line instead of a plain grid), never loud. `pointer-events: none` is load-bearing, not
  // decorative: this element is `position: relative` (needed so its own absolutely-positioned line
  // children anchor to it), and CSS stacks ANY positioned element above static ones regardless of DOM
  // order — since the day/gap bar buttons are plain static elements, this overlay (which spans the
  // exact same grid cells as every bar) was silently swallowing every click meant for a bar underneath
  // it. Without this, the chart looks interactive but nothing is clickable.
  '.crmtm-tl-gridlines { position: relative; pointer-events: none; }',
  '.crmtm-tl-gridline { position: absolute; left: 0; right: 0; height: 1px; background: var(--crmtm-border); }',
  '',
  // Y-axis: sticky left rail so it stays put while the day columns scroll underneath it.
  '.crmtm-tl-yaxis {',
  '  grid-column: 1; grid-row: 1; position: sticky; left: 0; z-index: 5; background: var(--crmtm-bg);',
  '}',
  '.crmtm-tl-ytick { position: absolute; left: 0; right: 6px; text-align: right; font-size: 10px; color: var(--crmtm-text-faint); transform: translateY(50%); }',
  '',
  // Month/year divider lines — distinguished by weight, not just color, so they read at a glance even
  // without color vision: a hairline per month boundary, a heavier line per year boundary.
  '.crmtm-tl-divider { position: absolute; top: 0; bottom: 0; pointer-events: none; }',
  '.crmtm-tl-divider-month { width: 1px; background: var(--crmtm-border); }',
  '.crmtm-tl-divider-year { width: 2px; background: var(--crmtm-text-faint); }',
  '',
  // A run of taskless days collapses into one compact marker (owner: "collapse the days without tasks
  // into a smaller space like 3 dots or a line") rather than an empty bar per day.
  '.crmtm-tl-gap {',
  '  display: flex; align-items: center; justify-content: center; color: var(--crmtm-text-faint);',
  '  font-size: 11px; letter-spacing: 1px;',
  '}',
  '',
  '.crmtm-tl-bar {',
  '  display: flex; align-items: flex-end; justify-content: center; background: none; border: none;',
  '  cursor: pointer; border-radius: var(--crmtm-radius-sm); padding: 0;',
  '}',
  '.crmtm-tl-bar:hover { background: var(--crmtm-bg-hover); }',
  '.crmtm-tl-bar.is-selected { background: var(--crmtm-accent-bg); }',
  '.crmtm-tl-bar.is-today { box-shadow: inset 0 0 0 1px var(--crmtm-accent); }',
  // 22px cap matches TL_BAR_MAX_WIDTH in src/ui/fullScreen.js — bars are capped, never fill their
  // 34px-wide day column (dataviz mark spec: "let the band's leftover be air").
  '.crmtm-tl-bar-inner {',
  '  width: 22px; max-width: 100%; display: flex; flex-direction: column-reverse; gap: 2px;',
  '}',
  '.crmtm-tl-seg { width: 100%; }',
  '.crmtm-tl-seg-completed { background: var(--crmtm-success); }',
  '.crmtm-tl-seg-open { background: var(--crmtm-neutral); }',
  '.crmtm-tl-seg-expired { background: var(--crmtm-danger); }',
  '.crmtm-tl-seg-cap { border-radius: 4px 4px 0 0; }',
  '',
  '.crmtm-tl-daynum { display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--crmtm-text-muted); padding-top: 4px; }',
  '.crmtm-tl-daynum.is-today { color: var(--crmtm-accent); font-weight: 700; }',
  '',
  '.crmtm-tl-month-label, .crmtm-tl-year-label {',
  '  position: sticky; z-index: 3; background: var(--crmtm-bg); font-size: 11px; padding: 3px 6px 3px 0;',
  '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
  '}',
  '.crmtm-tl-month-label { color: var(--crmtm-text-muted); font-weight: 600; }',
  '.crmtm-tl-year-label { color: var(--crmtm-text-faint); }',
  '',
  // flex: 1 (not a % max-height cap) — this is the element that should grow to fill whatever vertical
  // space the (now content-sized) chart above it doesn't use, immediately below the chart with no gap.
  '.crmtm-tl-table { flex: 1; min-height: 0; overflow: auto; }',
  '.crmtm-tl-table-header { font-size: 12px; font-weight: 600; color: var(--crmtm-text); padding: 4px 0 8px; }',
  '',
  // Still used by src/ui/settingsPanel.js's form fields (the custom-view builder that used to be this
  // file's other consumer of .crmtm-fs-input, and the only consumer of .crmtm-fs-select, was removed
  // above per the 2026-07-21 "cancel custom views for now" note).
  '.crmtm-fs-input {',
  '  border: 1px solid var(--crmtm-border); border-radius: var(--crmtm-radius-sm); padding: 4px 6px;',
  '  font-size: 12px; color: var(--crmtm-text); background: var(--crmtm-bg);',
  '}',
].join('\n');
