var scriptCache = [];

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function loadScripts() {
  return browser.storage.local.get('userscripts').then(function (result) {
    scriptCache = result.userscripts || [];
  });
}

function saveScripts() {
  return browser.storage.local.set({ userscripts: scriptCache });
}

function runAtToApiValue(runAt) {
  var map = {
    'document-start': 'document_start',
    'document-end': 'document_end',
    'document-idle': 'document_idle'
  };
  return map[runAt] || 'document_idle';
}

function gmStorageKey(scriptId, key) {
  return 'gm:' + scriptId + ':' + key;
}

function getGmValues(scriptId) {
  return browser.storage.local.get(null).then(function (all) {
    var prefix = 'gm:' + scriptId + ':';
    var store = {};
    Object.keys(all).forEach(function (k) {
      if (k.indexOf(prefix) === 0) {
        store[k.slice(prefix.length)] = all[k];
      }
    });
    return store;
  });
}

function getScriptConnects(scriptId) {
  var script = scriptCache.find(function (s) { return s.id === scriptId; });
  if (!script) return [];
  if (script.connects && script.connects.length) return script.connects;
  var meta = MetadataParser.parseMetadata(script.code);
  return meta ? (meta.connects || []) : [];
}

function hostnameMatchesConnect(hostname, pattern) {
  pattern = String(pattern).toLowerCase();
  hostname = String(hostname).toLowerCase();
  if (pattern === '*') return true;
  if (pattern.indexOf('*.') === 0) {
    var base = pattern.slice(2);
    return hostname === base || hostname.endsWith('.' + base);
  }
  return hostname === pattern;
}

function isConnectAllowed(connects, url) {
  if (!connects || connects.length === 0) return true;
  var hostname;
  try {
    hostname = new URL(url).hostname;
  } catch (e) {
    return false;
  }
  return connects.some(function (p) {
    return hostnameMatchesConnect(hostname, p);
  });
}

function headersToString(headers) {
  var lines = [];
  headers.forEach(function (value, name) {
    lines.push(name + ': ' + value);
  });
  return lines.join('\r\n');
}

function performGmXhr(msg) {
  var connects = getScriptConnects(msg.scriptId);
  if (!isConnectAllowed(connects, msg.url)) {
    return Promise.resolve({
      error: 'Host not allowed by @connect. Add "' + new URL(msg.url).hostname + '" to your script metadata.'
    });
  }

  var timeoutMs = msg.timeout > 0 ? msg.timeout : 60000;
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

  var fetchOpts = {
    method: msg.method || 'GET',
    headers: msg.headers || {},
    credentials: 'omit'
  };
  if (controller) fetchOpts.signal = controller.signal;
  if (msg.data !== undefined && msg.data !== null && fetchOpts.method !== 'GET' && fetchOpts.method !== 'HEAD') {
    fetchOpts.body = msg.data;
  }

  return fetch(msg.url, fetchOpts).then(function (res) {
    if (timer) clearTimeout(timer);
    return res.text().then(function (text) {
      return {
        status: res.status,
        statusText: res.statusText,
        responseHeaders: headersToString(res.headers),
        responseText: text,
        finalUrl: res.url
      };
    });
  }).catch(function (err) {
    if (timer) clearTimeout(timer);
    if (err && err.name === 'AbortError') {
      return { error: 'timeout' };
    }
    return { error: err.message || String(err) };
  });
}

function buildInjectionCode(script) {
  var meta = MetadataParser.parseMetadata(script.code);
  var grants = script.grants || (meta ? meta.grants : []) || [];
  var connects = script.connects || (meta ? meta.connects : []) || [];

  if (!GmShim.needsGmApis(grants)) {
    return Promise.resolve(GmShim.buildInjectionCode(script.id, grants, connects, script.code, {}));
  }

  return getGmValues(script.id).then(function (store) {
    return GmShim.buildInjectionCode(script.id, grants, connects, script.code, store);
  });
}

function injectScript(tabId, script) {
  var delay = script.delay || 0;
  console.log('[ScriptsAddon] Injecting "' + script.name + '" into tab', tabId,
    '(runAt:', script.runAt + ', allFrames:', !!script.allFrames + ', delay:', delay + 'ms)');

  function doInject() {
    buildInjectionCode(script).then(function (code) {
      return browser.tabs.executeScript(tabId, {
        code: code,
        runAt: runAtToApiValue(script.runAt),
        allFrames: !!script.allFrames
      });
    }).then(function () {
      console.log('[ScriptsAddon] Injected "' + script.name + '" successfully');
    }).catch(function (err) {
      console.warn('[ScriptsAddon] Injection FAILED for "' + script.name + '":', err.message || err);
    });
  }

  if (delay > 0) {
    setTimeout(doInject, delay);
  } else {
    doInject();
  }
}

function handleTabUpdate(tabId, changeInfo, tab) {
  var url = tab.url || '';
  if (!url || url.startsWith('about:') || url.startsWith('moz-extension:') || url.startsWith('chrome:')) return;

  var status = changeInfo.status;
  if (status !== 'loading' && status !== 'complete') return;

  console.log('[ScriptsAddon] Tab update — status:', status, 'url:', url, '| scripts in cache:', scriptCache.length);

  scriptCache.forEach(function (script) {
    if (!script.enabled) return;
    var matches = UrlMatcher.scriptMatchesUrl(script, url);
    console.log('[ScriptsAddon]  script "' + script.name + '" enabled=' + script.enabled + ' matches=' + matches);
    if (!matches) return;

    var runAt = script.runAt || 'document-idle';
    var shouldRunNow = false;

    if (status === 'loading') {
      shouldRunNow = (runAt === 'document-start');
    } else if (status === 'complete') {
      shouldRunNow = (runAt === 'document-end' || runAt === 'document-idle');
    }

    console.log('[ScriptsAddon]  → shouldRunNow=' + shouldRunNow + ' (runAt=' + runAt + ', status=' + status + ')');

    if (shouldRunNow) {
      injectScript(tabId, script);
    }
  });
}

browser.tabs.onUpdated.addListener(handleTabUpdate);

browser.storage.onChanged.addListener(function (changes) {
  if (changes.userscripts) {
    scriptCache = changes.userscripts.newValue || [];
  }
});

browser.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === 'GET_SCRIPTS') {
    sendResponse({ scripts: scriptCache });
    return false;
  }

  if (msg.type === 'SAVE_SCRIPT') {
    var incoming = msg.script;
    if (!incoming.id) {
      incoming.id = generateId();
      incoming.createdAt = Date.now();
    }
    incoming.updatedAt = Date.now();

    var idx = scriptCache.findIndex(function (s) { return s.id === incoming.id; });
    if (idx === -1) {
      scriptCache.push(incoming);
    } else {
      scriptCache[idx] = incoming;
    }
    saveScripts().then(function () {
      sendResponse({ ok: true, id: incoming.id });
    });
    return true;
  }

  if (msg.type === 'DELETE_SCRIPT') {
    scriptCache = scriptCache.filter(function (s) { return s.id !== msg.id; });
    saveScripts().then(function () {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_SCRIPT') {
    var target = scriptCache.find(function (s) { return s.id === msg.id; });
    if (target) {
      target.enabled = msg.enabled;
      target.updatedAt = Date.now();
    }
    saveScripts().then(function () {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'GM_SET_VALUE') {
    if (!msg.scriptId || msg.key === undefined) {
      sendResponse({ ok: false, error: 'Missing scriptId or key' });
      return false;
    }
    browser.storage.local.set({ [gmStorageKey(msg.scriptId, msg.key)]: msg.value }).then(function () {
      sendResponse({ ok: true });
    }).catch(function (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    });
    return true;
  }

  if (msg.type === 'GM_GET_VALUES') {
    if (!msg.scriptId) {
      sendResponse({ ok: false, error: 'Missing scriptId' });
      return false;
    }
    getGmValues(msg.scriptId).then(function (store) {
      sendResponse({ ok: true, store: store });
    }).catch(function (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    });
    return true;
  }

  if (msg.type === 'GM_XHR') {
    performGmXhr(msg).then(function (result) {
      sendResponse(result);
    }).catch(function (err) {
      sendResponse({ error: err.message || String(err) });
    });
    return true;
  }
});

loadScripts().then(function () {
  console.log('[ScriptsAddon] Loaded', scriptCache.length, 'scripts');
});
