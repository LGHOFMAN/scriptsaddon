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

function injectScript(tabId, script) {
  browser.tabs.executeScript(tabId, {
    code: script.code,
    runAt: runAtToApiValue(script.runAt)
  }).catch(function (err) {
    console.warn('[ScriptsAddon] Injection failed for', script.name, err);
  });
}

function handleTabUpdate(tabId, changeInfo, tab) {
  var url = tab.url || '';
  if (!url || url.startsWith('about:') || url.startsWith('moz-extension:') || url.startsWith('chrome:')) return;

  var status = changeInfo.status;
  if (status !== 'loading' && status !== 'complete') return;

  scriptCache.forEach(function (script) {
    if (!UrlMatcher.scriptMatchesUrl(script, url)) return;

    var runAt = script.runAt || 'document-idle';
    var shouldRunNow = false;

    if (status === 'loading') {
      shouldRunNow = (runAt === 'document-start');
    } else if (status === 'complete') {
      shouldRunNow = (runAt === 'document-end' || runAt === 'document-idle');
    }

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
});

loadScripts().then(function () {
  console.log('[ScriptsAddon] Loaded', scriptCache.length, 'scripts');
});
