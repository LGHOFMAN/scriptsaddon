(function () {
  var list = document.getElementById('script-list');
  var emptyState = document.getElementById('empty-state');
  var statusText = document.getElementById('status-text');
  var btnAdd = document.getElementById('btn-add');

  function openEditor(id) {
    var url = browser.runtime.getURL('editor/editor.html');
    if (id) url += '?id=' + encodeURIComponent(id);
    browser.tabs.create({ url: url });
    window.close();
  }

  btnAdd.addEventListener('click', function () {
    openEditor(null);
  });

  function renderScripts(scripts) {
    list.innerHTML = '';
    var enabled = scripts.filter(function (s) { return s.enabled; }).length;
    statusText.textContent = scripts.length + ' script' + (scripts.length !== 1 ? 's' : '') + ', ' + enabled + ' enabled';

    if (scripts.length === 0) {
      emptyState.classList.add('visible');
      return;
    }
    emptyState.classList.remove('visible');

    scripts.forEach(function (script) {
      var li = document.createElement('li');
      li.className = 'script-item' + (script.enabled ? '' : ' disabled');
      li.dataset.id = script.id;

      var matchSummary = (script.matches || []).concat(script.includes || []).slice(0, 2).join(', ') || 'No URL patterns';

      li.innerHTML =
        '<label class="toggle">' +
          '<input type="checkbox"' + (script.enabled ? ' checked' : '') + '>' +
          '<span class="slider"></span>' +
        '</label>' +
        '<div class="script-info">' +
          '<div class="script-name">' + escHtml(script.name) + '</div>' +
          '<div class="script-meta">' + escHtml(matchSummary) + '</div>' +
        '</div>' +
        '<button class="btn-icon edit-btn">Edit</button>' +
        '<button class="btn-icon delete delete-btn">Del</button>';

      var checkbox = li.querySelector('input[type=checkbox]');
      checkbox.addEventListener('change', function () {
        var enabled = checkbox.checked;
        li.classList.toggle('disabled', !enabled);
        browser.runtime.sendMessage({ type: 'TOGGLE_SCRIPT', id: script.id, enabled: enabled });
      });

      li.querySelector('.edit-btn').addEventListener('click', function () {
        openEditor(script.id);
      });

      li.querySelector('.delete-btn').addEventListener('click', function () {
        if (!confirm('Delete "' + script.name + '"?')) return;
        browser.runtime.sendMessage({ type: 'DELETE_SCRIPT', id: script.id }).then(loadScripts);
      });

      list.appendChild(li);
    });
  }

  function loadScripts() {
    browser.runtime.sendMessage({ type: 'GET_SCRIPTS' }).then(function (resp) {
      renderScripts(resp.scripts || []);
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  browser.storage.onChanged.addListener(function (changes) {
    if (changes.userscripts) loadScripts();
  });

  loadScripts();
})();
