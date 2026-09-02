# CLAUDE.md — Universal CRM Task Master

This file is the standing instruction set for Claude Code when working in this repository. The product is a
**single Tampermonkey userscript**, built from a modularized `/src` tree, that gives its owner one consistent
task-management UI on top of *any* CRM website. Contacts and tasks live in the owner's own **Notion**
database, not in whatever CRM happens to be open — the userscript maps each CRM's DOM once, then recognizes
that contact on every future visit (any CRM, not just one) and shows/creates tasks against the Notion record.
This is a **personal, single-user tool** — no team distribution, no multi-user identity, no logging pipeline.

The predecessor project (`/Users/stage/dev/GHL-tasks-userscript`) has the exact task-management UX this
project should keep — floating panel, quick-add, Notion-style filterable/sortable views, date/time pickers,
overdue indicators, full-screen timeline. Read `Project Brief.md` and `CLAUDE.md` there for the original
design if a UI question comes up mid-task; **don't re-derive that UX from scratch**, port and adapt it. What
does **not** carry over: anything GHL-specific (title-string state encoding, the Task-object-only
workaround, PIT/Location auth, the loader/full/payload 3-way build for team distribution, contact cache tied
to GHL's contact API, opportunity store, GHL Fast-Nav, Lost-n-Found, multi-user identity/notifications). This
project can use real structured fields in Notion instead of GHL's title-encoding hack — don't reflexively
port that trick; it existed only because GHL gave no better option.

---

## 0. Session bootstrap protocol (read this first, every session)

Work is tracked in **`updates/`**, not a single top-level STATUS.md (see §6). At the start of any session:

1. Find the currently **OPEN** folder under `updates/` (folder name ends in `- OPEN`; there should be at
   most one at a time). Read that folder's `STATUS.md` first — it names what's done, what's in progress, and
   open questions. Then read its `ROADMAP.md` for the full step list and `GOAL.md` if you need the "why."
2. If no folder is OPEN, ask the user which update to start, or whether to open a new one — don't guess.
3. Work only within the current update's scope unless the user explicitly asks to jump ahead or fix
   something unrelated.
4. **Update the update's `STATUS.md` before ending the session or handing off**: tick off roadmap items,
   note anything newly learned (especially answers to open questions), and update "Last updated." This is
   what makes the next session cheap — don't skip it.
5. When an update's goal is fully met and the owner confirms it live, rename its folder from `- OPEN` to
   `- CLOSED` as part of that final commit.

---

## 1. Project shape

One build output, one manifest, no loader/payload split — this script is installed once by its one user and
re-pasted into Tampermonkey on every change (no remote distribution mechanism needed).

```
/src
  meta.js            # ==UserScript== metadata block (name, match all-urls, grants)
  manifest.json      # module load order + bootstrapCall + assumeDefined
  /core              # namespace, log, storage (GM_* wrappers), httpClient (GM_xmlhttpRequest — Notion's
                      #   API has no CORS for arbitrary origins, same constraint the GHL project had),
                      #   notionClient (auth + generic request(), contacts/tasks CRUD + query)
  /mapping           # per-site DOM mapping: element picker (click-to-select name/phone/email fields),
                      #   mapping storage (keyed by hostname, refined by path when one domain hosts
                      #   distinct page types — see GOAL.md), contact extractor + Notion matcher, the
                      #   "ask to map" / "mapping broke, re-map" prompt flow
  /tasks             # Notion-backed task store, filter/sort views engine, overdue/indicator logic
  /ui                # DOM/UI: shell (floating panel), quickAdd, taskComposer, taskEditPanel, date/time/
                      #   type/step pickers, filterSortBar + editable views, indicators, fullScreen
                      #   timeline, followUpPrompt, settingsPanel, mapping-picker overlay
/build
  lib.js             # shared concat/validate core
  build.js            # -> dist/script.user.js (`node build/build.js`, `npm run build`)
/dist                # GENERATED, gitignored. Never hand-edit; must always be regenerable from /src.
/updates             # see §6
Project Brief.md      # NOT part of this repo — refer to the predecessor project's copy when needed (see
                      #   header above); don't duplicate it here.
.env                  # gitignored: NOTION_API_KEY, NOTION_CONTACTS_DB_ID, NOTION_TASKS_DB_ID, etc. — for
                      #   Claude's own dev/test scripts only (see §4). The live userscript gets its own
                      #   copy of these through the in-app Settings panel (GM storage), not this file.
.env.example          # committed template, no real values
```

Rules (same reasoning as the predecessor project, still applies with one build instead of three):
- Never write feature logic directly into `/dist`. It's a build artifact, always regenerable from `/src`.
- One responsibility per file in `/mapping`, `/tasks`, `/ui`. If a file starts doing two unrelated things,
  split it.
- Shared helpers go in `/core`, never duplicated across modules.
- Notion has real structured properties (select/date/relation/etc.) — model Contacts and Tasks as proper
  Notion database properties, not a single encoded string field. Only fall back to an encoded field if a
  genuine Notion API limitation forces it, and note why in the relevant update's STATUS.md if so.

---

## 2. Module authoring rules (so concatenation can't break)

The build concatenates files into one non-module script — Tampermonkey runs it as a single `<script>`, so
none of this can use ES modules or CommonJS.

1. **No `import`/`export`/`require`/`module.exports` in bundled `/src` files.** Each module attaches to one
   shared namespace object instead:
   ```js
   // mapping/domainMatcher.js
   window.App = window.App || {};
   App.mapping = App.mapping || {};
   App.mapping.domainMatcher = (function () {
     function findMapping(url) { /* ... */ }
     return { findMapping };
   })();
   ```
2. **Every module wrapped in its own IIFE** so module-local names never collide across files.
3. **No global `var`/`let`/`const` at file top-level.** Anything shared goes through `App.*`.
4. **No duplicate keys on the shared namespace.** Grep `/src` for the identifier before adding `App.foo = ...`.
5. **Declare dependencies in a header comment**: `// requires: App.core.notionClient, App.core.log`. The
   build uses this to fail fast if something is referenced before it's defined.
6. **No top-level side effects that assume another module already ran.** Side effects (listeners,
   `MutationObserver`s, the element-picker's hover-highlight overlay, etc.) belong inside an explicit
   `App.<module>.init()` called from one obvious bootstrap step.
7. **Strict mode consistency** — either every file opts in or none do.
8. **End every file's last statement with an explicit semicolon** — don't rely on ASI across concatenation
   boundaries.
9. **The `==UserScript==` metadata block lives only in `src/meta.js`.**

---

## 3. The build system (`/build`)

| Command | Reads | Writes |
|---|---|---|
| `node build/build.js` (`npm run build`) | `src/manifest.json` | `dist/script.user.js` |

Requirements (enforced in `lib.js`):
- **Deterministic order** from `manifest.json`'s `moduleOrder` — never directory-read order.
- **Dependency check before concatenation**: parse each file's `// requires:` header and verify every
  referenced `App.x.y` is defined earlier in `moduleOrder` or listed in `assumeDefined`. Fail loudly with the
  offending file and missing dependency.
- **Duplicate export detection**: fail the build if the same `App.<path> =` is assigned twice.
- **Single bootstrap call**, appended once after the concatenated modules.
- **Syntax validation of the output** (parse with Node's `vm` module) before writing — never emit a broken
  file.
- **Idempotent & side-effect free**: only reads `/src`, only writes `/dist`.
- **No bundler magic** — no Webpack/Rollup/esbuild unless explicitly asked. Zero `npm install` required to
  run the build directly with `node`.
- **Clear CLI output**: output path + byte size on success; failing file/module + non-zero exit on failure.

---

## 4. Secrets

- `.env` (gitignored) holds Notion credentials for **Claude's own dev/test scripts** (e.g. a scratch script
  that hits the Notion API directly to verify a schema idea) — never read into the built userscript at build
  time.
- The **live userscript** gets its Notion API key + database IDs from its own Settings panel at runtime,
  stored via `GM_setValue`/`GM_getValue` (`App.core.storage`) — the owner pastes them in once, like the
  predecessor project's PIT/Location fields but simpler (no multi-user).
- `.env.example` is committed with placeholder keys and no real values.
- Never commit `.env`, real API keys, or Notion database/page IDs that would leak private data structure
  unnecessarily (IDs alone are low-risk, but keep them in `.env`/Settings, not hardcoded in `/src`).

---

## 5. Workflow Claude Code should follow

1. Edit files under `/src` only.
2. Update `// requires:` header comments if dependencies changed.
3. **Run `node build/build.js` after every change** and fix anything it flags before considering the task
   done. If a build fails, fix the root cause in `/src` — never patch `/dist` directly.
4. Test using the Chrome Tampermonkey extension (paste `dist/script.user.js` in) and/or Claude's own
   `claude-in-chrome` browser automation tools where a flow can be scripted (mapping a test page, quick-add,
   filter/sort views). For anything requiring the owner's real Notion account or real CRM logins, ask the
   owner to test and report back rather than guessing it works.
5. **After a clean build: commit, then push.** Stage the changed `/src` files, `manifest.json` if changed,
   the current update's `STATUS.md`/`ROADMAP.md`, and any other touched docs (never `/dist` or `.env` — both
   gitignored/generated). Commit with a message describing the change in source terms, then `git push`. Do
   this as a standard part of finishing any task — don't wait to be asked each time. Skip only if the user
   says mid-task they want to review before anything is committed, or the build didn't come out clean.
6. Summarize what changed in source terms ("added `App.mapping.elementPicker`"), not in terms of the
   generated bundle.

---

## 6. `updates/` folder convention

Each folder: `updates/YYYY-MM-DD UPDATE_NAME - STATUS/` where `STATUS` is `OPEN` (in progress) or `CLOSED`
(done, owner-confirmed). Only one folder should be OPEN at a time under normal operation. Each folder
contains:
- `GOAL.md` — what this update is trying to achieve and why, written once at the start.
- `ROADMAP.md` — the step list to get there. Free-form is fine; check off items as they're done. If a step
  turns out wrong once research/testing reveals new facts, edit the roadmap rather than silently deviating.
- `STATUS.md` — living tracker: current state, what's done, what's open, questions for the owner. Read this
  first every session (§0).

Starting a new piece of work = open a new dated folder with these three files. Don't let ad-hoc work happen
outside an update folder except trivial one-line fixes — even those should get a line in the current OPEN
update's STATUS.md so nothing done goes unrecorded.

---

## 7. General code style

- Prefer small, named, pure functions inside each module's IIFE over long inline callbacks.
- Comment *why*, not *what* — timing hacks, site-specific DOM quirks, workarounds for a real CRM's markup.
- No `console.log` left in shipped code paths — use a single `App.core.log()` wrapper gated by a debug flag.
- Defensive DOM access: guard every `querySelector` result before use. This script runs against arbitrary,
  uncontrolled third-party CRM markup that can change or load asynchronously at any time — treat every site
  as hostile to assumptions, more so than the predecessor project's single-CRM case.
