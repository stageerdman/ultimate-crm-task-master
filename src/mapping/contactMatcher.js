// requires: App.core.notionClient
'use strict';
App.mapping = App.mapping || {};
// Extracted page fields -> Notion contact. Tried in strict priority order — phone first, then email,
// then the current page URL as a last-resort signal — rather than one compound-or query, since phone and
// email can each independently belong to a different contact and an arbitrary OR-match pick was matching
// the wrong person.
App.mapping.contactMatcher = (function () {
  function firstOrNull(results) {
    return results && results.length ? results[0] : null;
  }

  function findByPhone(phone) {
    if (!phone) return Promise.resolve(null);
    return App.core.notionClient.findContact({ phone: phone }).then(firstOrNull);
  }

  function findByEmail(email) {
    if (!email) return Promise.resolve(null);
    return App.core.notionClient.findContact({ email: email }).then(firstOrNull);
  }

  function findByUrl(url) {
    if (!url) return Promise.resolve(null);
    return App.core.notionClient.findContact({ url: url }).then(firstOrNull);
  }

  function findMatch(extracted, url) {
    return findByPhone(extracted.phone).then(function (contact) {
      if (contact) return contact;
      return findByEmail(extracted.email);
    }).then(function (contact) {
      if (contact) return contact;
      return findByUrl(url);
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
