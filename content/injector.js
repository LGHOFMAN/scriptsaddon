browser.runtime.onMessage.addListener(function (msg) {
  if (msg.type !== 'EXECUTE_SCRIPT') return;
  var s = document.createElement('script');
  s.textContent = msg.code;
  (document.head || document.documentElement).appendChild(s);
  s.remove();
});
