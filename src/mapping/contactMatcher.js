// requires: App.core.notionClient
'use strict';
App.mapping = App.mapping || {};
// Extracted page fields -> Notion contact. Phone/email exact match first, current page URL as a
// secondary/confirmation signal — all three folded into the single compound-or query
// App.core.notionClient.findContact already builds (ROADMAP.md Step 1/2).
App.mapping.contactMatcher = (function () {
  function findMatch(extracted, url) {
    return App.core.notionClient.findContact({
      phone: extracted.phone,
      email: extracted.email,
      url: url,
    }).then(function (results) {
      return results && results.length ? results[0] : null;
    });
  }

  // Creates a new Contact page from extracted fields, filing the current page's URL into "URL Contact"
  // (the primary slot) since a first-ever mapping has no prior opinion on contact-vs-opportunity page
  // type — the owner can fill "URL Opportunity" later from a second mapped page for the same person.
  function createFromExtracted(extracted, url) {
    return App.core.notionClient.createContact({
      name: extracted.name,
      phone: extracted.phone,
      email: extracted.email,
      urlContact: url,
    });
  }

  return {
    findMatch: findMatch,
    createFromExtracted: createFromExtracted,
  };
})();
