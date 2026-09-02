# Ultimate CRM Task Master

A personal Tampermonkey userscript that adds one consistent task-management overlay on top of *any* CRM
website. Contacts and tasks are stored in the owner's own Notion database, not in whatever CRM is open —
the script maps each CRM's page once (name/phone/email fields, picked by hand), then recognizes that contact
on every future visit and shows or creates tasks against the Notion record.

Single-user, single build output, no logging or team-distribution machinery.

## Status

Early bootstrap — see `updates/` for the active roadmap and status. Start with the most recent folder there.

## Development

See `CLAUDE.md` for project structure, module conventions, and the build/workflow rules Claude Code follows
in this repo.

```
npm run build   # -> dist/script.user.js, paste into Tampermonkey to test
```

Copy `.env.example` to `.env` and fill in a Notion integration token + database IDs for local dev/test
scripts. The userscript itself is configured separately, through its own Settings panel.
