// requires: App.core.log, App.core.notionClient, App.tasks.taskStore, App.ui.indicators,
// App.mapping.pageContext, App.mapping.elementPicker, App.mapping.storage, App.mapping.contactMatcher
'use strict';
App.ui = App.ui || {};
// Mounted by src/ui/shell.js's renderCompact() directly inside the same compact-bar element the drag
// handle already moves as one unit. Polls location.href on a short timer (the CRM's contact-detail
// route is typically client-side routing, no popstate/load event to hook — same tradeoff the predecessor
// project made) and resolves what the current page corresponds to via App.mapping.pageContext: an
// unmapped site, a broken mapping, an extracted-but-unmatched contact, or a matched Notion contact. Shows
// either a small "map this site"/"re-map"/"create contact" banner (GOAL.md points 4-5) or — once
// matched — that contact's incomplete tasks, minimal (complete button, task name, due date), same as the
// predecessor's compact task list.
App.ui.compactContactTasks = (function () {
  var POLL_INTERVAL_MS = 800;

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

    function renderBanner() {
      var banner = document.createElement('div');
      banner.className = 'crmtm-cct-banner';

      if (localState.picking) {
        banner.textContent = 'Click the page element for the field being mapped…';
        wrap.appendChild(banner);
        return;
      }

      if (localState.status === 'no-mapping') {
        var text = document.createElement('span');
        text.textContent = "This site isn't mapped yet.";
        banner.appendChild(text);
        var mapBtn = document.createElement('button');
        mapBtn.type = 'button';
        mapBtn.className = 'crmtm-btn crmtm-cct-map-btn';
        mapBtn.textContent = 'Map this site';
        mapBtn.addEventListener('click', function () { startMappingFlow(null); });
        banner.appendChild(mapBtn);
        wrap.appendChild(banner);
        return;
      }

      if (localState.status === 'broken') {
        var brokenText = document.createElement('span');
        brokenText.textContent = 'Mapping broke for: ' + localState.brokenFields.join(', ') + '.';
        banner.appendChild(brokenText);
        var remapBtn = document.createElement('button');
        remapBtn.type = 'button';
        remapBtn.className = 'crmtm-btn crmtm-cct-map-btn';
        remapBtn.textContent = 'Re-map';
        remapBtn.addEventListener('click', function () {
          startMappingFlow(localState.mapping ? localState.mapping.pathPattern : null);
        });
        banner.appendChild(remapBtn);
        wrap.appendChild(banner);
        return;
      }

      if (localState.status === 'no-contact-match') {
        var noMatchText = document.createElement('span');
        var name = localState.extracted && (localState.extracted.name || localState.extracted.phone || localState.extracted.email);
        noMatchText.textContent = 'No matching Notion contact found' + (name ? ' for ' + name : '') + '.';
        banner.appendChild(noMatchText);
        var createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.className = 'crmtm-btn crmtm-cct-map-btn';
        createBtn.textContent = 'Create contact';
        createBtn.addEventListener('click', createContactFromExtracted);
        banner.appendChild(createBtn);
        wrap.appendChild(banner);
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
