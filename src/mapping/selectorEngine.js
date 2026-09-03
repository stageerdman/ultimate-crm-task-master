// requires: (none)
'use strict';
App.mapping = App.mapping || {};
// Ranked, multi-candidate selector generation for the click-to-map picker (ROADMAP.md Step 2). Against
// arbitrary, uncontrolled CRM markup a single selector is never trustworthy long-term — this module
// generates one candidate per robustness tier, verifies uniqueness at save-time, and re-resolves through
// the ranked list at read-time so a broken top candidate degrades gracefully instead of failing outright.
App.mapping.selectorEngine = (function () {
  var MAX_ANCESTOR_WALK = 6;
  var LABEL_DICTIONARY = ['phone', 'email', 'name', 'contact', 'full name', 'e-mail', 'mobile', 'cell'];

  // Rejects framework-generated attribute values (ember482, react-select-3-input, mui-12, hashed ids)
  // so tier 1 never trusts an id/data-attr that's actually more volatile than a plain class name.
  function looksHandAuthored(value) {
    if (!value) return false;
    if (/^[a-z]+[-_]?\d{2,}$/i.test(value)) return false; // ember482, radix-3, mui-12
    if (/^[0-9a-f]{6,}$/i.test(value)) return false; // hash-looking
    if (/\d{4,}/.test(value)) return false; // long digit runs
    return /^[a-z][\w-]{1,60}$/i.test(value);
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
  }

  function tagSelector(el) {
    return el.tagName.toLowerCase();
  }

  function ownStableAttrSelector(el) {
    var candidates = ['data-testid', 'data-qa', 'data-cy', 'data-test', 'data-id', 'id', 'name'];
    for (var i = 0; i < candidates.length; i++) {
      var attr = candidates[i];
      var value = el.getAttribute(attr);
      if (looksHandAuthored(value)) {
        return tagSelector(el) + '[' + attr + '="' + cssEscape(value) + '"]';
      }
    }
    return null;
  }

  function ariaCandidate(el) {
    var label = el.getAttribute('aria-label');
    var role = el.getAttribute('role');
    if (label) {
      return tagSelector(el) + '[aria-label="' + cssEscape(label) + '"]';
    }
    if (role) {
      return tagSelector(el) + '[role="' + cssEscape(role) + '"]';
    }
    return null;
  }

  function nthOfTypeIndex(el) {
    var index = 1;
    var sib = el;
    while ((sib = sib.previousElementSibling)) {
      if (sib.tagName === el.tagName) index++;
    }
    return index;
  }

  function relativePath(target, ancestor) {
    var parts = [];
    var node = target;
    while (node && node !== ancestor) {
      parts.unshift(tagSelector(node) + ':nth-of-type(' + nthOfTypeIndex(node) + ')');
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function absolutePath(el) {
    var parts = [];
    var node = el;
    while (node && node !== document.body && node.parentElement) {
      parts.unshift(tagSelector(node) + ':nth-of-type(' + nthOfTypeIndex(node) + ')');
      node = node.parentElement;
    }
    return 'body > ' + parts.join(' > ');
  }

  function semanticClassSelector(el) {
    var classList = Array.prototype.slice.call(el.classList || []);
    var semantic = classList.filter(function (cls) {
      if (/^(css-|sc-|jsx-|_)/.test(cls)) return false;
      if (/\d{4,}/.test(cls)) return false;
      if (!/^[a-z][a-zA-Z0-9-]{2,40}$/.test(cls)) return false;
      return true;
    });
    if (!semantic.length) return null;
    return tagSelector(el) + semantic.slice(0, 3).map(function (c) {
      return '.' + cssEscape(c);
    }).join('');
  }

  function findLabelAnchor(el) {
    var scopeRoot = el;
    for (var up = 0; up < 3 && scopeRoot.parentElement; up++) scopeRoot = scopeRoot.parentElement;
    var walker = document.createTreeWalker(scopeRoot, NodeFilter.SHOW_ELEMENT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node === el || node.contains(el)) continue;
      var text = (node.textContent || '').trim().toLowerCase();
      if (text.length > 40) continue;
      for (var i = 0; i < LABEL_DICTIONARY.length; i++) {
        if (text === LABEL_DICTIONARY[i]) {
          return { labelText: text, tagName: node.tagName.toLowerCase() };
        }
      }
    }
    return null;
  }

  // Builds the ranked candidate list for a clicked element. Each candidate is { tier, type, selector }
  // (type 'css') or { tier, type: 'labelText', labelText } — resolve() below knows how to try both.
  function generateCandidates(el) {
    var candidates = [];

    var ownAttr = ownStableAttrSelector(el);
    if (ownAttr) candidates.push({ tier: 1, type: 'css', selector: ownAttr });

    var aria = ariaCandidate(el);
    if (aria) candidates.push({ tier: 2, type: 'css', selector: aria });

    var node = el.parentElement;
    var depth = 0;
    while (node && depth < MAX_ANCESTOR_WALK) {
      var ancestorAttr = ownStableAttrSelector(node);
      if (ancestorAttr) {
        var rel = relativePath(el, node);
        candidates.push({ tier: 3, type: 'css', selector: ancestorAttr + (rel ? ' > ' + rel : '') });
        break;
      }
      node = node.parentElement;
      depth++;
    }

    var labelAnchor = findLabelAnchor(el);
    if (labelAnchor) candidates.push({ tier: 4, type: 'labelText', labelText: labelAnchor.labelText });

    var classSelector = semanticClassSelector(el);
    if (classSelector) candidates.push({ tier: 5, type: 'css', selector: classSelector });

    // Always generated, last resort, so save() never comes up empty even against the worst markup.
    candidates.push({ tier: 6, type: 'css', selector: absolutePath(el) });

    return candidates;
  }

  function resolveCss(selector) {
    var matches;
    try {
      matches = document.querySelectorAll(selector);
    } catch (e) {
      return null;
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function resolveLabelText(labelText) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
    var node;
    var labelMatches = [];
    while ((node = walker.nextNode())) {
      var text = (node.textContent || '').trim().toLowerCase();
      if (text === labelText && text.length < 40) labelMatches.push(node);
    }
    if (labelMatches.length !== 1) return null;
    var labelEl = labelMatches[0];
    return labelEl.nextElementSibling || (labelEl.parentElement && labelEl.parentElement.nextElementSibling) || null;
  }

  // Tries a candidate against the live DOM, returns the resolved element or null.
  function resolveCandidate(candidate) {
    if (candidate.type === 'css') return resolveCss(candidate.selector);
    if (candidate.type === 'labelText') return resolveLabelText(candidate.labelText);
    return null;
  }

  var SHAPE_CHECKS = {
    phone: function (text) {
      var digits = (text.match(/\d/g) || []).length;
      return digits >= 6 && /^[\d\s()+\-.]+$/.test(text.trim());
    },
    email: function (text) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
    },
    name: function (text) {
      var trimmed = text.trim();
      return trimmed.length > 0 && !/^(loading|n\/a|--|undefined|null|\.\.\.)$/i.test(trimmed);
    },
  };

  function extractText(el) {
    if (!el) return '';
    if ('value' in el && typeof el.value === 'string' && el.value) return el.value;
    return (el.textContent || '').trim();
  }

  // Verifies a candidate at save-time: it must resolve to exactly one element, and it must be the
  // element the user actually clicked.
  function verifyCandidate(candidate, expectedEl) {
    var resolved = resolveCandidate(candidate);
    return resolved === expectedEl;
  }

  // Save-time: generate + keep only candidates that verify against the clicked element, in tier order.
  function buildVerifiedMapping(el, fieldType) {
    var candidates = generateCandidates(el).filter(function (c) {
      return verifyCandidate(c, el);
    });
    return {
      fieldType: fieldType,
      candidates: candidates,
      snapshotText: extractText(el),
      tagName: el.tagName.toLowerCase(),
    };
  }

  // Read-time: walk the ranked candidate list, stop at the first one that resolves uniquely AND passes
  // the field-type shape-sanity check. Returns { text, tier, degraded } or null if every candidate fails
  // (mapping broken — caller should trigger the re-map prompt). `degraded` is true when the winning
  // candidate isn't the top-ranked one, a leading indicator the page may be mid-redesign.
  function resolveMapping(mapping) {
    var shapeCheck = SHAPE_CHECKS[mapping.fieldType] || function () {
      return true;
    };
    for (var i = 0; i < mapping.candidates.length; i++) {
      var candidate = mapping.candidates[i];
      var el = resolveCandidate(candidate);
      if (!el) continue;
      var text = extractText(el);
      if (!shapeCheck(text)) continue;
      return { text: text, tier: candidate.tier, degraded: i > 0, element: el };
    }
    return null;
  }

  return {
    generateCandidates: generateCandidates,
    buildVerifiedMapping: buildVerifiedMapping,
    resolveMapping: resolveMapping,
    resolveCandidate: resolveCandidate,
  };
})();
