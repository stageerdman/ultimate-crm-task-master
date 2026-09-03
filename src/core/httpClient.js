// requires: App.core (namespace), App.core.log
'use strict';
App.core.httpClient = (function () {
  var BASE_URL = 'https://api.notion.com/v1';
  var NOTION_VERSION = '2025-09-03';
  // Notion documents ~3 req/s average per integration with some undocumented burst allowance
  // (developers.notion.com/reference/request-limits). Kept conservative on purpose — this is a
  // single-user tool, not a bulk importer, so there's no reason to chase the burst ceiling.
  var BURST_LIMIT = 3;
  var BURST_WINDOW_MS = 1000;
  var POLL_DELAY_MS = 100;
  var REQUEST_TIMEOUT_MS = 20000;

  var apiToken = null;
  var queue = [];
  var sentTimestamps = [];
  var processing = false;

  function configure(token) {
    apiToken = token;
  }

  function canSendNow() {
    var cutoff = Date.now() - BURST_WINDOW_MS;
    sentTimestamps = sentTimestamps.filter(function (t) {
      return t > cutoff;
    });
    return sentTimestamps.length < BURST_LIMIT;
  }

  function processQueue() {
    if (processing) return;
    processing = true;
    step();

    function step() {
      if (queue.length === 0) {
        processing = false;
        return;
      }
      if (!canSendNow()) {
        setTimeout(step, POLL_DELAY_MS);
        return;
      }
      var job = queue.shift();
      sentTimestamps.push(Date.now());
      sendNow(job.method, job.path, job.body, job.attempt).then(job.resolve, job.reject).then(step);
    }
  }

  function parseRetryAfterSeconds(responseHeaders) {
    if (!responseHeaders) return null;
    var match = /retry-after:\s*(\d+)/i.exec(responseHeaders);
    return match ? parseInt(match[1], 10) : null;
  }

  function sendNow(method, path, body, attempt) {
    return new Promise(function (resolve, reject) {
      if (!apiToken) {
        reject(new Error('App.core.httpClient: Notion API token not configured. Call configure(token) first.'));
        return;
      }
      GM_xmlhttpRequest({
        method: method,
        url: BASE_URL + path,
        // A hung GM_xmlhttpRequest call with no timeout can leave this promise permanently unsettled,
        // which wedges the whole queue (processQueue's step() only advances once the in-flight job's
        // promise settles). Always set an explicit timeout so a hang fails like any other error instead
        // of silently stalling every future request behind it.
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Authorization: 'Bearer ' + apiToken,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        data: body ? JSON.stringify(body) : undefined,
        ontimeout: function () {
          reject(
            new Error('App.core.httpClient: ' + method + ' ' + path + ' timed out after ' + REQUEST_TIMEOUT_MS + 'ms')
          );
        },
        onload: function (response) {
          if (response.status >= 200 && response.status < 300) {
            if (!response.responseText) {
              resolve(null);
              return;
            }
            try {
              resolve(JSON.parse(response.responseText));
            } catch (parseError) {
              reject(
                new Error('App.core.httpClient: failed to parse response JSON for ' + path + ': ' + parseError.message)
              );
            }
            return;
          }
          if (response.status === 429 && attempt < 3) {
            var retryAfterSeconds = parseRetryAfterSeconds(response.responseHeaders);
            var delayMs = retryAfterSeconds ? retryAfterSeconds * 1000 : 1000 * (attempt + 1);
            App.core.log('Rate limited on', path, '- retrying in', delayMs, 'ms, attempt', attempt + 1);
            setTimeout(function () {
              enqueue(method, path, body, attempt + 1).then(resolve, reject);
            }, delayMs);
            return;
          }
          reject(
            new Error(
              'App.core.httpClient: ' + method + ' ' + path + ' failed with status ' + response.status + ': ' + response.responseText
            )
          );
        },
        onerror: function (error) {
          reject(new Error('App.core.httpClient: network error on ' + method + ' ' + path + ': ' + JSON.stringify(error)));
        },
      });
    });
  }

  function enqueue(method, path, body, attempt) {
    attempt = attempt || 0;
    return new Promise(function (resolve, reject) {
      queue.push({ method: method, path: path, body: body, attempt: attempt, resolve: resolve, reject: reject });
      processQueue();
    });
  }

  // Generic escape hatch — every named method on App.core.notionClient is a thin wrapper around this,
  // so all of them share the same queue/rate-limit/retry/timeout handling.
  function request(method, path, body) {
    return enqueue(method, path, body);
  }

  return {
    configure: configure,
    request: request,
  };
})();
