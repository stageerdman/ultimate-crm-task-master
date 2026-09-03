// requires: App.mapping.storage, App.mapping.contactExtractor, App.mapping.contactMatcher
'use strict';
App.mapping = App.mapping || {};
// Single entry point the UI shell calls on page load / task-create attempt to find out "what contact,
// if any, does the current page correspond to." Ties together mapping lookup, extraction, and Notion
// matching into one status the shell can branch on without knowing any of those modules' internals.
App.mapping.pageContext = (function () {
  // Returns a Promise resolving to one of:
  //   { status: 'no-mapping' }                                   — GOAL.md point 4: prompt to map
  //   { status: 'broken', mapping, brokenFields }                 — GOAL.md point 5: prompt to re-map
  //   { status: 'no-contact-match', mapping, extracted }          — extracted fine, no Notion contact yet
  //   { status: 'matched', mapping, extracted, contact, degraded } — ready to show/create tasks against
  function resolve(url) {
    var mapping = App.mapping.storage.findForUrl(url);
    if (!mapping) return Promise.resolve({ status: 'no-mapping' });

    var extraction = App.mapping.contactExtractor.extract(mapping);
    // A broken name field alone still blocks matching (nothing to create a contact with); a broken
    // phone or email is tolerable as long as at least one identifying field resolved, since matching
    // only needs one leaf of the compound-or to hit.
    var hasIdentifyingField = extraction.values.phone || extraction.values.email || extraction.values.name;
    if (!hasIdentifyingField) {
      return Promise.resolve({ status: 'broken', mapping: mapping, brokenFields: extraction.broken });
    }

    return App.mapping.contactMatcher.findMatch(extraction.values, url).then(function (contact) {
      if (!contact) {
        return { status: 'no-contact-match', mapping: mapping, extracted: extraction.values };
      }
      return {
        status: 'matched',
        mapping: mapping,
        extracted: extraction.values,
        contact: contact,
        degraded: extraction.degraded,
      };
    });
  }

  return { resolve: resolve };
})();
