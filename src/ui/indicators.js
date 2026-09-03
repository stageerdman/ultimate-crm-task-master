// requires: App.core.timezone, App.tasks.timeBuckets, App.tasks.taskViews, App.ui.datePicker
'use strict';
App.ui = App.ui || {};
// Two independent coloring axes (bucket tag color, overdue text color), the persistent next-task glow
// badge, and the all-completed check. Pure data-model functions are exported alongside a small
// DOM-owning createBadge so App.ui.fullScreen can consume both without duplicating the countdown/
// selection logic. Ported near-verbatim from the predecessor — ISO due-date strings become real Date
// objects (task.due, already parsed by App.core.notionClient.decorateTask) and task.completed becomes
// task.status === 'Completed', but the coloring/countdown/badge rules themselves are unchanged.
App.ui.indicators = (function () {
  var TAG_COLORS = { morning: 'red', afternoon: 'orange', evening: 'purple', allday: 'gray' };

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function hhmmFromDate(date) {
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  // Real-clock-time fallback for a due time that isn't one of the 4 bucket values: red 6am-12pm, orange
  // 12pm-3pm, purple 3pm-midnight. Hours before 6am are treated as a continuation of the prior evening,
  // matching App.tasks.timeBuckets.getCurrentPeriod's own convention.
  function colorForRealHour(hour) {
    if (hour >= 6 && hour < 12) return 'red';
    if (hour >= 12 && hour < 15) return 'orange';
    return 'purple';
  }

  // Tag color (bucket indicator pill) — independent of the overdue text-color rule below. Returns null
  // for a task with no due date.
  function getTagColor(due) {
    if (!due) return null;
    var wallClock = App.core.timezone.toWallClock(due);
    var bucket = App.tasks.timeBuckets.getBucketForTime(hhmmFromDate(wallClock));
    return bucket ? TAG_COLORS[bucket] : colorForRealHour(wallClock.getHours());
  }

  function wallClockDayValue(date) {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }

  // Overdue text-color rule: incomplete + due time already passed. Independent axis from the tag color
  // above — a task can be purple-tagged (evening bucket) and red-text (overdue) at the same time.
  //
  // A bucket time (e.g. "afternoon" -> a placeholder HH:mm) is used only so the tag/label lookups above
  // can recognize which bucket a task belongs to — it was never meant to be a literal deadline. For a
  // bucket-tagged due date, "overdue" instead means its whole calendar day has passed, not that its
  // early-morning placeholder minute has ticked by. A real (non-bucket) due time keeps the exact
  // real-instant comparison unchanged.
  function isOverdue(task, now) {
    if (!task || task.status === 'Completed' || !task.due) return false;
    now = now || new Date();
    var dueWallClock = App.core.timezone.toWallClock(task.due);
    if (App.tasks.timeBuckets.isSentinelTime(hhmmFromDate(dueWallClock))) {
      var nowWallClock = App.core.timezone.toWallClock(now);
      return wallClockDayValue(dueWallClock) < wallClockDayValue(nowWallClock);
    }
    return task.due.getTime() < now.getTime();
  }

  function isSameCalendarDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // Next-task glow badge: the single soonest upcoming task with a REAL (non-bucket) time that hasn't
  // passed yet, due TODAY. A bucket time is a placeholder, not a real commitment, so bucket-only tasks
  // never qualify, by design. A task due tomorrow or later, however soon, is never shown here even if
  // it's the only upcoming task.
  function pickNextTask(tasks, now) {
    now = now || new Date();
    var candidates = (tasks || []).filter(function (task) {
      if (task.status === 'Completed' || !task.due) return false;
      if (task.due.getTime() <= now.getTime()) return false;
      var dueWallClock = App.core.timezone.toWallClock(task.due);
      var nowWallClock = App.core.timezone.toWallClock(now);
      if (!isSameCalendarDay(dueWallClock, nowWallClock)) return false;
      return !App.tasks.timeBuckets.isSentinelTime(hhmmFromDate(dueWallClock));
    });
    if (candidates.length === 0) return null;
    return candidates.reduce(function (soonest, task) {
      return task.due.getTime() < soonest.due.getTime() ? task : soonest;
    });
  }

  // Reuses App.ui.datePicker's own preset/label logic (Today/Tomorrow/etc.) instead of inventing a
  // second date-formatting convention. Split into date/time halves for App.tasks.taskViews's dueDate/
  // dueTime filter/sort properties — same underlying computation, shared here instead of duplicated.
  function getDueDateLabel(due) {
    if (!due) return '';
    var wallClock = App.core.timezone.toWallClock(due);
    var dateInfo = App.ui.datePicker.modeFromDate(wallClock, App.core.timezone.now());
    return App.ui.datePicker.label(dateInfo.mode, dateInfo.date);
  }

  // Delegates to App.tasks.taskViews.getDueTimeText — the same bucket-label-or-"HH:mm" text is also
  // what the filter/sort bar filters/sorts Due time by, so the row display and the filter value can
  // never drift into two independently-maintained copies.
  function getDueTimeLabel(due) {
    if (!due) return '';
    return App.tasks.taskViews.getDueTimeText({ due: due });
  }

  function formatDueLabel(due) {
    if (!due) return '';
    var dateLabel = getDueDateLabel(due);
    if (!dateLabel) return '';
    return dateLabel + ' · ' + getDueTimeLabel(due);
  }

  function allCompleted(tasks) {
    return !!tasks && tasks.length > 0 && tasks.every(function (task) {
      return task.status === 'Completed';
    });
  }

  function formatCountdown(due, now) {
    now = now || new Date();
    var ms = due.getTime() - now.getTime();
    var minutes = Math.round(ms / 60000);
    if (minutes <= 0) return 'due now';
    if (minutes < 60) return 'in ' + minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var remMinutes = minutes % 60;
    return remMinutes === 0 ? 'in ' + hours + 'h' : 'in ' + hours + 'h ' + remMinutes + 'm';
  }

  // Mounts the persistent glow badge. update(tasks) is called by the owner (App.ui.fullScreen) on every
  // task-list refresh; a separate internal timer re-renders on its own so the "in N minutes" countdown
  // keeps ticking between refreshes, not just when the task list itself changes. Hidden entirely (no
  // empty-state) when there's no qualifying task.
  function createBadge(container) {
    var el = document.createElement('div');
    el.className = 'crmtm-indicator-badge';
    el.style.display = 'none';
    container.appendChild(el);

    var currentTasks = [];

    function renderNow() {
      var next = pickNextTask(currentTasks, new Date());
      if (!next) {
        el.style.display = 'none';
        el.textContent = '';
        return;
      }
      el.style.display = '';
      el.textContent = 'Next: ' + (next.title || '(untitled)') + ' — ' + formatCountdown(next.due, new Date());
    }

    var timer = setInterval(renderNow, 30000);

    return {
      update: function (tasks) {
        currentTasks = tasks || [];
        renderNow();
      },
      destroy: function () {
        clearInterval(timer);
      },
    };
  }

  return {
    getTagColor: getTagColor,
    isOverdue: isOverdue,
    pickNextTask: pickNextTask,
    allCompleted: allCompleted,
    formatCountdown: formatCountdown,
    formatDueLabel: formatDueLabel,
    getDueDateLabel: getDueDateLabel,
    getDueTimeLabel: getDueTimeLabel,
    createBadge: createBadge,
  };
})();
