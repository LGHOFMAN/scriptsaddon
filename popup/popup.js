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

      var toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!script.enabled;
      var slider = document.createElement('span');
      slider.className = 'slider';
      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(slider);

      var scriptInfo = document.createElement('div');
      scriptInfo.className = 'script-info';
      var scriptName = document.createElement('div');
      scriptName.className = 'script-name';
      scriptName.textContent = script.name;
      var scriptMeta = document.createElement('div');
      scriptMeta.className = 'script-meta';
      scriptMeta.textContent = matchSummary;
      scriptInfo.appendChild(scriptName);
      scriptInfo.appendChild(scriptMeta);

      var editBtn = document.createElement('button');
      editBtn.className = 'btn-icon edit-btn';
      editBtn.textContent = 'Edit';
      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon delete delete-btn';
      deleteBtn.textContent = 'Del';

      li.appendChild(toggleLabel);
      li.appendChild(scriptInfo);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);

      checkbox.addEventListener('change', function () {
        var enabled = checkbox.checked;
        li.classList.toggle('disabled', !enabled);
        browser.runtime.sendMessage({ type: 'TOGGLE_SCRIPT', id: script.id, enabled: enabled });
      });

      editBtn.addEventListener('click', function () {
        openEditor(script.id);
      });

      deleteBtn.addEventListener('click', function () {
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

  browser.storage.onChanged.addListener(function (changes) {
    if (changes.userscripts) loadScripts();
  });

  loadScripts();
})();
