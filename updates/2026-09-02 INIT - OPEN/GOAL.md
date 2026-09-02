# INIT — Goal

Build a personal, universal CRM task manager as a single Tampermonkey userscript, replacing
`GHL-tasks-userscript` (which only worked on GoHighLevel) with a version that works on **any** CRM website
and stores everything in the owner's own Notion database instead of GHL's Task object.

## What it does

1. **Own database, not the CRM's.** All contacts and tasks live in Notion (two databases: Contacts, Tasks),
   never in the CRM being viewed. A Contact record has (at least) Full Name / First / Last, Phone, Email,
   and one or more CRM URLs pointing at that contact's page(s) — the same real person can show up under
   different URLs in different CRMs, or under multiple URLs within the same CRM.
2. **Recognize the page you're on.** When the owner is on a URL that matches a known site mapping, the
   script extracts that page's name/phone/email using the saved mapping, looks up the matching Notion
   contact (by phone/email/URL), and immediately shows that contact's tasks in the floating panel — same UX
   as the GHL version, just contact-matched instead of GHL-contact-ID-matched.
3. **Creating a task attaches to the matched contact.** No separate "which contact" step — if the page is
   recognized, a new task is filed against the contact already matched from the page.
4. **Unmapped site → prompt to map it.** If the current site (by hostname) has no saved mapping and the
   owner tries to create a task, the script asks them to map the page: click the element containing the
   contact's name (first/last or full), phone, and email. Once picked, the mapping is saved for that site and
   used from then on to extract + save new contacts automatically.
5. **Mapping self-heals.** If a site *has* a saved mapping but the picked elements can no longer be found
   (selector broke — CRM changed its markup, or this is a different page layout under the same domain), the
   script re-prompts for a mapping rather than silently failing.
6. **Mapping specificity grows with evidence, not upfront cleverness.** First save is domain-only (e.g.
   `vlado.meta.com`). If the owner later maps a *different* page layout that turns out to live under the same
   domain but a different path shape (e.g. `.../person` vs `.../opportunity`), save that as a second, more
   specific mapping and prefer the most specific match at lookup time. Don't try to be clever about "domain
   depth" ahead of time — just prefer the most specific saved mapping that actually matches, and fall back to
   a broader one if no specific match exists. (Owner's own framing: "we can use it simply by what mapping
   matches, without overthinking.")

## What it explicitly is NOT

- Not multi-user. No user picker, no "assigned to," no per-user notifications.
- Not tied to GHL at all — GHL is just one more CRM this can eventually be mapped against, with no special
  status in the code.
- Not distributed as a loader+payload fetched at runtime. One userscript, rebuilt and reinstalled locally by
  the owner whenever it changes.
- Not logging anything anywhere. No update-checking, no remote version tracking.

## What carries over from `GHL-tasks-userscript`

The **task-management UX** — this is the part the owner explicitly said is exactly right and should be kept:
floating panel shell, quick-add composer, task edit panel, date/time/type/step pickers, Notion-style
editable filter/sort views (tabs), overdue/status color indicators, full-screen timeline. Port and adapt,
don't redesign. See that project's `CLAUDE.md` and `Project Brief.md` for the original design reasoning.

What does NOT carry over: GHL's title-string state-encoding hack (Notion has real structured properties, no
need to encode stage/day/call-number into a title string), PIT/Location auth, the 3-way loader/full/payload
build (this is single-user, no remote distribution needed), contact cache tied to GHL's contact API,
opportunity store, GHL Fast-Nav, Lost-n-Found, multi-user identity/notifications.

## New capability with no predecessor equivalent

The **site-mapping system** (point 4–6 above) is entirely new — the GHL version never needed it because it
only ever ran on one site with one fixed DOM shape it could hardcode against.
