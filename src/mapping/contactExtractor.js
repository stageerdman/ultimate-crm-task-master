// requires: App.mapping.selectorEngine
'use strict';
App.mapping = App.mapping || {};
// Given a saved mapping record ({ fields: { name, phone, email } }, each a verified-candidate-list from
// App.mapping.selectorEngine), pulls current field values from the live page. Reports which fields
// resolved cleanly, which resolved via a lower-ranked fallback candidate (degraded — a leading indicator
// the site may be mid-redesign), and which failed to resolve at all (broken — caller should trigger the
// re-map prompt for just that field).
App.mapping.contactExtractor = (function () {
  function extract(mappingRecord) {
    var values = {};
    var degraded = [];
    var broken = [];

    ['name', 'phone', 'email'].forEach(function (fieldType) {
      var fieldMapping = mappingRecord.fields[fieldType];
      if (!fieldMapping) return;
      var resolved = App.mapping.selectorEngine.resolveMapping(fieldMapping);
      if (!resolved) {
        broken.push(fieldType);
        return;
      }
      values[fieldType] = resolved.text;
      if (resolved.degraded) degraded.push(fieldType);
    });

    return { values: values, degraded: degraded, broken: broken };
  }

  return { extract: extract };
})();
