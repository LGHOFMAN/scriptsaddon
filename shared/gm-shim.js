var GmShim = (function () {

  function stripHeader(code) {
    return code.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
  }

  function hasGrant(grants, name) {
    if (!grants || grants.length === 0) return false;
    if (grants.some(function (g) { return String(g).toLowerCase() === 'none'; })) return false;
    return grants.some(function (g) { return g === name; });
  }

  function needsGmApis(grants) {
    if (!grants || grants.length === 0) return false;
    if (grants.some(function (g) { return String(g).toLowerCase() === 'none'; })) return false;
    return hasGrant(grants, 'GM_setValue') ||
      hasGrant(grants, 'GM_getValue') ||
      hasGrant(grants, 'GM_xmlhttpRequest');
  }

  function buildInjectionCode(scriptId, grants, connects, userCode, gmStore) {
    var body = stripHeader(userCode);
    if (!needsGmApis(grants)) {
      return body;
    }

    var parts = [];
    parts.push('(function(){');
    parts.push('"use strict";');
    parts.push('var __scriptId=' + JSON.stringify(scriptId) + ';');

    if (hasGrant(grants, 'GM_setValue') || hasGrant(grants, 'GM_getValue')) {
      parts.push('var __gmStore=' + JSON.stringify(gmStore || {}) + ';');
    }

    if (hasGrant(grants, 'GM_getValue')) {
      parts.push(
        'function GM_getValue(key,defaultValue){',
        '  if(Object.prototype.hasOwnProperty.call(__gmStore,key)) return __gmStore[key];',
        '  return defaultValue;',
        '}'
      );
    }

    if (hasGrant(grants, 'GM_setValue')) {
      parts.push(
        'function GM_setValue(key,value){',
        '  __gmStore[key]=value;',
        '  try{browser.runtime.sendMessage({type:"GM_SET_VALUE",scriptId:__scriptId,key:key,value:value});}catch(e){console.warn("[ScriptsAddon] GM_setValue failed",e);}',
        '}'
      );
    }

    if (hasGrant(grants, 'GM_xmlhttpRequest')) {
      parts.push(
        'function GM_xmlhttpRequest(details){',
        '  if(!details||!details.url){if(details&&details.onerror)details.onerror({error:"Missing url"});return;}',
        '  browser.runtime.sendMessage({',
        '    type:"GM_XHR",',
        '    scriptId:__scriptId,',
        '    url:details.url,',
        '    method:(details.method||"GET").toUpperCase(),',
        '    headers:details.headers||{},',
        '    data:details.data,',
        '    timeout:details.timeout||0',
        '  }).then(function(res){',
        '    if(!res){if(details.onerror)details.onerror({error:"No response"});return;}',
        '    if(res.error){',
        '      if(res.error==="timeout"&&details.ontimeout)details.ontimeout();',
        '      else if(details.onerror)details.onerror(res);',
        '      return;',
        '    }',
        '    if(details.onload)details.onload(res);',
        '  }).catch(function(e){',
        '    if(details.onerror)details.onerror({error:e.message||String(e)});',
        '  });',
        '}'
      );
    }

    parts.push(body);
    parts.push('})();');
    return parts.join('\n');
  }

  return {
    buildInjectionCode: buildInjectionCode,
    needsGmApis: needsGmApis
  };
})();
