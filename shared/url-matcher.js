var UrlMatcher = (function () {

  function escapeRegexExceptWildcards(str) {
    return str.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&');
  }

  // Matches Tampermonkey @match patterns: <scheme>://<host>/<path>
  function matchPattern(pattern, url) {
    if (pattern === '<all_urls>') return true;

    var m = pattern.match(/^(\*|https?|ftp|file):\/\/(\*|(?:\*\.)?[^/]*)(\/.*)?$/);
    if (!m) return false;

    var scheme = m[1];
    var host = m[2];
    var path = m[3] || '/';

    var parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return false;
    }

    // scheme check
    if (scheme !== '*' && parsedUrl.protocol !== scheme + ':') return false;

    // host check
    if (host !== '*') {
      if (host.startsWith('*.')) {
        var baseDomain = host.slice(2);
        if (parsedUrl.hostname !== baseDomain &&
            !parsedUrl.hostname.endsWith('.' + baseDomain)) return false;
      } else {
        if (parsedUrl.hostname !== host) return false;
      }
    }

    // path check
    var pathRegex = new RegExp('^' + escapeRegexExceptWildcards(path).replace(/\*/g, '.*') + '$');
    var urlPath = parsedUrl.pathname + (parsedUrl.search || '') + (parsedUrl.hash || '');
    if (!pathRegex.test(urlPath)) return false;

    return true;
  }

  // Matches @include / @exclude glob or regex patterns
  function matchGlob(pattern, url) {
    if (!pattern) return false;

    // If wrapped in slashes, treat as regex
    if (pattern.charAt(0) === '/' && pattern.lastIndexOf('/') > 0) {
      var lastSlash = pattern.lastIndexOf('/');
      var regexBody = pattern.slice(1, lastSlash);
      var flags = pattern.slice(lastSlash + 1);
      try {
        var re = new RegExp(regexBody, flags);
        return re.test(url);
      } catch (e) {
        return false;
      }
    }

    // Glob: * matches anything, ? matches one char
    var escaped = escapeRegexExceptWildcards(pattern)
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    try {
      var globRe = new RegExp('^' + escaped + '$');
      return globRe.test(url);
    } catch (e) {
      return false;
    }
  }

  function scriptMatchesUrl(script, url) {
    if (!script.enabled) return false;

    // Exclusions take priority
    if (script.excludes && script.excludes.some(function (p) { return matchGlob(p, url); })) {
      return false;
    }

    var matchHit = script.matches && script.matches.some(function (p) { return matchPattern(p, url); });
    var includeHit = script.includes && script.includes.some(function (p) { return matchGlob(p, url); });

    return matchHit || includeHit;
  }

  return {
    matchPattern: matchPattern,
    matchGlob: matchGlob,
    scriptMatchesUrl: scriptMatchesUrl
  };
})();
