// requires: App.core.log, App.core.notionClient, App.tasks.taskStore, App.ui.indicators,
// App.mapping.pageContext, App.mapping.elementPicker, App.mapping.storage, App.mapping.contactMatcher,
// App.mapping.contactExtractor
'use strict';
App.ui = App.ui || {};
// Mounted by src/ui/shell.js's renderCompact() directly inside the same compact-bar element the drag
// handle already moves as one unit. Polls location.href on a short timer (the CRM's contact-detail
// route is typically client-side routing, no popstate/load event to hook — same tradeoff the predecessor
// project made) and resolves what the current page corresponds to via App.mapping.pageContext: an
// unmapped site, a broken mapping, an extracted-but-unmatched contact, or a matched Notion contact. Shows
// either a small Map/Remap/Create banner (GOAL.md points 4-5) or — once matched — that contact's
// incomplete tasks, minimal (complete button, task name, due date), same as the predecessor's compact
// task list.
App.ui.compactContactTasks = (function () {
  var POLL_INTERVAL_MS = 800;
  var ICON_CHEVRON =
    '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  function mount(container) {
    var wrap = document.createElement('div');
    wrap.className = 'crmtm-cct';
    container.appendChild(wrap);

    var localState = {
      url: null,
      status: null,
      contact: null,
      mapping: null,
      extracted: null,
      brokenFields: [],
      allTasks: [], // full current task snapshot from taskStore, unfiltered by contact
      pendingIds: {},
      lastError: null,
      picking: false,
      // Details disclosure (owner: "little arrow I click to expand and collapse details when new contact
      // is offered to be added or when I map something") — detailsOpen holds the status key ('broken' or
      // 'no-contact-match') the panel is currently open for, null when collapsed. debugCandidates is a
      // lazily-fetched cache of Notion phone/email lookups for the no-contact-match panel's "what options
      // does it have in the database" view; both reset on every page/contact change (resolvePageContext).
      detailsOpen: null,
      debugCandidates: null,
    };

    function visibleTasks() {
      if (!localState.contact) return [];
      return localState.allTasks
        .filter(function (task) {
          return task.contactId === localState.contact.id && task.status !== 'Completed';
        })
        .slice()
        .sort(function (a, b) {
          if (!a.due) return 1;
          if (!b.due) return -1;
          return a.due.getTime() - b.due.getTime();
        });
    }

    function completeTask(task) {
      localState.lastError = null;
      localState.pendingIds[task.id] = true;
      render();
      App.core.notionClient.updateTask(task.id, { status: 'Completed' }).then(
        function () {
          delete localState.pendingIds[task.id];
          // Non-optimistic: the row only actually disappears once this refresh's confirmed snapshot
          // reaches the taskStore.subscribe callback below, not immediately here.
          App.tasks.taskStore.refresh();
        },
        function (error) {
          App.core.log('compactContactTasks: complete failed:', error.message);
          delete localState.pendingIds[task.id];
          localState.lastError = 'Could not complete that task — ' + error.message;
          render();
        }
      );
    }

    // Runs the click-to-map picker once per field (name, phone, email in turn), then saves the
    // resulting mapping and re-resolves the page. pathPattern null = domain-only (first save for this
    // hostname); a non-null pathPattern re-maps that same specific page-type scope (GOAL.md point 6).
    function startMappingFlow(pathPattern) {
      if (localState.picking) return;
      localState.picking = true;
      render();
      var hostname = new URL(location.href).hostname;
      var fields = {};
      var steps = [
        { type: 'name', label: 'the contact name' },
        { type: 'phone', label: 'the phone number' },
        { type: 'email', label: 'the email address' },
      ];
      function nextStep(index) {
        if (index >= steps.length) {
          App.mapping.storage.save(hostname, pathPattern, fields);
          localState.picking = false;
          resolvePageContext();
          return;
        }
        var step = steps[index];
        App.mapping.elementPicker.start(step.type, step.label, function (fieldMapping) {
          fields[step.type] = fieldMapping;
          nextStep(index + 1);
        });
      }
      nextStep(0);
    }

    function createContactFromExtracted() {
      if (!localState.extracted) return;
      App.mapping.contactMatcher.createFromExtracted(localState.extracted, localState.url).then(function () {
        resolvePageContext();
      });
    }

    // Lazily fetches Notion's exact-match results for the extracted phone/email, one query per field
    // (same shape as App.mapping.contactMatcher's real lookups) — only runs once per page resolution,
    // triggered the first time the details panel is opened, not on every render.
    function ensureDebugCandidates() {
      if (localState.debugCandidates) return;
      localState.debugCandidates = { loading: true, phone: [], email: [], error: null };
      var phone = localState.extracted && localState.extracted.phone;
      var email = localState.extracted && localState.extracted.email;
      Promise.all([
        phone ? App.core.notionClient.findContact({ phone: phone }) : Promise.resolve([]),
        email ? App.core.notionClient.findContact({ email: email }) : Promise.resolve([]),
      ]).then(
        function (results) {
          localState.debugCandidates = {
            loading: false,
            phone: results[0].map(App.core.notionClient.decorateContact),
            email: results[1].map(App.core.notionClient.decorateContact),
            error: null,
          };
          render();
        },
        function (error) {
          localState.debugCandidates = { loading: false, phone: [], email: [], error: error.message };
          render();
        }
      );
    }

    // Links this page's URL onto an existing Notion contact the owner picked from the debug panel's
    // candidate list, instead of creating a duplicate — same "URL Contact" slot createContactFromExtracted
    // uses, so this page resolves to that contact on the next poll.
    function useExistingContact(contact) {
      App.core.notionClient.updateContact(contact.id, { urlContact: localState.url }).then(function () {
        resolvePageContext();
      });
    }

    function appendDetailsToggle(banner, key, onOpen) {
      var btn = document.createElement('button');
      btn.type = 'button';
      var open = localState.detailsOpen === key;
      btn.className = 'crmtm-cct-details-toggle' + (open ? ' crmtm-cct-details-toggle-open' : '');
      btn.title = open ? 'Hide details' : 'Show details';
      btn.innerHTML = ICON_CHEVRON;
      btn.addEventListener('click', function () {
        var opening = localState.detailsOpen !== key;
        localState.detailsOpen = opening ? key : null;
        if (opening && onOpen) onOpen();
        render();
      });
      banner.appendChild(btn);
    }

    function addDetailRow(panel, label, value) {
      var row = document.createElement('div');
      row.className = 'crmtm-cct-details-row';
      var labelEl = document.createElement('span');
      labelEl.className = 'crmtm-cct-details-label';
      labelEl.textContent = label + ':';
      row.appendChild(labelEl);
      var valueEl = document.createElement('span');
      valueEl.className = 'crmtm-cct-details-value';
      valueEl.textContent = value || '—';
      row.appendChild(valueEl);
      panel.appendChild(row);
    }

    function addDetailsHeading(panel, text) {
      var heading = document.createElement('div');
      heading.className = 'crmtm-cct-details-heading';
      heading.textContent = text;
      panel.appendChild(heading);
    }

    function addDetailsEmpty(panel, text) {
      var empty = document.createElement('div');
      empty.className = 'crmtm-cct-details-empty';
      empty.textContent = text;
      panel.appendChild(empty);
    }

    function renderCandidateGroup(panel, label, contacts) {
      addDetailsHeading(panel, label + ' (' + contacts.length + ')');
      if (!contacts.length) {
        addDetailsEmpty(panel, 'no exact match');
        return;
      }
      contacts.forEach(function (contact) {
        var row = document.createElement('div');
        row.className = 'crmtm-cct-candidate';
        var info = document.createElement('span');
        info.className = 'crmtm-cct-candidate-info';
        info.textContent = (contact.name || '(no name)') + ' — ' + (contact.phone || '—') + ' / ' + (contact.email || '—');
        row.appendChild(info);
        var useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'crmtm-btn crmtm-cct-candidate-use';
        useBtn.textContent = 'Use this';
        useBtn.title = 'Link this page to this existing contact instead of creating a new one';
        useBtn.addEventListener('click', function () { useExistingContact(contact); });
        row.appendChild(useBtn);
        panel.appendChild(row);
      });
    }

    // What the mapped selectors are actually seeing on the live page right now, candidate-by-candidate —
    // shown when a mapping resolved to nothing at all (status 'broken') so the owner can see which tier
    // failed and why (didn't resolve vs. resolved but rejected by the shape check).
    function buildBrokenDetails(panel) {
      var mapping = localState.mapping;
      addDetailRow(panel, 'Hostname', mapping ? mapping.hostname : (localState.url ? new URL(localState.url).hostname : ''));
      addDetailRow(panel, 'Page scope', mapping && mapping.pathPattern ? mapping.pathPattern : '(domain-wide)');
      if (!mapping) return;
      var diagnostics = App.mapping.contactExtractor.diagnose(mapping);
      ['name', 'phone', 'email'].forEach(function (fieldType) {
        var rows = diagnostics[fieldType];
        addDetailsHeading(panel, fieldType);
        if (!rows) {
          addDetailsEmpty(panel, 'not mapped');
          return;
        }
        rows.forEach(function (r) {
          var line = document.createElement('div');
          var ok = r.resolved && r.shapeOk;
          line.className = 'crmtm-cct-details-candidate' + (ok ? ' crmtm-cct-details-candidate-ok' : '');
          var desc = r.type === 'css' ? r.selector : 'label "' + r.labelText + '"';
          var statusText = !r.resolved ? 'no match' : (!r.shapeOk ? 'resolved but rejected: "' + r.text + '"' : '"' + r.text + '"');
          line.textContent = 'tier ' + r.tier + ' — ' + desc + ' → ' + statusText;
          panel.appendChild(line);
        });
      });
    }

    // Extracted values plus, once fetched, exactly what Notion returned for a phone-only and email-only
    // lookup — the "what values it's seeing" / "what options does it have in the database" debug view for
    // the offer-to-create-contact banner.
    function buildNoMatchDetails(panel) {
      addDetailRow(panel, 'Name', localState.extracted && localState.extracted.name);
      addDetailRow(panel, 'Phone', localState.extracted && localState.extracted.phone);
      addDetailRow(panel, 'Email', localState.extracted && localState.extracted.email);

      addDetailsHeading(panel, 'Database options');
      var debug = localState.debugCandidates;
      if (!debug || debug.loading) {
        addDetailsEmpty(panel, 'Searching…');
        return;
      }
      if (debug.error) {
        addDetailsEmpty(panel, 'Search failed — ' + debug.error);
        return;
      }
      renderCandidateGroup(panel, 'Phone match', debug.phone);
      renderCandidateGroup(panel, 'Email match', debug.email);
    }

    function renderDetailsPanel(key, buildFn) {
      if (localState.detailsOpen !== key) return;
      var panel = document.createElement('div');
      panel.className = 'crmtm-cct-details-panel';
      buildFn(panel);
      wrap.appendChild(panel);
    }

    function renderBanner() {
      var banner = document.createElement('div');
      banner.className = 'crmtm-cct-banner';

      if (localState.picking) {
        banner.textContent = 'Click the field…';
        wrap.appendChild(banner);
        return;
      }

      if (localState.status === 'no-mapping') {
        var text = document.createElement('span');
        text.textContent = 'Not mapped';
        banner.appendChild(text);
        var mapBtn = document.createElement('button');
        mapBtn.type = 'button';
        mapBtn.className = 'crmtm-btn crmtm-cct-map-btn';
        mapBtn.textContent = 'Map';
        mapBtn.addEventListener('click', function () { startMappingFlow(null); });
        banner.appendChild(mapBtn);
        wrap.appendChild(banner);
        return;
      }

      if (localState.status === 'broken') {
        var brokenText = document.createElement('span');
        brokenText.textContent = 'Mapping broken';
        banner.appendChild(brokenText);
        var remapBtn = document.createElement('button');
        remapBtn.type = 'button';
        remapBtn.className = 'crmtm-btn crmtm-cct-map-btn';
        remapBtn.textContent = 'Remap';
        remapBtn.addEventListener('click', function () {
          startMappingFlow(localState.mapping ? localState.mapping.pathPattern : null);
        });
        banner.appendChild(remapBtn);
        appendDetailsToggle(banner, 'broken');
        wrap.appendChild(banner);
        renderDetailsPanel('broken', buildBrokenDetails);
        return;
      }

      if (localState.status === 'no-contact-match') {
        var noMatchText = document.createElement('span');
        var name = localState.extracted && (localState.extracted.name || localState.extracted.phone || localState.extracted.email);
        noMatchText.textContent = (name || 'Contact') + ' not found';
        banner.appendChild(noMatchText);
        var createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.className = 'crmtm-btn crmtm-cct-map-btn';
        createBtn.textContent = 'Create';
        createBtn.addEventListener('click', createContactFromExtracted);
        banner.appendChild(createBtn);
        var noMatchRemapBtn = document.createElement('button');
        noMatchRemapBtn.type = 'button';
        noMatchRemapBtn.className = 'crmtm-btn crmtm-cct-map-btn';
        noMatchRemapBtn.textContent = 'Remap';
        noMatchRemapBtn.addEventListener('click', function () {
          startMappingFlow(localState.mapping ? localState.mapping.pathPattern : null);
        });
        banner.appendChild(noMatchRemapBtn);
        appendDetailsToggle(banner, 'no-contact-match', ensureDebugCandidates);
        wrap.appendChild(banner);
        renderDetailsPanel('no-contact-match', buildNoMatchDetails);
        return;
      }
    }

    function render() {
      wrap.innerHTML = '';

      if (localState.status !== 'matched') {
        renderBanner();
        return;
      }

      if (localState.lastError) {
        var errorEl = document.createElement('div');
        errorEl.className = 'crmtm-cct-error';
        errorEl.textContent = localState.lastError;
        wrap.appendChild(errorEl);
      }

      visibleTasks().forEach(function (task) {
        var row = document.createElement('div');
        row.className = 'crmtm-cct-row';

        var completeBtn = document.createElement('button');
        completeBtn.type = 'button';
        completeBtn.className = 'crmtm-cct-complete';
        completeBtn.title = 'Mark completed';
        completeBtn.textContent = '✓';
        var pending = !!localState.pendingIds[task.id];
        completeBtn.disabled = !task.id || pending;
        completeBtn.addEventListener('click', function () {
          completeTask(task);
        });
        row.appendChild(completeBtn);

        var titleEl = document.createElement('span');
        titleEl.className = 'crmtm-cct-title';
        titleEl.textContent = task.title || '(untitled)';
        row.appendChild(titleEl);

        var dueLabel = App.ui.indicators.formatDueLabel(task.due);
        if (dueLabel) {
          var dueEl = document.createElement('span');
          dueEl.className = 'crmtm-cct-due';
          dueEl.textContent = dueLabel;
          row.appendChild(dueEl);
        }

        wrap.appendChild(row);
      });
    }

    var unsubscribe = App.tasks.taskStore.subscribe(function (tasks) {
      localState.allTasks = tasks;
      render();
    });

    function resolvePageContext() {
      localState.url = location.href;
      // A fresh page/contact invalidates any open debug panel and its cached candidates — otherwise stale
      // "database options" from the previous contact would linger under the new one.
      localState.detailsOpen = null;
      localState.debugCandidates = null;
      App.mapping.pageContext.resolve(localState.url).then(function (result) {
        if (localState.url !== location.href) return; // navigated again while this was in flight
        localState.status = result.status;
        localState.contact = result.contact || null;
        localState.mapping = result.mapping || null;
        localState.extracted = result.extracted || null;
        localState.brokenFields = result.brokenFields || [];
        render();
      });
    }

    function checkUrl() {
      if (location.href !== localState.url) resolvePageContext();
    }
    checkUrl();
    var pollTimer = setInterval(checkUrl, POLL_INTERVAL_MS);

    return {
      getContactId: function () {
        return localState.contact ? localState.contact.id : null;
      },
      destroy: function () {
        unsubscribe();
        clearInterval(pollTimer);
      },
    };
  }

  return {
    mount: mount,
  };
})();
