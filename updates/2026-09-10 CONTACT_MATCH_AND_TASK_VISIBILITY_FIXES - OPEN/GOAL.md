# Goal

Three owner-reported issues fixed in one pass:

1. **Remap from "not found" banner.** When the current page's contact isn't matched in Notion
   (`status: 'no-contact-match'`), the banner only offered "Create". Add a "Remap" button next to it, since
   a wrong/no match is sometimes actually a bad field mapping (grabbed the wrong DOM node), not a genuinely
   new contact.
2. **Existing tasks not showing on a contact's page.** Expanding the widget (dot -> compact bar, or opening
   full-screen) after the initial page load often showed zero tasks even for a contact with existing open
   tasks, until the next 30s poll tick happened to land while it was open.
3. **Smart contact matching should prioritize phone, then email.** `findContact` was building one
   compound-OR query across phone/email/URL and taking `results[0]` — an arbitrary pick when phone and
   email belong to different contacts, not a real priority order.

## Why

Owner hit all three directly while using the script against a live CRM + Notion workspace.
