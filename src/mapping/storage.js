// requires: App.core.storage
'use strict';
App.mapping = App.mapping || {};
// Mapping storage keyed by hostname, with room for a more specific path-scoped mapping to coexist and
// take priority when it matches (GOAL.md point 6 — grow specificity from evidence, not upfront
// cleverness: first save is domain-only, a second page layout under the same domain gets its own
// path-scoped record, and lookup always prefers the most specific match that actually matches).
App.mapping.storage = (function () {
  var STORAGE_KEY = 'crmTaskMaster.mappings';

  function loadAll() {
    return App.core.storage.get(STORAGE_KEY, []);
  }

  function saveAll(records) {
    App.core.storage.set(STORAGE_KEY, records);
  }

  function makeId(hostname, pathPattern) {
    return hostname + '|' + (pathPattern || '');
  }

  // fields: { name: {candidates,...}, phone: {...}, email: {...} } — each value the shape produced by
  // App.mapping.selectorEngine.buildVerifiedMapping.
  function save(hostname, pathPattern, fields) {
    var records = loadAll();
    var id = makeId(hostname, pathPattern);
    var existingIndex = -1;
    for (var i = 0; i < records.length; i++) {
      if (records[i].id === id) {
        existingIndex = i;
        break;
      }
    }
    var record = {
      id: id,
      hostname: hostname,
      pathPattern: pathPattern || null,
      fields: fields,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex === -1) {
      records.push(record);
    } else {
      records[existingIndex] = record;
    }
    saveAll(records);
    return record;
  }

  function remove(hostname, pathPattern) {
    var id = makeId(hostname, pathPattern);
    saveAll(loadAll().filter(function (r) {
      return r.id !== id;
    }));
  }

  // Returns the most specific record matching `url`: a path-scoped record whose pathPattern the current
  // pathname contains, preferring the longest pathPattern when more than one matches, falling back to a
  // domain-only record (pathPattern null) for the hostname, or null if nothing matches at all.
  function findForUrl(url) {
    var parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return null;
    }
    var records = loadAll().filter(function (r) {
      return r.hostname === parsed.hostname;
    });
    var pathScoped = records.filter(function (r) {
      return r.pathPattern && parsed.pathname.indexOf(r.pathPattern) !== -1;
    });
    if (pathScoped.length) {
      pathScoped.sort(function (a, b) {
        return b.pathPattern.length - a.pathPattern.length;
      });
      return pathScoped[0];
    }
    var domainOnly = records.filter(function (r) {
      return !r.pathPattern;
    });
    return domainOnly.length ? domainOnly[0] : null;
  }

  function listForHostname(hostname) {
    return loadAll().filter(function (r) {
      return r.hostname === hostname;
    });
  }

  return {
    save: save,
    remove: remove,
    findForUrl: findForUrl,
    listForHostname: listForHostname,
    loadAll: loadAll,
  };
})();
