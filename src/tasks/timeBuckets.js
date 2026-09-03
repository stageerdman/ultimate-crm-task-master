// requires: App.core.settings
'use strict';
App.tasks = App.tasks || {};
// Named time-of-day buckets (Morning/Afternoon/Evening/All day) the date/time pickers offer as input
// shortcuts. Ported near-verbatim from the predecessor's timeResolution.js — that module already dealt
// purely in bucket<->"HH:mm" strings (configurable via Settings, see App.core.settings' reservedTimes
// default) rather than encoding anything into a fake timestamp; the only thing that drops here is
// nothing at all, since Notion's Due Date property stores a real datetime directly (ROADMAP.md Step 1).
App.tasks.timeBuckets = (function () {
  var BUCKETS = ['morning', 'afternoon', 'evening', 'allday'];

  function getReservedTimes() {
    return App.core.settings.load().reservedTimes;
  }

  function bucketTime(bucket) {
    var reserved = getReservedTimes();
    return reserved[bucket] || null;
  }

  function getBucketForTime(hhmm) {
    var reserved = getReservedTimes();
    for (var i = 0; i < BUCKETS.length; i++) {
      if (reserved[BUCKETS[i]] === hhmm) return BUCKETS[i];
    }
    return null;
  }

  function isSentinelTime(hhmm) {
    return getBucketForTime(hhmm) !== null;
  }

  function addDays(date, days) {
    var result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + days);
    return result;
  }

  // Hours before 6 AM are treated as a continuation of the prior evening — an assumption, not spec'd,
  // ported as-is from the predecessor.
  function getCurrentPeriod(now) {
    var hour = now.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 15) return 'afternoon';
    return 'evening';
  }

  // Pure function. `rule` is 'smart_next' (dispatches on time-of-day) or 'smart_next_day' (always
  // all-day bucket tomorrow) — used by workflow steps that want "the next reasonable slot" rather than
  // a fixed time.
  function resolveSmartTime(now, rule) {
    if (rule === 'smart_next_day') {
      return { date: addDays(now, 1), timeValue: bucketTime('allday') };
    }
    if (rule !== 'smart_next') {
      throw new Error('App.tasks.timeBuckets: unknown smart time rule "' + rule + '"');
    }
    var period = getCurrentPeriod(now);
    if (period === 'morning') {
      return { date: addDays(now, 0), timeValue: bucketTime('afternoon') };
    }
    if (period === 'afternoon') {
      return { date: addDays(now, 0), timeValue: bucketTime('evening') };
    }
    return { date: addDays(now, 1), timeValue: bucketTime('morning') };
  }

  return {
    bucketTime: bucketTime,
    getBucketForTime: getBucketForTime,
    isSentinelTime: isSentinelTime,
    getCurrentPeriod: getCurrentPeriod,
    resolveSmartTime: resolveSmartTime,
  };
})();
