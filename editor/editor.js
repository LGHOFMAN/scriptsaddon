(function () {
  var codeEditor = document.getElementById('code-editor');
  var metaPreviewContent = document.getElementById('meta-preview-content');
  var pageTitle = document.getElementById('page-title');
  var btnSave = document.getElementById('btn-save');
  var btnCancel = document.getElementById('btn-cancel');
  var optAllFrames = document.getElementById('opt-all-frames');
  var optDelay = document.getElementById('opt-delay');

  var scriptId = null;
  var originalCode = '';
  var debounceTimer = null;

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function isDirty() {
    return codeEditor.value !== originalCode;
  }

  function renderMetaPreview(code) {
    var meta = MetadataParser.parseMetadata(code);
    while (metaPreviewContent.firstChild) metaPreviewContent.removeChild(metaPreviewContent.firstChild);

    if (!meta) {
      var hint = document.createElement('span');
      hint.className = 'meta-hint';
      hint.textContent = 'No metadata block found — add ';
      var codeEl = document.createElement('code');
      codeEl.textContent = '// ==UserScript== ... // ==/UserScript==';
      hint.appendChild(codeEl);
      metaPreviewContent.appendChild(hint);
      return;
    }

    // Sync UI controls from metadata directives (only when a directive is explicitly set)
    if (meta.allFrames) optAllFrames.checked = true;
    if (meta.delay > 0) optDelay.value = meta.delay;

    metaPreviewContent.appendChild(makeTag('name', meta.name));
    if (meta.version) metaPreviewContent.appendChild(makeTag('v', meta.version));
    metaPreviewContent.appendChild(makeTag('run-at', meta.runAt));
    if (meta.allFrames) metaPreviewContent.appendChild(makeTag('frames', 'all'));
    if (meta.delay > 0) metaPreviewContent.appendChild(makeTag('delay', meta.delay + 'ms'));

    if (meta.grants && meta.grants.length) {
      meta.grants.forEach(function (g) {
        metaPreviewContent.appendChild(makeTag('grant', g));
      });
    }

    if (meta.connects && meta.connects.length) {
      meta.connects.forEach(function (c) {
        metaPreviewContent.appendChild(makeTag('connect', c));
      });
    }

    var patterns = meta.matches.concat(meta.includes);
    if (patterns.length === 0) {
      metaPreviewContent.appendChild(makeErrorTag('No @match or @include patterns'));
    } else {
      patterns.slice(0, 4).forEach(function (p) {
        metaPreviewContent.appendChild(makeTag('match', p));
      });
      if (patterns.length > 4) {
        metaPreviewContent.appendChild(makeTag('…', '+' + (patterns.length - 4) + ' more'));
      }
    }
  }

  function makeTag(label, value) {
    var span = document.createElement('span');
    span.className = 'meta-tag';
    var labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = label + ':';
    span.appendChild(labelSpan);
    span.appendChild(document.createTextNode(String(value)));
    return span;
  }

  function makeErrorTag(msg) {
    var span = document.createElement('span');
    span.className = 'meta-tag error';
    span.textContent = msg;
    return span;
  }

  codeEditor.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      renderMetaPreview(codeEditor.value);
    }, 300);
  });

  // Tab key inserts spaces instead of switching focus
  codeEditor.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = codeEditor.selectionStart;
      var end = codeEditor.selectionEnd;
      codeEditor.value = codeEditor.value.slice(0, start) + '  ' + codeEditor.value.slice(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 2;
    }
  });

  btnSave.addEventListener('click', function () {
    var code = codeEditor.value.trim();
    if (!code) {
      alert('Script cannot be empty.');
      return;
    }

    var meta = MetadataParser.parseMetadata(code);
    if (!meta) {
      if (!confirm('No metadata block found. The script will never run automatically (no @match patterns). Save anyway?')) return;
      meta = { name: 'Unnamed Script', description: '', version: '1.0', matches: [], includes: [], excludes: [], grants: [], connects: [], runAt: 'document-idle' };
    }

    var script = {
      id: scriptId || null,
      name: meta.name,
      description: meta.description,
      version: meta.version,
      matches: meta.matches,
      includes: meta.includes,
      excludes: meta.excludes,
      grants: meta.grants || [],
      connects: meta.connects || [],
      runAt: meta.runAt,
      allFrames: optAllFrames.checked,
      delay: Math.max(0, parseInt(optDelay.value, 10) || 0),
      enabled: true,
      code: code
    };

    browser.runtime.sendMessage({ type: 'SAVE_SCRIPT', script: script }).then(function (resp) {
      originalCode = code;
      if (!scriptId && resp.id) {
        scriptId = resp.id;
        window.history.replaceState({}, '', '?id=' + encodeURIComponent(scriptId));
      }
      pageTitle.textContent = 'Edit Script: ' + meta.name;
      showSavedFeedback();
    });
  });

  function showSavedFeedback() {
    var orig = btnSave.textContent;
    btnSave.textContent = 'Saved!';
    btnSave.disabled = true;
    setTimeout(function () {
      btnSave.textContent = orig;
      btnSave.disabled = false;
    }, 1500);
  }

  btnCancel.addEventListener('click', function () {
    if (isDirty() && !confirm('Discard unsaved changes?')) return;
    window.close();
  });

  // Load existing script if editing
  var editId = getQueryParam('id');
  if (editId) {
    scriptId = editId;
    browser.runtime.sendMessage({ type: 'GET_SCRIPTS' }).then(function (resp) {
      var scripts = resp.scripts || [];
      var found = scripts.find(function (s) { return s.id === editId; });
      if (found) {
        codeEditor.value = found.code;
        originalCode = found.code;
        pageTitle.textContent = 'Edit Script: ' + found.name;
        optAllFrames.checked = !!found.allFrames;
        optDelay.value = found.delay || 0;
        renderMetaPreview(found.code);
      } else {
        pageTitle.textContent = 'Script not found';
      }
    });
  } else {
    var template = MetadataParser.generateDefaultTemplate();
    codeEditor.value = template;
    originalCode = template;
    renderMetaPreview(template);
  }
})();
