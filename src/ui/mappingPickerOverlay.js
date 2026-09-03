// requires: (none)
'use strict';
App.ui = App.ui || {};
// Minimal visual chrome for the click-to-map picker: a highlight box that tracks whatever element is
// currently hovered, plus a small fixed instruction banner. Deliberately dependency-free inline styles
// (no shadow DOM here) so it can highlight elements anywhere on the host page, including inside the
// CRM's own layout, without fighting the floating panel's shadow root.
App.ui.mappingPickerOverlay = (function () {
  var highlightEl = null;
  var bannerEl = null;

  function ensureHighlight() {
    if (highlightEl) return highlightEl;
    highlightEl = document.createElement('div');
    highlightEl.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:2147483646',
      'border:2px solid #2f7ff2', 'background:rgba(47,127,242,0.12)',
      'border-radius:3px', 'transition:all 60ms ease-out', 'display:none',
    ].join(';');
    document.documentElement.appendChild(highlightEl);
    return highlightEl;
  }

  function ensureBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.style.cssText = [
      'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:2147483647', 'background:#1f2430', 'color:#fff', 'padding:8px 16px',
      'border-radius:6px', 'font:13px/1.4 -apple-system,sans-serif', 'display:none',
      'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
    ].join(';');
    document.documentElement.appendChild(bannerEl);
    return bannerEl;
  }

  function highlight(el) {
    var box = ensureHighlight();
    if (!el) {
      box.style.display = 'none';
      return;
    }
    var rect = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.top = rect.top + 'px';
    box.style.left = rect.left + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  }

  function showInstruction(text) {
    var banner = ensureBanner();
    banner.textContent = text;
    banner.style.display = 'block';
  }

  function hideInstruction() {
    if (bannerEl) bannerEl.style.display = 'none';
  }

  function teardown() {
    highlight(null);
    hideInstruction();
  }

  return {
    highlight: highlight,
    showInstruction: showInstruction,
    hideInstruction: hideInstruction,
    teardown: teardown,
  };
})();
