// requires: App.core.notionClient
'use strict';
App.tasks = App.tasks || {};
// Tiny in-memory contact-name cache so task-edit/follow-up popups showing "which contact is this task
// for" don't refetch the same contact page repeatedly. Session-lived only (module-level, no storage) —
// mirrors the predecessor's contactCache in spirit, but backed by App.core.notionClient.getContact
// instead of a GHL contact-API call.
App.tasks.contactNameCache = (function () {
  var cache = {};

  function get(contactId) {
    return cache[contactId] || null;
  }

  function fetch(contactId, callback) {
    if (cache[contactId]) {
      callback(cache[contactId]);
      return;
    }
    App.core.notionClient.getContact(contactId).then(
      function (page) {
        var contact = App.core.notionClient.decorateContact(page);
        cache[contactId] = contact.name;
        callback(contact.name);
      },
      function () {
        callback(null);
      }
    );
  }

  return { get: get, fetch: fetch };
})();
