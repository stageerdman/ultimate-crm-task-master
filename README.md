# Ultimate CRM Task Master

A personal Tampermonkey userscript that adds one consistent task-management overlay on top of *any* CRM
website. Contacts and tasks are stored in the owner's own Notion database, not in whatever CRM is open —
the script maps each CRM's page once (name/phone/email fields, picked by hand), then recognizes that contact
on every future visit and shows or creates tasks against the Notion record.

Single-user, single build output, no logging or team-distribution machinery.

## Status

First working build — see `updates/` for the active roadmap and status. Start with the most recent folder
there.

## Install

1. `npm run build` (or just open `dist/script.user.js` if it's already built).
2. Open Tampermonkey's dashboard → Create a new script → delete the placeholder content → paste in the
   full contents of `dist/script.user.js` → save.
3. Visit any page and click the small dot that appears in the bottom corner to expand the panel. Click
   the gear icon (Settings tab, inside the full-screen view) and fill in:
   - **Notion API key** — an internal integration token from your Notion workspace's integration
     settings, shared with both the Contacts and Tasks databases.
   - **Contacts database ID** / **Tasks database ID** — the IDs from each database's URL.
   - **Timezone** — an IANA zone name (e.g. `America/New_York`), used for all due-date/time display and
     entry.
   - **Workflow config (JSON)** — optional; defines Stage → step (day/call/total) cadences for the
     type/step pickers. Leave `{"stages": {}}` if you don't use a call-cadence workflow.
4. Click Save. The panel is now live — expand to compact, click a page's contact/phone/email fields when
   prompted to map a new site, and quick-add a task.

## Development

See `CLAUDE.md` for project structure, module conventions, and the build/workflow rules Claude Code follows
in this repo.

```
npm run build   # -> dist/script.user.js, paste into Tampermonkey to test
```

Copy `.env.example` to `.env` and fill in a Notion integration token + database IDs for local dev/test
scripts. The userscript itself is configured separately, through its own Settings panel.
