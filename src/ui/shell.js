// requires: App.core.log, App.core.storage, App.ui.styles.theme, App.ui.styles.flyout,
// App.ui.styles.shell, App.ui.styles.quickAdd, App.ui.styles.datePicker, App.ui.styles.timePicker,
// App.ui.styles.typePicker, App.ui.styles.stepPicker, App.ui.styles.fullScreen,
// App.ui.styles.filterSortBar, App.ui.styles.indicators, App.ui.styles.settingsPanel,
// App.ui.styles.taskEditPanel, App.ui.styles.followUpPrompt, App.ui.styles.compactContactTasks,
// App.ui.quickAdd, App.ui.fullScreen, App.ui.compactContactTasks, App.tasks.taskStore
'use strict';
App.ui = App.ui || {};
// The floating panel: three densities of one widget (dot/compact/full-screen) sharing one saved
// position, mounted into a shadow DOM host so the host page's CSS can never leak in or be leaked onto.
// Ported structure verbatim from the predecessor — only storage keys, the host id, and the contact-
// resolution wiring (App.ui.compactContactTasks.getContactId() from the mapping engine, instead of a
// GHL URL regex) actually change.
App.ui.shell = (function () {
  var HOST_ID = 'crmtm-host';
  var DENSITY_STORAGE_KEY = 'crmTaskMaster.ui.density';
  // Dot (super-compact) and bar (compact) are the same floating widget at two sizes, not two
  // independent windows — they share one saved position so expanding/collapsing never "teleports" it.
  // Full-screen is not draggable and always fills the viewport, so it has no position of its own.
  var FLOATING_POSITION_KEY = 'crmTaskMaster.ui.floatingPosition';

  var DENSITY = {
    SUPER_COMPACT: 'superCompact',
    COMPACT: 'compact',
    FULL_SCREEN: 'fullScreen',
  };

  var state = {
    density: DENSITY.SUPER_COMPACT,
    container: null,
    dragCleanups: [],
    fullScreenCleanup: null,
    compactContactTasksCleanup: null,
    compactContactTasksInstance: null,
  };

  function loadFloatingPosition() {
    return App.core.storage.get(FLOATING_POSITION_KEY, null);
  }

  function saveFloatingPosition(position) {
    App.core.storage.set(FLOATING_POSITION_KEY, position);
  }

  // Only overrides position when a drag was previously saved; otherwise the element keeps the
  // bottom/right anchor baked into its CSS class as a sane default.
  function applyFloatingPosition(el) {
    var pos = loadFloatingPosition();
    if (pos && typeof pos.top === 'number' && typeof pos.left === 'number') {
      el.style.top = pos.top + 'px';
      el.style.left = pos.left + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
  }

  // handleEl starts the drag; moveEl is what actually gets repositioned (same element for the dot, a
  // drag-handle child for the bar). onClick fires only if the pointer never moved past a small
  // threshold, so a plain click doesn't get swallowed as a zero-distance drag.
  function makeDraggable(handleEl, moveEl, onClick) {
    var dragging = false;
    var moved = false;
    var startX, startY, startTop, startLeft;

    function onMouseDown(e) {
      dragging = true;
      moved = false;
      var rect = moveEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startTop = rect.top;
      startLeft = rect.left;
      e.preventDefault();
    }

    function onMouseMove(e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      moveEl.style.top = startTop + dy + 'px';
      moveEl.style.left = startLeft + dx + 'px';
      moveEl.style.right = 'auto';
      moveEl.style.bottom = 'auto';
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        var rect = moveEl.getBoundingClientRect();
        saveFloatingPosition({ top: rect.top, left: rect.left });
      } else if (onClick) {
        onClick();
      }
    }

    handleEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return function destroy() {
      handleEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }

  function pushDragCleanup(destroy) {
    state.dragCleanups.push(destroy);
  }

  function clearDragCleanups() {
    state.dragCleanups.forEach(function (destroy) {
      destroy();
    });
    state.dragCleanups = [];
  }

  function setDensity(density) {
    state.density = density;
    App.core.storage.set(DENSITY_STORAGE_KEY, density);
    render();
  }

  function renderSuperCompact() {
    var dot = document.createElement('div');
    dot.className = 'crmtm-dot';
    dot.title = 'CRM Task Master — click to expand';
    dot.textContent = '✓';
    state.container.appendChild(dot);
    applyFloatingPosition(dot);
    pushDragCleanup(
      makeDraggable(dot, dot, function () {
        setDensity(DENSITY.COMPACT);
      })
    );
  }

  function renderCompact() {
    var bar = document.createElement('div');
    bar.className = 'crmtm-compact-bar';

    // Header row: drag handle, task-name preview, expand/collapse — all one line, so the buttons
    // always sit at the same height as the name and never beside/overlap the (taller, wider) input row
    // below.
    var header = document.createElement('div');
    header.className = 'crmtm-bar-header';
    bar.appendChild(header);

    var handle = document.createElement('div');
    handle.className = 'crmtm-drag-handle';
    handle.textContent = '⋮⋮';
    header.appendChild(handle);

    var titleMount = document.createElement('div');
    titleMount.className = 'crmtm-bar-title-mount';
    header.appendChild(titleMount);

    var expandBtn = document.createElement('button');
    expandBtn.className = 'crmtm-btn';
    expandBtn.textContent = '⛶';
    expandBtn.title = 'Open full screen';
    expandBtn.addEventListener('click', function () {
      setDensity(DENSITY.FULL_SCREEN);
    });
    header.appendChild(expandBtn);

    var collapseBtn = document.createElement('button');
    collapseBtn.className = 'crmtm-btn';
    collapseBtn.textContent = '–';
    collapseBtn.title = 'Collapse';
    collapseBtn.addEventListener('click', function () {
      setDensity(DENSITY.SUPER_COMPACT);
    });
    header.appendChild(collapseBtn);

    // Mounted before quickAdd so quickAdd's getContactId can read from it immediately (both mount
    // synchronously; compactContactTasks' own contact resolution is async and updates in place).
    var compactContactTasksMount = document.createElement('div');
    bar.appendChild(compactContactTasksMount);
    var compactContactTasksInstance = App.ui.compactContactTasks.mount(compactContactTasksMount);
    state.compactContactTasksCleanup = compactContactTasksInstance.destroy;
    state.compactContactTasksInstance = compactContactTasksInstance;

    var quickAddMount = document.createElement('div');
    quickAddMount.className = 'crmtm-quick-add-mount';
    bar.insertBefore(quickAddMount, compactContactTasksMount);
    App.ui.quickAdd.mount(quickAddMount, {
      titleContainer: titleMount,
      getContactId: function () {
        return state.compactContactTasksInstance ? state.compactContactTasksInstance.getContactId() : null;
      },
      onCreated: function () { App.tasks.taskStore.refresh(); },
    });

    state.container.appendChild(bar);
    applyFloatingPosition(bar);
    pushDragCleanup(makeDraggable(handle, bar, null));
  }

  // Full-screen fills the viewport — not draggable, no saved position of its own; collapsing back to
  // compact/dot restores wherever the floating widget was left.
  function renderFullScreen() {
    var panel = document.createElement('div');
    panel.className = 'crmtm-fullscreen-panel';

    var header = document.createElement('div');
    header.className = 'crmtm-fullscreen-header';

    var title = document.createElement('span');
    title.className = 'crmtm-fullscreen-title';
    title.textContent = 'CRM Task Master';
    header.appendChild(title);

    var compactBtn = document.createElement('button');
    compactBtn.className = 'crmtm-btn';
    compactBtn.textContent = '▁';
    compactBtn.title = 'Back to compact';
    compactBtn.addEventListener('click', function () {
      setDensity(DENSITY.COMPACT);
    });
    header.appendChild(compactBtn);

    var dotBtn = document.createElement('button');
    dotBtn.className = 'crmtm-btn';
    dotBtn.textContent = '•';
    dotBtn.title = 'Collapse to dot';
    dotBtn.addEventListener('click', function () {
      setDensity(DENSITY.SUPER_COMPACT);
    });
    header.appendChild(dotBtn);

    panel.appendChild(header);

    var body = document.createElement('div');
    body.className = 'crmtm-fullscreen-body';
    panel.appendChild(body);
    // App.ui.fullScreen needs a way to collapse the widget to its dot form before navigating to a
    // contact — setDensity lives here, not in fullScreen.js, since shell.js is the one that mounts
    // fullScreen, not the other way around.
    var fullScreenInstance = App.ui.fullScreen.mount(body, {
      onCollapseToDot: function () {
        setDensity(DENSITY.SUPER_COMPACT);
      },
    });
    state.fullScreenCleanup = fullScreenInstance.destroy;

    state.container.appendChild(panel);
  }

  function render() {
    clearDragCleanups();
    // App.ui.fullScreen subscribes to the task store for as long as it's mounted — tear that down
    // before wiping the DOM out from under it, otherwise leaving full-screen (or any other density
    // switch) leaks one more subscription every time.
    if (state.fullScreenCleanup) {
      state.fullScreenCleanup();
      state.fullScreenCleanup = null;
    }
    // Same leak-avoidance reasoning as fullScreenCleanup above — App.ui.compactContactTasks owns a
    // taskStore subscription + a URL-polling setInterval for as long as the compact bar is mounted.
    if (state.compactContactTasksCleanup) {
      state.compactContactTasksCleanup();
      state.compactContactTasksCleanup = null;
      state.compactContactTasksInstance = null;
    }
    state.container.innerHTML = '';
    if (state.density === DENSITY.COMPACT) {
      renderCompact();
    } else if (state.density === DENSITY.FULL_SCREEN) {
      renderFullScreen();
    } else {
      renderSuperCompact();
    }
  }

  function init() {
    if (!document.body || document.getElementById(HOST_ID)) return;

    var host = document.createElement('div');
    host.id = HOST_ID;
    // Reset any page CSS that might target bare divs (display:none, margins, etc.) and keep the host
    // itself out of the CRM's layout — a shadow root's fixed-position children still position against
    // the viewport as long as no ancestor (including this host) has a transform/filter set.
    host.style.cssText = 'all: initial; display: contents;';
    document.body.appendChild(host);

    var shadowRoot = host.attachShadow({ mode: 'open' });
    var styleEl = document.createElement('style');
    // Combines every UI module's own stylesheet (theme tokens first so var() references resolve) into
    // one <style> tag. Adding a new UI module's styles means adding one line here — nothing else in
    // this file needs to change.
    styleEl.textContent = [
      App.ui.styles.theme,
      App.ui.styles.flyout,
      App.ui.styles.shell,
      App.ui.styles.quickAdd,
      App.ui.styles.datePicker,
      App.ui.styles.timePicker,
      App.ui.styles.typePicker,
      App.ui.styles.stepPicker,
      App.ui.styles.fullScreen,
      App.ui.styles.filterSortBar,
      App.ui.styles.indicators,
      App.ui.styles.settingsPanel,
      App.ui.styles.taskEditPanel,
      App.ui.styles.followUpPrompt,
      App.ui.styles.compactContactTasks,
    ].join('\n');
    shadowRoot.appendChild(styleEl);

    state.container = document.createElement('div');
    shadowRoot.appendChild(state.container);

    state.density = App.core.storage.get(DENSITY_STORAGE_KEY, DENSITY.SUPER_COMPACT);
    App.core.log('UI shell mounted, density:', state.density);
    App.tasks.taskStore.startPolling();
    render();
  }

  return {
    init: init,
    setDensity: setDensity,
  };
})();
