// requires: App.core (namespace), App.core.settings
'use strict';
// Every date/time this app shows or writes (due dates, "today"/"tomorrow" boundaries, time-of-day
// buckets) is meant in the owner's configured Settings-panel timezone, regardless of which timezone the
// browser happens to be in. This module is the one place that gap is bridged, using the `Intl` API
// (DST-table-aware, no hardcoded offset to keep up to date) against a configurable IANA zone string
// instead of a fixed offset or a hardcoded zone (the predecessor project hardcoded 'Europe/Prague' and
// flagged making it configurable as wanted-but-never-done — done here from the start).
App.core.timezone = (function () {
  function zone() {
    return App.core.settings.load().timezone || 'UTC';
  }

  // formatToParts avoids any locale-string-parsing ambiguity (e.g. en-US "M/D/YYYY" round-tripped
  // through `new Date(string)`, which is not reliably parseable across engines).
  function getParts(instant, timeZone) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    var map = {};
    dtf.formatToParts(instant).forEach(function (p) {
      if (p.type !== 'literal') map[p.type] = p.value;
    });
    // Some engines format midnight as hour "24" under hour12:false.
    var hour = parseInt(map.hour, 10);
    if (hour === 24) hour = 0;
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10) - 1,
      day: parseInt(map.day, 10),
      hour: hour,
      minute: parseInt(map.minute, 10),
      second: parseInt(map.second, 10),
    };
  }

  // The configured zone's current UTC offset in minutes at a given real instant — recomputed per-call
  // rather than assumed, since it can change across a DST transition.
  function offsetMinutesAt(instant) {
    var p = getParts(instant, zone());
    var asUTC = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - instant.getTime()) / 60000);
  }

  // Real absolute instant -> a "fake local" Date whose *local* getters (getFullYear/getMonth/getDate/
  // getHours/getMinutes/...) read as the configured zone's wall-clock at that instant. This intentionally
  // does NOT produce a Date whose .getTime() is meaningful (it's browser-local ms, not a real UTC
  // instant) — it exists only so calendar/time-of-day math elsewhere in this app can keep using plain
  // Date getters, just against the configured zone instead of the browser's. Never call .toISOString()
  // or compare .getTime() against a real instant on the result — use fromWallClock for that direction.
  function toWallClock(instant) {
    var p = getParts(instant, zone());
    return new Date(p.year, p.month, p.day, p.hour, p.minute, p.second, instant.getMilliseconds());
  }

  // Sugar for "the configured zone's wall-clock right now" — the fake-local equivalent of `new Date()`.
  function now() {
    return toWallClock(new Date());
  }

  // Inverse of toWallClock/now: given a "fake local" Date whose components represent the configured
  // zone's wall-clock (as built by `new Date(y, m, d, hh, mm)` or handed back by now()/toWallClock()),
  // returns the real Date those components actually occur at. Two-pass so a date landing right on a DST
  // transition boundary still resolves against the correct side of it, not the side implied by a first
  // guess.
  function fromWallClock(fakeLocalDate) {
    var y = fakeLocalDate.getFullYear();
    var mo = fakeLocalDate.getMonth();
    var d = fakeLocalDate.getDate();
    var hh = fakeLocalDate.getHours();
    var mm = fakeLocalDate.getMinutes();
    var ss = fakeLocalDate.getSeconds();
    var ms = fakeLocalDate.getMilliseconds();
    var guessMs = Date.UTC(y, mo, d, hh, mm, ss, ms);
    var offset = offsetMinutesAt(new Date(guessMs));
    var realMs = guessMs - offset * 60000;
    var offset2 = offsetMinutesAt(new Date(realMs));
    if (offset2 !== offset) realMs = guessMs - offset2 * 60000;
    return new Date(realMs);
  }

  return {
    now: now,
    toWallClock: toWallClock,
    fromWallClock: fromWallClock,
    offsetMinutesAt: offsetMinutesAt,
  };
})();
