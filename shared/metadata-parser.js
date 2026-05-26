var MetadataParser = (function () {
  var MULTI_VALUE_KEYS = ['match', 'include', 'exclude', 'require', 'resource', 'grant', 'connect'];

  function parseMetadata(code) {
    var blockMatch = code.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
    if (!blockMatch) return null;

    var block = blockMatch[1];
    var lines = block.split('\n');
    var meta = {};

    lines.forEach(function (line) {
      var m = line.match(/^\s*\/\/\s*@([\w-]+)\s+(.*?)\s*$/);
      if (!m) return;
      var key = m[1].toLowerCase();
      var val = m[2].trim();
      if (MULTI_VALUE_KEYS.indexOf(key) !== -1) {
        if (!meta[key]) meta[key] = [];
        meta[key].push(val);
      } else {
        meta[key] = val;
      }
    });

    var runAt = (meta['run-at'] || meta['runat'] || 'document-idle').toLowerCase();
    runAt = runAt.replace(/_/g, '-');
    if (['document-start', 'document-end', 'document-idle'].indexOf(runAt) === -1) {
      runAt = 'document-idle';
    }

    var allFrames = (meta['all-frames'] || '').toLowerCase() === 'true';
    var delay = Math.max(0, parseInt(meta['delay'] || '0', 10) || 0);

    return {
      name: meta['name'] || 'Unnamed Script',
      description: meta['description'] || '',
      version: meta['version'] || '1.0',
      author: meta['author'] || '',
      namespace: meta['namespace'] || '',
      matches: meta['match'] || [],
      includes: meta['include'] || [],
      excludes: meta['exclude'] || [],
      requires: meta['require'] || [],
      grants: meta['grant'] || [],
      connects: meta['connect'] || [],
      runAt: runAt,
      allFrames: allFrames,
      delay: delay
    };
  }

  function generateDefaultTemplate() {
    return [
      '// ==UserScript==',
      '// @name        New Script',
      '// @description What this script does',
      '// @match       https://example.com/*',
      '// @version     1.0',
      '// @run-at      document-idle',
      '// ==/UserScript==',
      '',
      "(function () {",
      "  'use strict';",
      "  // Your code here",
      "})();"
    ].join('\n');
  }

  return {
    parseMetadata: parseMetadata,
    generateDefaultTemplate: generateDefaultTemplate
  };
})();
