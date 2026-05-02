// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (
  modules,
  entry,
  mainEntry,
  parcelRequireName,
  externals,
  distDir,
  publicUrl,
  devServer
) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var importMap = previousRequire.i || {};
  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        if (externals[name]) {
          return externals[name];
        }
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        globalObject
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      if (res === false) {
        return {};
      }
      // Synthesize a module to follow re-exports.
      if (Array.isArray(res)) {
        var m = {__esModule: true};
        res.forEach(function (v) {
          var key = v[0];
          var id = v[1];
          var exp = v[2] || v[0];
          var x = newRequire(id);
          if (key === '*') {
            Object.keys(x).forEach(function (key) {
              if (
                key === 'default' ||
                key === '__esModule' ||
                Object.prototype.hasOwnProperty.call(m, key)
              ) {
                return;
              }

              Object.defineProperty(m, key, {
                enumerable: true,
                get: function () {
                  return x[key];
                },
              });
            });
          } else if (exp === '*') {
            Object.defineProperty(m, key, {
              enumerable: true,
              value: x,
            });
          } else {
            Object.defineProperty(m, key, {
              enumerable: true,
              get: function () {
                if (exp === 'default') {
                  return x.__esModule ? x.default : x;
                }
                return x[exp];
              },
            });
          }
        });
        return m;
      }
      return newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.require = nodeRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.distDir = distDir;
  newRequire.publicUrl = publicUrl;
  newRequire.devServer = devServer;
  newRequire.i = importMap;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  // Only insert newRequire.load when it is actually used.
  // The code in this file is linted against ES5, so dynamic import is not allowed.
  // INSERT_LOAD_HERE

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });
    }
  }
})({"9D6WG":[function(require,module,exports,__globalThis) {
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SERVER_PORT = 49993;
var HMR_SECURE = false;
var HMR_ENV_HASH = "439701173a9199ea";
var HMR_USE_SSE = false;
module.bundle.HMR_BUNDLE_ID = "eaf479cd494665d6";
"use strict";
/* global HMR_HOST, HMR_PORT, HMR_SERVER_PORT, HMR_ENV_HASH, HMR_SECURE, HMR_USE_SSE, chrome, browser, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: {|[string]: mixed|};
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_SERVER_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var HMR_USE_SSE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData[moduleName],
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData[moduleName] = undefined;
}
module.bundle.Module = Module;
module.bundle.hotData = {};
var checkedAssets /*: {|[string]: boolean|} */ , disposedAssets /*: {|[string]: boolean|} */ , assetsToDispose /*: Array<[ParcelRequire, string]> */ , assetsToAccept /*: Array<[ParcelRequire, string]> */ , bundleNotFound = false;
function getHostname() {
    return HMR_HOST || (typeof location !== 'undefined' && location.protocol.indexOf('http') === 0 ? location.hostname : 'localhost');
}
function getPort() {
    return HMR_PORT || (typeof location !== 'undefined' ? location.port : HMR_SERVER_PORT);
}
// eslint-disable-next-line no-redeclare
let WebSocket = globalThis.WebSocket;
if (!WebSocket && typeof module.bundle.root === 'function') try {
    // eslint-disable-next-line no-global-assign
    WebSocket = module.bundle.root('ws');
} catch  {
// ignore.
}
var hostname = getHostname();
var port = getPort();
var protocol = HMR_SECURE || typeof location !== 'undefined' && location.protocol === 'https:' && ![
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
].includes(hostname) ? 'wss' : 'ws';
// eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if (!parent || !parent.isParcelRequire) {
    // Web extension context
    var extCtx = typeof browser === 'undefined' ? typeof chrome === 'undefined' ? null : chrome : browser;
    // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes('test.js');
    }
    var ws;
    if (HMR_USE_SSE) ws = new EventSource('/__parcel_hmr');
    else try {
        // If we're running in the dev server's node runner, listen for messages on the parent port.
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) {
            parentPort.on('message', async (message)=>{
                try {
                    await handleMessage(message);
                    parentPort.postMessage('updated');
                } catch  {
                    parentPort.postMessage('restart');
                }
            });
            // After the bundle has finished running, notify the dev server that the HMR update is complete.
            queueMicrotask(()=>parentPort.postMessage('ready'));
        }
    } catch  {
        if (typeof WebSocket !== 'undefined') try {
            ws = new WebSocket(protocol + '://' + hostname + (port ? ':' + port : '') + '/');
        } catch (err) {
            // Ignore cloudflare workers error.
            if (err.message && !err.message.includes('Disallowed operation called within global scope')) console.error(err.message);
        }
    }
    if (ws) {
        // $FlowFixMe
        ws.onmessage = async function(event /*: {data: string, ...} */ ) {
            var data /*: HMRMessage */  = JSON.parse(event.data);
            await handleMessage(data);
        };
        if (ws instanceof WebSocket) {
            ws.onerror = function(e) {
                if (e.message) console.error(e.message);
            };
            ws.onclose = function() {
                console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
            };
        }
    }
}
async function handleMessage(data /*: HMRMessage */ ) {
    checkedAssets = {} /*: {|[string]: boolean|} */ ;
    disposedAssets = {} /*: {|[string]: boolean|} */ ;
    assetsToAccept = [];
    assetsToDispose = [];
    bundleNotFound = false;
    if (data.type === 'reload') fullReload();
    else if (data.type === 'update') {
        // Remove error overlay if there is one
        if (typeof document !== 'undefined') removeErrorOverlay();
        let assets = data.assets;
        // Handle HMR Update
        let handled = assets.every((asset)=>{
            return asset.type === 'css' || asset.type === 'js' && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
        });
        // Dispatch a custom event in case a bundle was not found. This might mean
        // an asset on the server changed and we should reload the page. This event
        // gives the client an opportunity to refresh without losing state
        // (e.g. via React Server Components). If e.preventDefault() is not called,
        // we will trigger a full page reload.
        if (handled && bundleNotFound && assets.some((a)=>a.envHash !== HMR_ENV_HASH) && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') handled = !window.dispatchEvent(new CustomEvent('parcelhmrreload', {
            cancelable: true
        }));
        if (handled) {
            console.clear();
            // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
            if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('parcelhmraccept'));
            await hmrApplyUpdates(assets);
            hmrDisposeQueue();
            // Run accept callbacks. This will also re-execute other disposed assets in topological order.
            let processedAssets = {};
            for(let i = 0; i < assetsToAccept.length; i++){
                let id = assetsToAccept[i][1];
                if (!processedAssets[id]) {
                    hmrAccept(assetsToAccept[i][0], id);
                    processedAssets[id] = true;
                }
            }
        } else fullReload();
    }
    if (data.type === 'error') {
        // Log parcel errors to console
        for (let ansiDiagnostic of data.diagnostics.ansi){
            let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
            console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + '\n' + stack + '\n\n' + ansiDiagnostic.hints.join('\n'));
        }
        if (typeof document !== 'undefined') {
            // Render the fancy html overlay
            removeErrorOverlay();
            var overlay = createErrorOverlay(data.diagnostics.html);
            // $FlowFixMe
            document.body.appendChild(overlay);
        }
    }
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] \u2728 Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="${protocol === 'wss' ? 'https' : 'http'}://${hostname}:${port}/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, '') : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          \u{1F6A8} ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + '</div>').join('')}
        </div>
        ${diagnostic.documentation ? `<div>\u{1F4DD} <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ''}
      </div>
    `;
    }
    errorHTML += '</div>';
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if (typeof location !== 'undefined' && 'reload' in location) location.reload();
    else if (typeof extCtx !== 'undefined' && extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
    else try {
        let { workerData, parentPort } = module.bundle.root('node:worker_threads') /*: any*/ ;
        if (workerData !== null && workerData !== void 0 && workerData.__parcel) parentPort.postMessage('restart');
    } catch (err) {
        console.error("[parcel] \u26A0\uFE0F An HMR update was not accepted. Please restart the process.");
    }
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var href = link.getAttribute('href');
    if (!href) return;
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute('href', // $FlowFixMe
    href.split('?')[0] + '?' + Date.now());
    // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout || typeof document === 'undefined') return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href /*: string */  = links[i].getAttribute('href');
            var hostname = getHostname();
            var servedFromHMRServer = hostname === 'localhost' ? new RegExp('^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):' + getPort()).test(href) : href.indexOf(hostname + ':' + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === 'js') {
        if (typeof document !== 'undefined') {
            let script = document.createElement('script');
            script.src = asset.url + '?t=' + Date.now();
            if (asset.outputFormat === 'esmodule') script.type = 'module';
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === 'function') {
            // Worker scripts
            if (asset.outputFormat === 'esmodule') return import(asset.url + '?t=' + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + '?t=' + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension fix
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3 && typeof ServiceWorkerGlobalScope != 'undefined' && global instanceof ServiceWorkerGlobalScope) {
                        extCtx.runtime.reload();
                        return;
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle /*: ParcelRequire */ , asset /*:  HMRAsset */ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === 'css') reloadCSS();
    else if (asset.type === 'js') {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
            // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        }
        // Always traverse to the parent bundle, even if we already replaced the asset in this bundle.
        // This is required in case modules are duplicated. We need to ensure all instances have the updated code.
        if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        }
        // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id];
        // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    checkedAssets = {};
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
    // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else if (a !== null) {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle /*: ParcelRequire */ , id /*: string */ , depsByBundle /*: ?{ [string]: { [string]: string } }*/ ) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) {
            bundleNotFound = true;
            return true;
        }
        return hmrAcceptCheckOne(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return null;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    if (!cached) return true;
    assetsToDispose.push([
        bundle,
        id
    ]);
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        assetsToAccept.push([
            bundle,
            id
        ]);
        return true;
    }
    return false;
}
function hmrDisposeQueue() {
    // Dispose all old assets.
    for(let i = 0; i < assetsToDispose.length; i++){
        let id = assetsToDispose[i][1];
        if (!disposedAssets[id]) {
            hmrDispose(assetsToDispose[i][0], id);
            disposedAssets[id] = true;
        }
    }
    assetsToDispose = [];
}
function hmrDispose(bundle /*: ParcelRequire */ , id /*: string */ ) {
    var cached = bundle.cache[id];
    bundle.hotData[id] = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData[id];
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData[id]);
    });
    delete bundle.cache[id];
}
function hmrAccept(bundle /*: ParcelRequire */ , id /*: string */ ) {
    // Execute the module.
    bundle(id);
    // Run the accept callbacks in the new version of the module.
    var cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
        let assetsToAlsoAccept = [];
        cached.hot._acceptCallbacks.forEach(function(cb) {
            let additionalAssets = cb(function() {
                return getParents(module.bundle.root, id);
            });
            if (Array.isArray(additionalAssets) && additionalAssets.length) assetsToAlsoAccept.push(...additionalAssets);
        });
        if (assetsToAlsoAccept.length) {
            let handled = assetsToAlsoAccept.every(function(a) {
                return hmrAcceptCheck(a[0], a[1]);
            });
            if (!handled) return fullReload();
            hmrDisposeQueue();
        }
    }
}

},{}],"68rHr":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
var _newOrderViewJs = require("./Views/newOrderView.js");
var _newOrderViewJsDefault = parcelHelpers.interopDefault(_newOrderViewJs);
var _modelJs = require("./model.js");
var _menuListViewJs = require("./Views/menuListView.js");
var _menuListViewJsDefault = parcelHelpers.interopDefault(_menuListViewJs);
var _newMenuItemViewJs = require("./Views/newMenuItemView.js");
var _newMenuItemViewJsDefault = parcelHelpers.interopDefault(_newMenuItemViewJs);
var _newOrderItemViewJs = require("./Views/newOrderItemView.js");
var _newOrderItemViewJsDefault = parcelHelpers.interopDefault(_newOrderItemViewJs);
var _orderCheckoutViewJs = require("./Views/orderCheckoutView.js");
var _orderCheckoutViewJsDefault = parcelHelpers.interopDefault(_orderCheckoutViewJs);
var _menuEditViewJs = require("./Views/menuEditView.js");
var _menuEditViewJsDefault = parcelHelpers.interopDefault(_menuEditViewJs);
var _settingsViewJs = require("./Views/settingsView.js");
var _settingsViewJsDefault = parcelHelpers.interopDefault(_settingsViewJs);
const modelState = _modelJs.state;
let item;
//adding/displaying menu list
//to add edit/delete option
const controlMenuList = async function() {
    try {
        const state = _modelJs.state;
        (0, _menuListViewJsDefault.default).render(state);
        //3.) Listen for close event to hide modal
        (0, _menuListViewJsDefault.default)._addHandlerCloseModal();
        (0, _newMenuItemViewJsDefault.default)._mapMenuCategoriesMarkUp(state.menuCategories);
    } catch (err) {
        alert(err);
    }
};
const controlDeleteMenuItem = function(id) {
    try {
        _modelJs.deleteMenuItem(id);
        (0, _menuListViewJsDefault.default).render(_modelJs.state);
    } catch (err) {
        alert(err.message);
    }
};
const controlShowEditMenu = async function(id) {
    try {
        item = _modelJs.state.menuItems.find((item)=>item._id === id);
        const categories = _modelJs.state.menuCategories;
        (0, _menuEditViewJsDefault.default)._clear();
        (0, _menuEditViewJsDefault.default)._insertEditMenuMarkup(item);
        (0, _menuEditViewJsDefault.default)._mapMenuCategoriesMarkUp(categories, item.category);
        (0, _menuEditViewJsDefault.default)._newEditCategoryToggle((name)=>{
            try {
                _modelJs.addCategory(name);
                (0, _newMenuItemViewJsDefault.default)._mapMenuCategoriesMarkUp(_modelJs.state.menuCategories);
                (0, _menuEditViewJsDefault.default)._mapMenuCategoriesMarkUp(_modelJs.state.menuCategories, name);
            } catch (err) {
                alert(err.message);
            }
        });
        (0, _menuEditViewJsDefault.default)._updateItemData((data)=>{
            if (data.category === "new-category") data.category = item.category;
            _modelJs.updateMenuItem(item._id, data);
            const modal = document.querySelector(".item-modal-overlay");
            if (!modal.classList.contains("hidden") && (0, _newOrderItemViewJsDefault.default)._basket?.id === item._id) {
                // Only update the image smoothly
                const imgEl = modal.querySelector(".item-image");
                const updatedItem = _modelJs.state.menuItems.find((i)=>i._id === item._id);
                if (imgEl) {
                    imgEl.style.transition = "opacity 0.3s ease";
                    imgEl.style.opacity = 0;
                    setTimeout(()=>{
                        imgEl.src = updatedItem.imageURL;
                        imgEl.style.opacity = 1;
                    }, 100);
                }
            }
        });
    } catch (err) {
        alert(err);
    }
};
//adding new menu category
const controlAddNewCategory = function(data) {
    modelState.menuCategories.push(data);
    (0, _newMenuItemViewJsDefault.default)._mapMenuCategoriesMarkUp(modelState.menuCategories);
};
//listening for buttons to close/open new menu item
const controlNewMenuButtonToggle = function() {
    (0, _newMenuItemViewJsDefault.default)._toggleModalClose();
    (0, _newMenuItemViewJsDefault.default)._toggleModalOpen();
};
//listens to uploadItem form button
const controlUploadItem = function(data) {
    const invalidCategories = [
        "Select category",
        "new-category"
    ];
    if (invalidCategories.includes(data.category)) {
        if (data.newCategory?.trim()) data.category = data.newCategory.trim();
        else {
            alert("Please select a valid category or enter a new one.");
            return;
        }
    }
    data.variants = (0, _newMenuItemViewJsDefault.default)._addedVariants;
    _modelJs.uploadNewMenuItem(data);
    (0, _menuListViewJsDefault.default).render(_modelJs.state);
};
//listens to new order button and renders the markup
const controlNewOrder = async function() {
    try {
        (0, _newOrderViewJsDefault.default).render(modelState);
    } catch (err) {
        alert(err);
    }
};
//finds tbe item ID & fills in data according to the ID found
const controlDisplayMenuItem = function(id) {
    const item = _modelJs.state.menuItems.find((item)=>item._id === id);
    if (!item) return;
    (0, _newOrderItemViewJsDefault.default)._itemModalContentUpdate(item);
};
const controlPushToModelCart = function() {
    if ((0, _newOrderItemViewJsDefault.default)._basket.length <= 0) throw "No item selected yet";
    (0, _newOrderItemViewJsDefault.default)._basket.quantity = (0, _newOrderItemViewJsDefault.default)._qty;
    (0, _newOrderItemViewJsDefault.default)._basket.selectedVariants = (0, _newOrderItemViewJsDefault.default)._variants;
    const basePrice = Number((0, _newOrderItemViewJsDefault.default)._basket.price);
    const variantsTotal = (0, _newOrderItemViewJsDefault.default)._basket.selectedVariants.reduce((acc, variant)=>acc + Number(variant.variantPrice), 0);
    const quantity = Number((0, _newOrderItemViewJsDefault.default)._basket.quantity);
    (0, _newOrderItemViewJsDefault.default)._basket.totalPrice = (basePrice + variantsTotal) * quantity;
    _modelJs.state.cart.push((0, _newOrderItemViewJsDefault.default)._basket);
    (0, _newOrderViewJsDefault.default).render(modelState);
};
//Listents to "checkout event" and wraps up transaction
const controlOrderCheckout = function() {
    try {
        if (_modelJs.state.cart.length === 0) throw `You must add an item to the cart`;
        const subtotal = modelState.cart.reduce((acc, item)=>acc + item.totalPrice, 0);
        _modelJs.initReceiptAdjustments();
        const adjResult = _modelJs.calculateAdjustments(subtotal, _modelJs.state.currentReceiptAdjustments);
        (0, _orderCheckoutViewJsDefault.default)._subtotal = subtotal;
        (0, _orderCheckoutViewJsDefault.default)._adjResult = adjResult;
        (0, _orderCheckoutViewJsDefault.default)._totalPrice = adjResult.finalTotal;
        (0, _orderCheckoutViewJsDefault.default).render(modelState);
    } catch (err) {
        alert(err);
    }
};
const controlConcludeTransaction = function() {
    try {
        if (modelState.cart.length <= 0) throw `Cart is empty!`;
        const sale = {
            items: [
                ...modelState.cart
            ],
            subtotal: (0, _orderCheckoutViewJsDefault.default)._subtotal ?? (0, _orderCheckoutViewJsDefault.default)._totalPrice,
            adjustments: [
                ..._modelJs.state.currentReceiptAdjustments
            ],
            totalPrice: (0, _orderCheckoutViewJsDefault.default)._totalPrice,
            customerPayment: (0, _orderCheckoutViewJsDefault.default)._customerPayment,
            customerChange: (0, _orderCheckoutViewJsDefault.default)._customerChange,
            date: Date.now()
        };
        modelState.salesBasket.push(sale);
        clearCart();
        _modelJs.clearReceiptAdjustments();
        (0, _orderCheckoutViewJsDefault.default)._showSuccess();
        setTimeout(()=>{
            (0, _orderCheckoutViewJsDefault.default)._hideModal();
            (0, _orderCheckoutViewJsDefault.default)._hideSuccess();
        }, 2000);
    } catch (err) {
        alert(err);
    }
};
const clearCart = function() {
    _modelJs.state.cart = [];
};
// ── Settings ──────────────────────────────────────────────────────────────────
const controlOpenSettings = function() {
    (0, _settingsViewJsDefault.default).renderCategories(_modelJs.state.menuCategories);
    (0, _settingsViewJsDefault.default).renderAdjustments(_modelJs.state.settings.adjustments);
    (0, _settingsViewJsDefault.default).syncShowRemovedToggle(_modelJs.state.settings.showRemovedAdjustments);
};
const _refreshCategoryDropdowns = function() {
    (0, _newMenuItemViewJsDefault.default)._mapMenuCategoriesMarkUp(_modelJs.state.menuCategories);
    if (document.querySelector(".edit-field-select")) (0, _menuEditViewJsDefault.default)._mapMenuCategoriesMarkUp(_modelJs.state.menuCategories, "");
};
const controlAddCategoryFromSettings = function(name) {
    try {
        _modelJs.addCategory(name);
        (0, _settingsViewJsDefault.default).renderCategories(_modelJs.state.menuCategories);
        _refreshCategoryDropdowns();
    } catch (err) {
        alert(err.message);
    }
};
const controlDeleteCategory = function(name) {
    const itemsInCategory = _modelJs.state.menuItems.filter((item)=>item.category === name);
    if (itemsInCategory.length > 0 && !confirm(`"${name}" has ${itemsInCategory.length} menu item(s). Delete it anyway?`)) return;
    try {
        _modelJs.deleteCategory(name);
        (0, _settingsViewJsDefault.default).renderCategories(_modelJs.state.menuCategories);
        _refreshCategoryDropdowns();
    } catch (err) {
        alert(err.message);
    }
};
const controlSaveAdjustment = function(data) {
    if (data.id) _modelJs.updateAdjustment(data.id, data);
    else _modelJs.addAdjustment(data);
    (0, _settingsViewJsDefault.default).renderAdjustments(_modelJs.state.settings.adjustments);
};
const controlEditAdjustment = function(id) {
    const adj = _modelJs.state.settings.adjustments.find((a)=>a.id === id);
    if (!adj) return;
    (0, _settingsViewJsDefault.default).showForm(adj);
};
const controlDeleteAdjustment = function(id) {
    _modelJs.deleteAdjustment(id);
    (0, _settingsViewJsDefault.default).renderAdjustments(_modelJs.state.settings.adjustments);
};
const controlToggleAdjustment = function(id) {
    _modelJs.toggleAdjustment(id);
    (0, _settingsViewJsDefault.default).renderAdjustments(_modelJs.state.settings.adjustments);
};
const controlShowRemoved = function(value) {
    _modelJs.state.settings.showRemovedAdjustments = value;
};
// ── Per-receipt adjustment controls ───────────────────────────────────────────
const _refreshCheckoutAdj = function() {
    const adjResult = _modelJs.calculateAdjustments((0, _orderCheckoutViewJsDefault.default)._subtotal, _modelJs.state.currentReceiptAdjustments);
    (0, _orderCheckoutViewJsDefault.default)._refreshAdjustments((0, _orderCheckoutViewJsDefault.default)._subtotal, _modelJs.state.currentReceiptAdjustments, adjResult, _modelJs.state.settings.showRemovedAdjustments);
};
const controlReceiptEdit = function(id) {
    const adj = _modelJs.state.currentReceiptAdjustments.find((a)=>a.id === id);
    if (!adj) return;
    (0, _orderCheckoutViewJsDefault.default)._showReceiptEditForm(adj);
};
const controlSaveReceiptOverride = function({ id, value }) {
    _modelJs.overrideReceiptAdjustment(id, value);
    _refreshCheckoutAdj();
};
const controlRemoveReceiptAdj = function(id) {
    _modelJs.removeReceiptAdjustment(id);
    _refreshCheckoutAdj();
};
const controlShowReceiptAddManualForm = function() {
    (0, _orderCheckoutViewJsDefault.default)._showReceiptAddManualForm();
};
const controlSaveManualReceiptAdj = function(data) {
    _modelJs.addManualReceiptAdjustment(data);
    _refreshCheckoutAdj();
};
// ── Cart item deletion ────────────────────────────────────────────────────────
const controlGoBackToOrder = function() {
    (0, _newOrderViewJsDefault.default).render(modelState);
};
const controlDeleteCartItemInOrder = function(index) {
    _modelJs.deleteCartItem(index);
    (0, _newOrderViewJsDefault.default).render(modelState);
};
const controlDeleteCartItemInCheckout = function(index) {
    _modelJs.deleteCartItem(index);
    if (_modelJs.state.cart.length === 0) {
        (0, _newOrderViewJsDefault.default).render(modelState);
        return;
    }
    const subtotal = _modelJs.state.cart.reduce((acc, item)=>acc + item.totalPrice, 0);
    (0, _orderCheckoutViewJsDefault.default)._subtotal = subtotal;
    const adjResult = _modelJs.calculateAdjustments(subtotal, _modelJs.state.currentReceiptAdjustments);
    (0, _orderCheckoutViewJsDefault.default)._refreshCartItems(_modelJs.state.cart);
    (0, _orderCheckoutViewJsDefault.default)._refreshAdjustments(subtotal, _modelJs.state.currentReceiptAdjustments, adjResult, _modelJs.state.settings.showRemovedAdjustments);
};
//listens to modal close button
const controlNewOrderModals = async function() {
    (0, _newOrderItemViewJsDefault.default)._closeItemModal();
    (0, _newOrderViewJsDefault.default)._addHandlerCloseModal(clearCart);
};
const init = function() {
    //MenuList
    (0, _menuListViewJsDefault.default)._addHandlerShowModal(controlMenuList);
    (0, _menuEditViewJsDefault.default)._showEditMenuForm(controlShowEditMenu);
    (0, _menuEditViewJsDefault.default)._deleteVariant();
    (0, _menuEditViewJsDefault.default)._closeModal();
    (0, _menuEditViewJsDefault.default)._deleteOption();
    (0, _menuEditViewJsDefault.default)._addVariantGroup();
    (0, _menuEditViewJsDefault.default)._addOption();
    (0, _menuEditViewJsDefault.default)._updateImagePreview();
    (0, _menuEditViewJsDefault.default)._addHandlerHasVariantsToggle();
    (0, _menuEditViewJsDefault.default)._addHandlerDeleteItem(controlDeleteMenuItem);
    //Adding New Menu
    (0, _newMenuItemViewJsDefault.default)._uploadItem(controlUploadItem);
    (0, _newMenuItemViewJsDefault.default)._newMenuCategory();
    (0, _newMenuItemViewJsDefault.default)._addHandlerAddMenuCategory(controlAddNewCategory);
    (0, _newMenuItemViewJsDefault.default)._itemVariantsToggle();
    (0, _newMenuItemViewJsDefault.default)._addVariantOption();
    controlNewMenuButtonToggle();
    // Settings
    (0, _settingsViewJsDefault.default)._addHandlerOpen(controlOpenSettings);
    (0, _settingsViewJsDefault.default)._addHandlerClose();
    (0, _settingsViewJsDefault.default)._addHandlerAddCategory(controlAddCategoryFromSettings);
    (0, _settingsViewJsDefault.default)._addHandlerDeleteCategory(controlDeleteCategory);
    (0, _settingsViewJsDefault.default)._addHandlerAdd();
    (0, _settingsViewJsDefault.default)._addHandlerSave(controlSaveAdjustment);
    (0, _settingsViewJsDefault.default)._addHandlerEdit(controlEditAdjustment);
    (0, _settingsViewJsDefault.default)._addHandlerDelete(controlDeleteAdjustment);
    (0, _settingsViewJsDefault.default)._addHandlerToggle(controlToggleAdjustment);
    (0, _settingsViewJsDefault.default)._addHandlerShowRemoved(controlShowRemoved);
    //NewOrder
    (0, _newOrderViewJsDefault.default)._addHandlerShowMenuModal(controlNewOrder);
    (0, _newOrderItemViewJsDefault.default)._addHandlerShowItemModal(controlDisplayMenuItem);
    controlNewOrderModals();
    (0, _newOrderItemViewJsDefault.default)._pushToCart(controlPushToModelCart);
    (0, _newOrderItemViewJsDefault.default)._adjustQuantity();
    (0, _newOrderViewJsDefault.default)._addHandlerDeleteCartItem(controlDeleteCartItemInOrder);
    //New Order Check Out
    (0, _orderCheckoutViewJsDefault.default)._addHandlerShowCheckout(controlOrderCheckout);
    (0, _orderCheckoutViewJsDefault.default)._addHandlerDeleteCartItem(controlDeleteCartItemInCheckout);
    (0, _orderCheckoutViewJsDefault.default)._addHandlerBack(controlGoBackToOrder);
    (0, _orderCheckoutViewJsDefault.default)._subtractChange();
    (0, _orderCheckoutViewJsDefault.default)._addHandlerPrintReceipt(controlConcludeTransaction);
    (0, _orderCheckoutViewJsDefault.default)._addHandlerReceiptEdit(controlReceiptEdit);
    (0, _orderCheckoutViewJsDefault.default)._addHandlerReceiptRemove(controlRemoveReceiptAdj);
    (0, _orderCheckoutViewJsDefault.default)._addHandlerReceiptAddManual(controlShowReceiptAddManualForm);
    (0, _orderCheckoutViewJsDefault.default)._addHandlerReceiptSaveOverride(controlSaveReceiptOverride);
    (0, _orderCheckoutViewJsDefault.default)._addHandlerReceiptSaveManual(controlSaveManualReceiptAdj);
};
init();

},{"./Views/newOrderView.js":"iKfhs","./model.js":"9pZ9h","./Views/menuListView.js":"31UH4","./Views/newMenuItemView.js":"i2y8H","./Views/newOrderItemView.js":"9mNiG","./Views/orderCheckoutView.js":"cYRuo","./Views/menuEditView.js":"3vcF1","./Views/settingsView.js":"9r3uf","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"iKfhs":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _viewJs = require("./view.js");
var _viewJsDefault = parcelHelpers.interopDefault(_viewJs);
class NewOrderView extends (0, _viewJsDefault.default) {
    _parentElement = document.querySelector(".modal-parent");
    _openBtn = document.getElementById("#newOrderBtn");
    _modalParent = document.querySelector(".new-order-parent");
    _generateMarkUp() {
        return `
    <div class="modal-overlay" id="newOrderModal">
  <div class="modal-content">
    <!-- Close Button -->
    <button class="modal-close">&times;</button>

    <!-- Left Panel: Menu Items -->
    <div class="modal-left">
      ${this._data.menuItems.length === 0 ? `<p class="no-items-msg">No items yet. Go to menu list and add a new item.</p>` : this._data.menuCategories.map((category)=>{
            const items = this._data.menuItems.filter((item)=>item.category === category && item.status !== "inactive");
            if (items.length === 0) return "";
            return `
                <div class="menu-category-header">${category}</div>
                <div class="menu-category">
                  ${items.map((item)=>{
                const unavailable = item.status === "unavailable";
                return `
                        <div class="item-card${unavailable ? " item-card--unavailable" : ""}" data-id="${item._id}">
                          <div class="btn-main">
                            <img src="${item.imageURL}" alt="${item.itemName}" />
                            <div>
                              <div class="title">${item.itemName}</div>
                              <div class="hint">\u{20B1}${item.price}</div>
                            </div>
                          </div>
                        </div>
                      `;
            }).join("")}
                </div>
              `;
        }).join("")}
    </div>

    <!-- Right Panel: Cart Summary -->
    <div class="modal-right">
      <h3 class="form-title">Cart Summary</h3>

      <div
        id="cartItems"
        style="display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow-y:auto;"
      >
        ${this._data.cart.map((item, index)=>{
            const allVariants = item.selectedVariants.map((v)=>v.variantName);
            return `
            <div class="cart-item-row">
              <div style="display:flex; flex-direction:column;">
                <span>${item.itemName} x${item.quantity}</span>
                <span style="font-size:0.85rem; opacity:0.7;">${allVariants.join(", ")}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>\u{20B1}${item.totalPrice}</span>
                <button class="cart-item-delete-btn" data-cart-index="${index}" type="button">&times;</button>
              </div>
            </div>`;
        }).join("")}
      </div>

      <div
        style="margin-top:auto; font-weight:900; font-size:1.1rem;
               display:flex; justify-content:space-between;
               padding-top:8px; border-top:1px solid var(--line);"
      >
        <span>Total:</span>
        <span>
          \u{20B1}${this._data.cart.reduce((acc, item)=>acc + item.totalPrice, 0)}
        </span>
      </div>

      <button class="btn-checkout">Checkout</button>
    </div>
  </div>
</div>
`;
    }
    _addHandlerDeleteCartItem(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            const btn = e.target.closest(".cart-item-delete-btn");
            if (!btn) return;
            handler(Number(btn.dataset.cartIndex));
        });
    }
    _addHandlerShowMenuModal(handler) {
        this._openBtn.addEventListener("click", function(e) {
            e.preventDefault();
            handler();
        });
    }
    _addHandlerCloseModal(handler) {
        this._parentElement.addEventListener("click", function(e) {
            const btn = e.target.closest(".modal-close");
            if (!btn) return;
            handler();
            document.querySelector(".modal-overlay").classList.toggle("hidden");
        });
    }
}
exports.default = new NewOrderView();

},{"./view.js":"j6ZzV","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"j6ZzV":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
class View {
    _data;
    render(data) {
        this._data = data;
        const markup = this._generateMarkUp();
        this._clear();
        this._parentElement.innerHTML = markup;
    }
    renderSpinner() {
        const spinnerMarkUp = `<div class="spinner-overlay">
  <div class="spinner">
    <div></div>
    <div></div>
    <div></div>
    <div></div>
  </div>
</div>
`;
        this._clear();
        this._parentElement.insertAdjacentHTML("afterbegin", spinnerMarkUp);
    }
    _clear() {
        this._parentElement.innerHTML = "";
    }
    _showSuccess() {
        const markup = `
    <div class="modal-overlay success-overlay">
      <div class="modal-content success-modal">
        <button class="modal-close">&times;</button>
        <div class="success-body">
          <div class="success-icon">\u{2713}</div>
          <h2 class="success-title">Success</h2>
        </div>
      </div>
    </div>
  `;
        this._parentElement.insertAdjacentHTML("beforeend", markup);
        // Close button functionality
        const overlay = this._parentElement.querySelector(".success-overlay");
        const closeBtn = overlay.querySelector(".modal-close");
        closeBtn.addEventListener("click", ()=>{
            overlay.remove(); // removes modal from DOM
        });
    }
    _hideSuccess() {
        document.querySelector(".success-overlay").classList.toggle("hidden");
    }
}
exports.default = View;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"jnFvT":[function(require,module,exports,__globalThis) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, '__esModule', {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === 'default' || key === '__esModule' || Object.prototype.hasOwnProperty.call(dest, key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}],"9pZ9h":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "state", ()=>state);
parcelHelpers.export(exports, "uploadNewMenuItem", ()=>uploadNewMenuItem);
parcelHelpers.export(exports, "deleteMenuItem", ()=>deleteMenuItem);
parcelHelpers.export(exports, "deleteCartItem", ()=>deleteCartItem);
parcelHelpers.export(exports, "updateMenuItem", ()=>updateMenuItem);
parcelHelpers.export(exports, "addCategory", ()=>addCategory);
parcelHelpers.export(exports, "deleteCategory", ()=>deleteCategory);
parcelHelpers.export(exports, "addAdjustment", ()=>addAdjustment);
parcelHelpers.export(exports, "updateAdjustment", ()=>updateAdjustment);
parcelHelpers.export(exports, "deleteAdjustment", ()=>deleteAdjustment);
parcelHelpers.export(exports, "toggleAdjustment", ()=>toggleAdjustment);
parcelHelpers.export(exports, "initReceiptAdjustments", ()=>initReceiptAdjustments);
parcelHelpers.export(exports, "overrideReceiptAdjustment", ()=>overrideReceiptAdjustment);
parcelHelpers.export(exports, "removeReceiptAdjustment", ()=>removeReceiptAdjustment);
parcelHelpers.export(exports, "addManualReceiptAdjustment", ()=>addManualReceiptAdjustment);
parcelHelpers.export(exports, "clearReceiptAdjustments", ()=>clearReceiptAdjustments);
parcelHelpers.export(exports, "calculateAdjustments", ()=>calculateAdjustments);
let counter = 0;
let adjCounter = 0;
const generateId = function() {
    counter += 1;
    return `${Date.now()}-${counter}`;
};
const generateAdjustmentId = function() {
    adjCounter += 1;
    return `adj_${Date.now()}-${adjCounter}`;
};
class Account {
    constructor(username, password){
        this.username = username;
        this.password = password;
    }
    menuItems = [];
    menuCategories = [];
    employees = [];
}
const state = {
    username: "Wowa",
    menuItems: [
        {
            itemName: "French Fries",
            price: 100,
            category: `snacks`,
            _id: `#123123`,
            imageURL: `../Icons/default image.png`,
            _stock: `0`,
            hasVariants: true,
            variants: [
                {
                    optionLabel: `Size`,
                    options: [
                        {
                            optionName: "Fries Medium",
                            optionPrice: 35
                        },
                        {
                            optionName: "Fries Large",
                            optionPrice: 45
                        },
                        {
                            optionName: "Bestie",
                            optionPrice: 60
                        }
                    ]
                },
                {
                    optionLabel: `Flavor`,
                    options: [
                        {
                            optionName: "Cheese",
                            optionPrice: 0
                        },
                        {
                            optionName: "Sour Cream",
                            optionPrice: 0
                        },
                        {
                            optionName: "BBQ",
                            optionPrice: 0
                        },
                        {
                            optionName: "Salted",
                            optionPrice: 0
                        }
                    ]
                },
                {
                    optionLabel: `Type`,
                    options: [
                        {
                            optionName: "Toasted",
                            optionPrice: 60
                        },
                        {
                            optionName: "Undercooked",
                            optionPrice: 0
                        },
                        {
                            optionName: "Well Done",
                            optionPrice: 0
                        },
                        {
                            optionName: "Not cooked",
                            optionPrice: 0
                        }
                    ]
                }
            ],
            description: `This is a sample description of the menu item. You can add more details here.`,
            status: "active"
        },
        {
            itemName: "Ice Cream",
            price: 60,
            category: `dessert`,
            _id: `#321321`,
            imageURL: `../Icons/default image.png`,
            _stock: `0`,
            hasVariants: false,
            variants: [],
            description: `This is a sample description of the menu item. You can add more details here.`,
            status: "active"
        },
        {
            itemName: "Milkshake",
            price: 79,
            category: `drinks`,
            _id: `#01112`,
            imageURL: `../Icons/default image.png`,
            _stock: `0`,
            hasVariants: true,
            variants: [
                {
                    optionLabel: `Flavors`,
                    options: [
                        {
                            optionName: "Red Velvet",
                            optionPrice: 89
                        },
                        {
                            optionName: "Strawberry",
                            optionPrice: 89
                        },
                        {
                            optionName: "Matcha",
                            optionPrice: 99
                        }
                    ]
                }
            ],
            description: `This is a sample description of the menu item. You can add more details here.`,
            status: "active"
        },
        {
            itemName: "Frappe",
            price: 150,
            category: "drinks",
            _id: "#49531",
            imageURL: `../Icons/default image.png`,
            _stock: `0`,
            hasVariants: false,
            variants: [],
            description: `This is a sample description of the menu item. You can add more details here.`,
            status: "active"
        }
    ],
    menuCategories: [
        `snacks`,
        `drinks`,
        `dessert`
    ],
    employees: [
        {
            _id: `1`,
            name: `Ben`,
            role: `Cashier`,
            systemRole: `admin`
        }
    ],
    cart: [],
    salesBasket: [],
    settings: {
        adjustments: [],
        showRemovedAdjustments: true
    },
    currentReceiptAdjustments: []
};
const createNewAccount = function(username, password) {
    const newAccount = new Account(username, password);
    allAccounts.push(newAccount);
};
const uploadNewMenuItem = async function(newItem) {
    //exrtract the data and convert into a new format object
    const item = {
        itemName: newItem.name,
        price: Number(newItem.price),
        category: newItem.category,
        _id: generateId(),
        imageURL: newItem.image && newItem.image.size > 0 ? URL.createObjectURL(newItem.image) : "../Icons/default image.png",
        _stock: `0`,
        hasVariants: newItem.variants && newItem.variants.length > 0,
        variants: newItem.variants,
        description: `This is a sample description of the menu item. You can add more details here.`,
        status: "active"
    };
    state.menuItems.push(item);
};
const deleteMenuItem = function(id) {
    const index = state.menuItems.findIndex((item)=>item._id === id);
    if (index === -1) throw new Error("Item not found");
    state.menuItems.splice(index, 1);
};
const deleteCartItem = function(index) {
    state.cart.splice(index, 1);
};
const updateMenuItem = function(id, rawData) {
    try {
        // 1️⃣ Find the existing item
        const item = state.menuItems.find((item)=>item._id === id);
        if (!item) throw new Error("Item not found");
        // 2️⃣ Normalize fields
        const hasVariants = rawData.hasVariants === "on";
        // 3️⃣ Update basic fields
        item.itemName = rawData.itemName || "";
        item.price = Number(rawData.price) || 0;
        item.category = rawData.category || "";
        item._stock = rawData.stock || "0";
        item.description = rawData.description || "";
        item.hasVariants = hasVariants;
        item.status = rawData.status?.toLowerCase() || "active";
        // 4️⃣ Update image ONLY if a new one was selected
        // rawData.image is now the actual File object
        if (rawData.image && rawData.image.size > 0) {
            // Use URL.createObjectURL for immediate preview
            item.imageURL = URL.createObjectURL(rawData.image);
            // Optionally, store the file itself if you need to upload to backend later
            item.imageFile = rawData.image;
        }
        // 5️⃣ Update variants safely
        if (hasVariants) item.variants = parseVariants(rawData);
        else item.variants = [];
    } catch (err) {
        alert(err.message);
    }
};
const addCategory = function(name) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) throw new Error("Category name cannot be empty");
    if (state.menuCategories.includes(normalized)) throw new Error("Category already exists");
    state.menuCategories.push(normalized);
};
const deleteCategory = function(name) {
    const index = state.menuCategories.indexOf(name);
    if (index === -1) throw new Error("Category not found");
    state.menuCategories.splice(index, 1);
};
const addAdjustment = function(data) {
    const adjustment = {
        id: generateAdjustmentId(),
        name: data.name,
        type: data.type,
        calculation: data.calculation,
        value: Number(data.value) || 0,
        enabled: true
    };
    state.settings.adjustments.push(adjustment);
    return adjustment;
};
const updateAdjustment = function(id, data) {
    const adj = state.settings.adjustments.find((a)=>a.id === id);
    if (!adj) throw new Error("Adjustment not found");
    adj.name = data.name;
    adj.type = data.type;
    adj.calculation = data.calculation;
    adj.value = Number(data.value) || 0;
};
const deleteAdjustment = function(id) {
    const index = state.settings.adjustments.findIndex((a)=>a.id === id);
    if (index === -1) throw new Error("Adjustment not found");
    state.settings.adjustments.splice(index, 1);
};
const toggleAdjustment = function(id) {
    const adj = state.settings.adjustments.find((a)=>a.id === id);
    if (!adj) throw new Error("Adjustment not found");
    adj.enabled = !adj.enabled;
};
const initReceiptAdjustments = function() {
    state.currentReceiptAdjustments = state.settings.adjustments.filter((a)=>a.enabled).map((a)=>({
            id: a.id,
            name: a.name,
            type: a.type,
            calculation: a.calculation,
            value: a.value,
            appliedValue: a.value,
            removed: false,
            source: "auto"
        }));
};
const overrideReceiptAdjustment = function(id, newValue) {
    const adj = state.currentReceiptAdjustments.find((a)=>a.id === id);
    if (!adj) throw new Error("Receipt adjustment not found");
    adj.appliedValue = Number(newValue) || 0;
};
const removeReceiptAdjustment = function(id) {
    const adj = state.currentReceiptAdjustments.find((a)=>a.id === id);
    if (!adj) throw new Error("Receipt adjustment not found");
    adj.removed = true;
};
const addManualReceiptAdjustment = function(data) {
    const adjustment = {
        id: generateAdjustmentId(),
        name: data.name,
        type: data.type,
        calculation: data.calculation,
        value: Number(data.value) || 0,
        appliedValue: Number(data.value) || 0,
        removed: false,
        source: "manual"
    };
    state.currentReceiptAdjustments.push(adjustment);
    return adjustment;
};
const clearReceiptAdjustments = function() {
    state.currentReceiptAdjustments = [];
};
const calculateAdjustments = function(subtotal, adjustments) {
    const active = adjustments.filter((a)=>!a.removed);
    const discounts = active.filter((a)=>a.type === "discount");
    const fees = active.filter((a)=>a.type === "fee");
    let runningTotal = subtotal;
    const lineItems = [];
    discounts.forEach((adj)=>{
        const amount = adj.calculation === "percentage" ? subtotal * (adj.appliedValue / 100) : adj.appliedValue;
        lineItems.push({
            ...adj,
            computedAmount: -amount
        });
        runningTotal -= amount;
    });
    fees.forEach((adj)=>{
        const amount = adj.calculation === "percentage" ? runningTotal * (adj.appliedValue / 100) : adj.appliedValue;
        lineItems.push({
            ...adj,
            computedAmount: amount
        });
        runningTotal += amount;
    });
    return {
        subtotal,
        lineItems,
        finalTotal: Math.max(0, runningTotal)
    };
};
function parseVariants(raw) {
    // This will temporarily store variants grouped by their index
    // Example:
    // {
    //   0: { optionLabel: "Size", options: [...] },
    //   1: { optionLabel: "Flavor", options: [...] }
    // }
    const variantMap = {};
    // Loop through every key in the flat form object
    Object.keys(raw).forEach((key)=>{
        // We use regex to detect keys that follow this pattern:
        // variants[0][optionLabel]
        // variants[0][options][1][optionName]
        // variants[1][options][2][optionPrice]
        const match = key.match(/variants\[(\d+)\]\[(optionLabel|options)\](?:\[(\d+)\]\[(optionName|optionPrice)\])?/);
        // If the key doesn't match that pattern, ignore it
        if (!match) return;
        // Extract matched values
        const variantIndex = match[1]; // e.g. "0"
        const field = match[2]; // "optionLabel" or "options"
        const optionIndex = match[3]; // e.g. "1" (if inside options)
        const optionField = match[4]; // "optionName" or "optionPrice"
        // If this variant doesn't exist yet in our map, create it
        if (!variantMap[variantIndex]) variantMap[variantIndex] = {
            optionLabel: "",
            options: []
        };
        // If we're dealing with the variant label
        // Example: variants[0][optionLabel]
        if (field === "optionLabel") variantMap[variantIndex].optionLabel = raw[key];
        // If we're inside options
        // Example: variants[0][options][1][optionName]
        if (field === "options") {
            // If this specific option doesn't exist yet, create it
            if (!variantMap[variantIndex].options[optionIndex]) variantMap[variantIndex].options[optionIndex] = {
                optionName: "",
                optionPrice: "0"
            };
            // Assign either optionName or optionPrice
            variantMap[variantIndex].options[optionIndex][optionField] = optionField === "optionPrice" ? Number(raw[key]) || 0 : raw[key];
        }
    });
    // Convert the variantMap object into an array
    // Also remove empty options (where user left blank rows)
    return Object.values(variantMap).map((variant)=>({
            ...variant,
            options: variant.options.filter((option)=>option.optionName.trim() !== "")
        }));
}

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"31UH4":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _viewJs = require("./view.js");
var _viewJsDefault = parcelHelpers.interopDefault(_viewJs);
class MenuListView extends (0, _viewJsDefault.default) {
    _parentElement = document.querySelector(".modal-parent");
    _openBtn = document.querySelector("#menu-list");
    _closeBtn = document.querySelector(".modal-close");
    _generateMarkUp() {
        return `
      <div class="modal-overlay" id="menuModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Menu</h2>
          <button class="btn primary" id="openAddModal">+ Add New Item</button>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-left">
  ${this._data.menuCategories.map((category)=>{
            const items = this._data.menuItems.filter((i)=>i.category === category);
            return `
        <div class="menu-category-header">${category}</div>
        <div class="menu-category">
          ${items.map((item)=>`
                <div class="card" data-id="${item._id}">
                  <div class="btn-main">
                    <img src="${item.imageURL}" alt="${item.itemName}" />
                    <div>
                      <div class="title">${item.itemName}</div>
                      <div class="hint">\u{20B1}${item.price}</div>
                    </div>
                  </div>
                </div>
              `).join("")}
        </div>
      `;
        }).join("")}
    </div>      
    </div>`;
    }
    _addHandlerShowModal(handler) {
        this._openBtn.addEventListener("click", function(e) {
            e.preventDefault();
            handler();
        });
    }
    _addHandlerCloseModal() {
        this._parentElement.addEventListener("click", (e)=>{
            const btn = e.target.closest(".modal-close");
            if (!btn) return;
            if (btn) {
                const modal = this._parentElement.querySelector(".modal-overlay");
                modal.classList.add("hidden");
            }
            e.preventDefault();
        });
    }
}
exports.default = new MenuListView();

},{"./view.js":"j6ZzV","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"i2y8H":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _viewJs = require("./view.js");
var _viewJsDefault = parcelHelpers.interopDefault(_viewJs);
class NewMenuItemView extends (0, _viewJsDefault.default) {
    _parentElement = document.querySelector("#addMenuModal");
    _closeBtn = this._parentElement.querySelector(".modal-close");
    _modalDiv = document.querySelector(".modal-parent");
    _formParent = this._parentElement.querySelector(".add-menu-form");
    _selectOptionsElement = document.querySelector(".select-options");
    //variants
    _variantSection = document.querySelector(".variant-btn-section");
    _variantModal = document.getElementById("addVariantModal");
    _variantCheckBoxElement = document.getElementById("hasVariantsCheckbox");
    _showVariantBtn = document.getElementById("showVariantField");
    _addVariantElement = document.querySelector(".variant-modal");
    _addVariantOptionBtn = document.querySelector(".add-variant-option");
    _variantContainer = document.querySelector(".variant-options-field");
    _addVariantBtn = document.getElementById("addVariantSet");
    _addedVariants = [];
    constructor(){
        super();
        this._addVariantSet();
        this._showVariantModal();
        this._variantModalHide();
        this._addFileUploadListener();
    }
    _toggleModalClose() {
        this._closeBtn.addEventListener("click", (e)=>{
            this._parentElement.classList.toggle("hidden");
            document.getElementById("newCategoryInput").classList.add("hidden");
            document.querySelector(".new-category-button").classList.add("hidden");
            this._formReset();
        });
    }
    _toggleModalOpen() {
        this._modalDiv.addEventListener("click", function(e) {
            e.preventDefault();
            const btn = e.target.closest("#openAddModal");
            if (!btn) return;
            document.querySelector(".modal-overlay-form").classList.toggle("hidden");
        });
    }
    _uploadItem(handler) {
        this._formParent.addEventListener("submit", (e)=>{
            e.preventDefault();
            //1.) Extract the data from fields
            const dataArr = [
                ...new FormData(this._formParent)
            ];
            const data = Object.fromEntries(dataArr);
            if (!data) return;
            handler(data);
            //2.) Refactor data to become model object
            //3.) Send data to controller
            //4.) close form modal
            //5.) Show success
            this._formReset();
        });
    }
    _formReset() {
        document.querySelectorAll(".variant-options-container-text").forEach((container)=>container.remove());
        const inputs = document.getElementById("addMenuModal").querySelectorAll("input, select, textarea");
        inputs.forEach((input)=>{
            if (input.type === "checkbox" || input.type === "radio") input.checked = false;
            else input.value = "";
        });
        this._selectOptionsElement.value = "";
        document.getElementById("addMenuModal").classList.add("hidden");
        document.querySelector(".new-category-row").classList.add("hidden");
        this._showVariantBtn.classList.add("hidden");
        this._addedVariants = [];
        const fileNameSpan = this._parentElement.querySelector(".file-upload-name");
        fileNameSpan.textContent = "No file chosen";
        fileNameSpan.style.color = "";
    }
    _newMenuCategory() {
        const row = document.querySelector(".new-category-row");
        document.querySelector(".select-options").addEventListener("change", function() {
            if (this.value === "new-category") {
                row.classList.remove("hidden");
                row.querySelector(".new-category-field").focus();
            } else row.classList.add("hidden");
        });
    }
    _addHandlerAddMenuCategory(handler) {
        const row = document.querySelector(".new-category-row");
        const field = document.getElementById("newCategoryInput");
        const submit = ()=>{
            const newCateg = field.value.trim();
            if (!newCateg) {
                alert("Please enter a category name");
                return;
            }
            handler(newCateg);
            field.value = "";
            row.classList.add("hidden");
        };
        document.querySelector(".new-category-button").addEventListener("click", submit);
        field.addEventListener("keydown", (e)=>{
            if (e.key === "Enter") {
                e.preventDefault();
                submit();
            }
        });
    }
    _mapMenuCategoriesMarkUp(data) {
        this._selectOptionsElement.innerHTML = ``;
        this._selectOptionsElement.innerHTML = `
      <option class="hidden" value="Select category" disabled selected>Select category</option>
      <option value="new-category">Add new category</option>
    `;
        const markup = data.map((i)=>`<option value="${i}">${i[0].toUpperCase() + i.slice(1)}</option>
`);
        this._selectOptionsElement.insertAdjacentHTML("afterbegin", markup);
    }
    _itemVariantsToggle() {
        this._variantCheckBoxElement.addEventListener("change", ()=>{
            if (this._variantCheckBoxElement.checked) {
                document.querySelector(".variants-section").classList.remove("hidden");
                this._showVariantBtn.classList.remove("hidden"); // ensure button is visible
            } else document.querySelector(".variants-section").classList.add("hidden");
        });
    }
    _showVariantModal() {
        this._showVariantBtn.addEventListener("click", (e)=>{
            this._addVariantElement.classList.remove("hidden");
        });
    }
    _variantModalHide() {
        this._parentElement.addEventListener("click", function(e) {
            const btn = e.target.closest(".variant-close");
            if (!btn) return;
            document.querySelector(".variant-modal").classList.add("hidden");
        });
    }
    _addVariantOption() {
        this._addVariantOptionBtn.addEventListener("click", ()=>{
            const markup = `
        <div class="variant-options-field added-fields">  <!-- gamitin yung tamang class -->
          <label>
            <input type="text" name="option-name" placeholder="e.g. Small, Medium, Large"/>
          </label>
          <label class="price-label">
            <input
              type="number"
              name="option-price"
              placeholder="\u{20B1}0.00"
              step="1"
              min="0"
            />
          </label>
        </div>
      `;
            this._variantContainer.insertAdjacentHTML("beforeend", markup);
        });
    }
    _addVariantSet() {
        this._addVariantBtn.addEventListener("click", (e)=>{
            e.preventDefault();
            e.stopImmediatePropagation();
            const optionLabel = document.querySelector('input[name="variant-name"]').value;
            if (optionLabel) {
                let allVariantRows = [];
                const optionRows = document.querySelectorAll('input[name="option-name"]');
                const options = Array.from(optionRows).map((optionInput)=>{
                    const optionRow = optionInput.closest(".variant-options-field");
                    allVariantRows.push(optionRow);
                    const priceInput = optionRow.querySelector('input[name="option-price"]');
                    return {
                        optionName: optionInput.value.trim(),
                        optionPrice: priceInput.value !== "" ? priceInput.value : "0"
                    };
                });
                this._addedVariants.push({
                    optionLabel: optionLabel,
                    options: options
                });
                // Remove previously rendered variant HTML
                document.querySelectorAll(".variant-options-container-text").forEach((el)=>el.remove());
                const variantMarkup = this._addedVariants.map((variant)=>{
                    const optionsHTML = variant.options.map((opt)=>`<div class="option-pair">
               <span class="option-name">${opt.optionName}</span>
               <span class="option-price">${opt.optionPrice}</span>
             </div>`).join("");
                    return `<div class="variant-options-container-text">
                <div class="option-label">${variant.optionLabel}</div>
                <div class="option-pairs">${optionsHTML}</div>
              </div>`;
                }).join("");
                this._variantSection.insertAdjacentHTML("afterend", variantMarkup);
                document.querySelectorAll(".added-fields").forEach((field)=>field.remove());
                this._variantModal.querySelectorAll("input").forEach((input)=>input.value = "");
                document.querySelector(".variant-modal").classList.add("hidden");
            } else alert("Please insert an option name or label");
        });
    }
    _addFileUploadListener() {
        const fileInput = this._parentElement.querySelector('input[type="file"][name="image"]');
        const fileNameSpan = this._parentElement.querySelector(".file-upload-name");
        fileInput.addEventListener("change", ()=>{
            if (fileInput.files && fileInput.files.length > 0) {
                fileNameSpan.textContent = fileInput.files[0].name;
                fileNameSpan.style.color = "green";
            } else {
                fileNameSpan.textContent = "No file chosen";
                fileNameSpan.style.color = "";
            }
        });
    }
}
exports.default = new NewMenuItemView();

},{"./view.js":"j6ZzV","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"9mNiG":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _viewJs = require("./view.js");
var _viewJsDefault = parcelHelpers.interopDefault(_viewJs);
class NewOrderItemView extends (0, _viewJsDefault.default) {
    _parentElement = document.querySelector(".modal-parent");
    _itemModal = document.querySelector(".item-modal-overlay");
    _itemModalCloseBtn = document.querySelector(".item-modal-close");
    _quantityBtn = document.querySelector(".quantity-buttons");
    _basket;
    _qty = 1;
    _variants;
    _addHandlerShowItemModal(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            e.preventDefault();
            const item = e.target.closest(".item-card");
            if (!item) return;
            handler(item.dataset.id);
            this._itemModal.classList.toggle("hidden");
        });
    }
    _itemModalContentUpdate(item) {
        const variantsSection = this._itemModal.querySelector(".variant-section");
        this._itemModal.querySelector(".title").textContent = item.itemName;
        this._itemModal.querySelector(".hint").textContent = item.category;
        this._itemModal.querySelector(".item-price").textContent = `\u{20B1}${item.price}`;
        const imgEl = this._itemModal.querySelector(".item-image");
        if (imgEl) {
            imgEl.src = item.imageURL || "../Icons/default image.png";
            imgEl.alt = item.itemName;
        }
        const itemVariants = item.hasVariants ? item.variants.map((variant)=>{
            const [...optionsArr] = variant.options;
            return `
          <div class="variant-set">
            <div class="menu-category-header">${variant.optionLabel}</div>
            <div class="variant-options">
              ${optionsArr.map((option)=>`
                  <div class="variant-chip" data-value="${option.optionName}" data-price="${option.optionPrice}">
                    ${option.optionName !== "" ? option.optionName : `Unnamed option`}
                    <span>${option.optionPrice === "0" ? "" : `\u{20B1}${option.optionPrice}`}</span>
                  </div>
                  `).join("")}
            </div>
          </div>
        `;
        }).join("") : ``;
        variantsSection.innerHTML = "";
        variantsSection.insertAdjacentHTML("afterbegin", itemVariants);
        this._selectMultipleVariantListener();
        this._basket = {
            itemName: item.itemName,
            price: item.price,
            imageURL: item.imageURL || "../Icons/default image.png",
            selectedVariants: [],
            variantsTotalPrice: "",
            category: item.category,
            id: item._id,
            date: Date.now(),
            quantity: "",
            totalPrice: "",
            customerPayment: "",
            customerChange: ""
        };
    }
    _closeItemModal() {
        this._itemModalCloseBtn.addEventListener("click", function(e) {
            document.querySelector(".item-modal-overlay").classList.toggle("hidden");
        });
    }
    _pushToCart(handler) {
        this._itemModal.addEventListener("click", (e)=>{
            e.preventDefault();
            const btn = e.target.closest("#btn-add-to-cart");
            if (btn) {
                this._findSelectedVariants();
                handler();
                document.querySelector(".item-modal-overlay").classList.toggle("hidden");
                this._qty = 1;
                document.getElementById("item-qty").textContent = this._qty;
            } else if (!btn) return;
        });
    }
    _adjustQuantity() {
        this._quantityBtn.addEventListener("click", (e)=>{
            const btn = e.target.closest(".qty-btn");
            if (!btn) return;
            if (btn.dataset.action === "increase") {
                this._qty++;
                document.getElementById("item-qty").textContent = this._qty;
            }
            if (btn.dataset.action === "decrease") {
                this._qty >= 2 ? this._qty-- : this._qty = 1;
                document.getElementById("item-qty").textContent = this._qty;
            }
        });
    }
    _selectMultipleVariantListener() {
        //1.) Listen for a click event when user clicks a variant
        document.querySelector(".variant-section").addEventListener("click", (e)=>{
            e.preventDefault();
            const chip = e.target.closest(".variant-chip");
            if (!chip) return;
            chip.classList.toggle("selected");
            e.stopImmediatePropagation();
        });
    //3.) Push all selected variants to basket
    }
    _selectSingleVariantListener() {
        document.querySelectorAll(".variant-set").forEach((set)=>{
            set.addEventListener("click", function(e) {
                const chip = e.target.closest(".variant-chip");
                if (!chip) return;
                const currentlySelected = set.querySelector(".variant-chip.selected");
                if (currentlySelected && currentlySelected !== chip) currentlySelected.classList.remove("selected");
                chip.classList.toggle("selected");
            });
        });
    }
    _findSelectedVariants() {
        this._variants = Array.from(document.querySelector(".variant-section").querySelectorAll(".variant-chip.selected")).map((el)=>{
            return {
                variantName: el.dataset.value,
                variantPrice: el.dataset.price
            };
        });
    }
}
exports.default = new NewOrderItemView();

},{"./view.js":"j6ZzV","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"cYRuo":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _viewJs = require("./view.js");
var _viewJsDefault = parcelHelpers.interopDefault(_viewJs);
class OrderCheckOutView extends (0, _viewJsDefault.default) {
    _parentElement = document.querySelector(".modal-parent");
    _subtotal;
    _adjResult;
    _totalPrice;
    _customerPayment;
    _customerChange;
    // ── Cart items markup ─────────────────────────────────────────────────────────
    _generateCartItemsMarkup(cart) {
        return cart.map((item, index)=>{
            const allVariants = item.selectedVariants.map((v)=>v.variantName);
            return `
          <div class="cart-item-row">
            <div style="display:flex; flex-direction:column;">
              <span>${item.itemName} x${item.quantity}</span>
              <span style="font-size:0.85rem; opacity:0.7;">${allVariants.join(", ")}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span>&#8369;${item.totalPrice}</span>
              <button class="checkout-cart-delete-btn" data-cart-index="${index}" type="button">&times;</button>
            </div>
          </div>`;
        }).join("");
    }
    _refreshCartItems(cart) {
        const el = this._parentElement.querySelector("#cartItems");
        if (el) el.innerHTML = this._generateCartItemsMarkup(cart);
    }
    // ── Adj section markup (reused by both initial render and in-place refresh) ──
    _generateAdjSectionMarkup(subtotal, allAdj, adjResult, showRemoved) {
        const activeLines = adjResult.lineItems;
        const removedLines = allAdj.filter((a)=>a.removed);
        const hasVisible = activeLines.length > 0 || showRemoved && removedLines.length > 0;
        const activeHtml = activeLines.map((adj)=>`
        <div class="receipt-adj-item" data-adj-id="${adj.id}">
          <div class="receipt-adj-info">
            <span>${adj.name}${adj.calculation === "percentage" ? ` (${adj.appliedValue}%)` : ""}</span>
            <span class="receipt-adj-amount ${adj.type}">
              ${adj.computedAmount >= 0 ? "+" : ""}&#8369;${adj.computedAmount.toFixed(2)}
            </span>
          </div>
          <div class="receipt-adj-controls">
            <button class="receipt-adj-edit-btn" data-adj-id="${adj.id}" type="button">Edit</button>
            <button class="receipt-adj-remove-btn" data-adj-id="${adj.id}" type="button">&times;</button>
          </div>
        </div>
      `).join("");
        const removedHtml = showRemoved ? removedLines.map((adj)=>`
          <div class="receipt-adj-item receipt-adj-item--removed">
            <div class="receipt-adj-info">
              <span>${adj.name}${adj.calculation === "percentage" ? ` (${adj.appliedValue}%)` : ""} <em>(removed)</em></span>
              <span>&#8369;0.00</span>
            </div>
          </div>
        `).join("") : "";
        return `
      ${hasVisible ? `
        <div class="cart-subtotal">
          <span>Subtotal</span>
          <span>&#8369;${subtotal.toFixed(2)}</span>
        </div>
        <div class="receipt-adj-list">
          ${activeHtml}
          ${removedHtml}
        </div>
        <div class="adj-line-divider"></div>
      ` : ""}
      <button class="receipt-add-adj-btn" type="button">+ Add adjustment</button>
    `;
    }
    // ── Main markup ───────────────────────────────────────────────────────────────
    _generateMarkUp() {
        const allAdj = this._data.currentReceiptAdjustments ?? [];
        const adjResult = this._adjResult ?? {
            lineItems: [],
            finalTotal: this._totalPrice
        };
        const showRemoved = this._data.settings?.showRemovedAdjustments ?? true;
        const subtotal = this._subtotal ?? this._totalPrice;
        return `
<div class="modal-overlay" id="newOrderModal">
  <div class="modal-content pos-modal">
    <button class="modal-close">&times;</button>
    <button class="checkout-back-btn" type="button" title="Back to order">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <h3 class="form-title">Cart Summary</h3>

    <div id="cartItems" class="cart-items">
      ${this._generateCartItemsMarkup(this._data.cart)}
    </div>

    <div class="payment-section">
      <div id="receiptAdjSection">
        ${this._generateAdjSectionMarkup(subtotal, allAdj, adjResult, showRemoved)}
      </div>

      <div class="cart-total">
        <span>Total:</span>
        <span id="cartTotal">&#8369;${this._totalPrice.toFixed(2)}</span>
      </div>

      <div class="receive-container" style="display:flex; gap:8px; align-items:center;">
        <label for="customerPayment" style="margin:0;">Payment:</label>
        <input type="number" id="customerPayment" placeholder="Enter amount received" />
        <button id="enterPaymentBtn">Enter</button>
      </div>

      <label>
        Change:
        <div id="changeAmount" class="change-box">&#8369;0.00</div>
      </label>

      <button class="print-receipt-btn hidden" id="printReceiptBtn">Print Receipt</button>
    </div>
  </div>
</div>
    `;
    }
    // ── In-place refresh (does not reset the payment input) ───────────────────────
    _refreshAdjustments(subtotal, allAdj, adjResult, showRemoved) {
        this._subtotal = subtotal;
        this._adjResult = adjResult;
        this._totalPrice = adjResult.finalTotal;
        const section = this._parentElement.querySelector("#receiptAdjSection");
        if (section) section.innerHTML = this._generateAdjSectionMarkup(subtotal, allAdj, adjResult, showRemoved);
        const totalEl = this._parentElement.querySelector("#cartTotal");
        if (totalEl) totalEl.textContent = `\u{20B1}${adjResult.finalTotal.toFixed(2)}`;
        // Total changed — reset payment validation state
        const changeBox = this._parentElement.querySelector("#changeAmount");
        if (changeBox) {
            changeBox.textContent = "\u20B10.00";
            changeBox.classList.remove("ok");
        }
        this._parentElement.querySelector(".print-receipt-btn")?.classList.add("hidden");
    }
    // ── Inline forms ──────────────────────────────────────────────────────────────
    _showReceiptEditForm(adj) {
        this._removeReceiptForms();
        const item = this._parentElement.querySelector(`.receipt-adj-item[data-adj-id="${adj.id}"]`);
        if (!item) return;
        const html = `
      <div class="receipt-edit-form" id="receiptEditForm">
        <label class="adj-form-sublabel">
          New value (${adj.calculation === "percentage" ? "%" : "&#8369;"})
        </label>
        <input type="number" id="receiptEditValue" value="${adj.appliedValue}" min="0" step="0.01" />
        <div class="adj-form-actions" style="margin-top:6px;">
          <button class="btn" id="receiptEditCancelBtn" type="button">Cancel</button>
          <button class="btn primary" id="receiptEditSaveBtn" data-adj-id="${adj.id}" type="button">Save</button>
        </div>
      </div>
    `;
        item.insertAdjacentHTML("afterend", html);
        document.getElementById("receiptEditCancelBtn").addEventListener("click", ()=>this._removeReceiptForms());
        document.getElementById("receiptEditValue").focus();
    }
    _showReceiptAddManualForm() {
        this._removeReceiptForms();
        const modal = this._parentElement.querySelector(".pos-modal");
        if (!modal) return;
        const html = `
      <div class="receipt-manual-overlay" id="receiptManualForm">
      <div class="adj-form receipt-manual-card">
        <h4 class="adj-form-title">Add One-off Adjustment</h4>

        <div class="edit-field">
          <label for="receiptManualName">Name</label>
          <input type="text" id="receiptManualName" placeholder="e.g. Discount, Tip" />
        </div>

        <p class="adj-form-sublabel">Type</p>
        <div class="adj-selector" id="receiptManualTypeSelector">
          <button type="button" class="adj-selector-btn active" data-value="fee">Fee</button>
          <button type="button" class="adj-selector-btn" data-value="discount">Discount</button>
        </div>
        <input type="hidden" id="receiptManualType" value="fee" />

        <p class="adj-form-sublabel">Calculation</p>
        <div class="adj-selector" id="receiptManualCalcSelector">
          <button type="button" class="adj-selector-btn active" data-value="fixed">Fixed (&#8369;)</button>
          <button type="button" class="adj-selector-btn" data-value="percentage">
            Percentage (%)
            <span class="adj-info-tip">i</span>
          </button>
        </div>
        <input type="hidden" id="receiptManualCalc" value="fixed" />

        <div class="edit-field">
          <label id="receiptManualValueLabel">Value (&#8369;)</label>
          <input type="number" id="receiptManualValue" min="0" step="0.01" placeholder="0" />
        </div>

        <div class="adj-form-actions">
          <button type="button" class="btn" id="receiptManualCancelBtn">Cancel</button>
          <button type="button" class="btn primary" id="receiptManualSaveBtn">Add</button>
        </div>
      </div>
      </div>
    `;
        modal.insertAdjacentHTML("beforeend", html);
        document.querySelectorAll("#receiptManualTypeSelector, #receiptManualCalcSelector").forEach((group)=>{
            group.addEventListener("click", (e)=>{
                const btn = e.target.closest(".adj-selector-btn");
                if (!btn) return;
                group.querySelectorAll(".adj-selector-btn").forEach((b)=>b.classList.remove("active"));
                btn.classList.add("active");
                if (group.id === "receiptManualCalcSelector") {
                    document.getElementById("receiptManualCalc").value = btn.dataset.value;
                    document.getElementById("receiptManualValueLabel").textContent = btn.dataset.value === "percentage" ? "Value (%)" : "Value (\u20B1)";
                } else document.getElementById("receiptManualType").value = btn.dataset.value;
            });
        });
        document.getElementById("receiptManualCancelBtn").addEventListener("click", ()=>this._removeReceiptForms());
        this._wireInfoTip();
        document.getElementById("receiptManualName").focus();
    }
    _wireInfoTip() {
        document.querySelectorAll(".adj-info-tip").forEach((tip)=>{
            tip.addEventListener("click", (e)=>{
                e.stopPropagation();
                document.querySelector(".adj-tooltip")?.remove();
                const rect = tip.getBoundingClientRect();
                const el = document.createElement("div");
                el.className = "adj-tooltip";
                el.textContent = "% of the running subtotal at the time this adjustment is applied";
                document.body.appendChild(el);
                el.style.left = `${rect.left + rect.width / 2 - el.offsetWidth / 2}px`;
                el.style.top = `${rect.top - el.offsetHeight - 8}px`;
                setTimeout(()=>{
                    document.addEventListener("click", ()=>el.remove(), {
                        once: true
                    });
                }, 0);
            });
        });
    }
    _removeReceiptForms() {
        document.getElementById("receiptEditForm")?.remove();
        document.getElementById("receiptManualForm")?.remove();
    }
    // ── Handlers ──────────────────────────────────────────────────────────────────
    _addHandlerShowCheckout(handler) {
        this._parentElement.addEventListener("click", function(e) {
            const btn = e.target.closest(".btn-checkout");
            if (!btn) return;
            handler();
        });
    }
    _subtractChange() {
        this._parentElement.addEventListener("click", (e)=>{
            const btn = e.target.closest("#enterPaymentBtn");
            if (!btn) return;
            const changeBox = document.querySelector(".change-box");
            const payment = +this._parentElement.querySelector("#customerPayment").value;
            this._customerPayment = payment;
            if (payment < this._totalPrice) changeBox.textContent = `Payment must be higher or equal to order total`;
            else {
                const change = payment - this._totalPrice;
                changeBox.classList.add("ok");
                changeBox.textContent = change;
                this._customerChange = change;
                document.querySelector(".print-receipt-btn").classList.toggle("hidden");
            }
        });
    }
    _addHandlerPrintReceipt(handler) {
        this._parentElement.addEventListener("click", function(e) {
            const btn = e.target.closest("#printReceiptBtn");
            if (!btn) return;
            handler();
        });
    }
    _addHandlerReceiptEdit(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            const btn = e.target.closest(".receipt-adj-edit-btn");
            if (!btn) return;
            handler(btn.dataset.adjId);
        });
    }
    _addHandlerReceiptRemove(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            const btn = e.target.closest(".receipt-adj-remove-btn");
            if (!btn) return;
            handler(btn.dataset.adjId);
        });
    }
    _addHandlerReceiptAddManual(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            if (!e.target.closest(".receipt-add-adj-btn")) return;
            handler();
        });
    }
    _addHandlerReceiptSaveOverride(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            const btn = e.target.closest("#receiptEditSaveBtn");
            if (!btn) return;
            const value = parseFloat(document.getElementById("receiptEditValue").value);
            if (isNaN(value) || value < 0) {
                alert("Please enter a valid value.");
                return;
            }
            handler({
                id: btn.dataset.adjId,
                value
            });
        });
    }
    _addHandlerReceiptSaveManual(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            if (!e.target.closest("#receiptManualSaveBtn")) return;
            const name = document.getElementById("receiptManualName")?.value.trim();
            const type = document.getElementById("receiptManualType")?.value;
            const calculation = document.getElementById("receiptManualCalc")?.value;
            const value = parseFloat(document.getElementById("receiptManualValue")?.value);
            if (!name) {
                alert("Please enter a name.");
                return;
            }
            if (isNaN(value) || value < 0) {
                alert("Please enter a valid value.");
                return;
            }
            handler({
                name,
                type,
                calculation,
                value
            });
        });
    }
    _addHandlerBack(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            if (!e.target.closest(".checkout-back-btn")) return;
            handler();
        });
    }
    _addHandlerDeleteCartItem(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            const btn = e.target.closest(".checkout-cart-delete-btn");
            if (!btn) return;
            handler(Number(btn.dataset.cartIndex));
        });
    }
    _hideModal() {
        document.querySelector(".modal-overlay").classList.add("hidden");
    }
}
exports.default = new OrderCheckOutView();

},{"./view.js":"j6ZzV","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"3vcF1":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _viewJs = require("./view.js");
var _viewJsDefault = parcelHelpers.interopDefault(_viewJs);
class MenuEditView extends (0, _viewJsDefault.default) {
    _parentElement = document.querySelector(".modal-parent");
    _formDiv = document.querySelector(".edit-form-parent");
    _submitHandler = null;
    _currentItemId = null;
    _showEditMenuForm(handler) {
        this._parentElement.addEventListener("click", (e)=>{
            e.preventDefault();
            const card = e.target.closest(".card");
            if (!card) return;
            handler(card.dataset.id);
        });
    }
    _insertEditMenuMarkup(item) {
        this._currentItemId = item._id;
        const markUp = `<!-- BACKDROP -->
<div class="modal-backdrop">
  <!-- MODAL CONTAINER -->
  <div class="modal-container">
    <button class="modal-close-btn" aria-label="Close modal">x</button>

    <form class="edit-item-form">
      <h2 class="edit-form-title">Edit Menu Item</h2>

      <div class="edit-form-grid">
        <!-- LEFT COLUMN -->
        <div class="edit-form-column">

          <!-- IMAGE PREVIEW + UPLOAD -->
            <div class="file-upload-preview-wrapper">
              <img
                src="${item.imageURL || "default-image.png"}"
                alt="Item Image"
                class="edit-image-preview"
              />
              <input type="file" class="edit-image-input" name="image" style="display:none;" />
              <span class="edit-image-overlay">Click to change image</span>
            </div>


          <label class="edit-field">
            Item Name
            <input type="text" name="itemName" value="${item.itemName}" />
          </label>

          <label class="edit-field">
            Price
            <input type="number" name="price" value="${item.price}" />
          </label>

          <div class="edit-field">
            <span class="edit-field-label">Category</span>
            <div class="category-wrapper">
              <select class="edit-field-select" name="category"></select>
              <div class="new-category-row hidden">
                <input type="text" class="new-category-field edit-new-category-input" placeholder="New category name" />
                <button class="new-category-button" type="button">+ Add</button>
              </div>
            </div>
          </div>

          <label class="edit-field">
            Description
            <textarea name="description" rows="4">${item.description}</textarea>
          </label>

          <label class="edit-field">
            Stock
            <input type="number" name="stock" value="${item._stock}" />
          </label>

        </div>

        <!-- RIGHT COLUMN -->
        <div class="edit-form-column">

          <label class="edit-field">
            Status
            <select name="status">
              <option value="Active" ${item.status === "active" ? "selected" : ""}>Active</option>
              <option value="Inactive" ${item.status === "inactive" ? "selected" : ""}>Inactive</option>
              <option value="Unavailable" ${item.status === "unavailable" ? "selected" : ""}>Unavailable</option>
            </select>
          </label>

          <div class="edit-toggle-row">
            <span class="edit-toggle-label">Has Variants</span>
            <label class="edit-switch">
              <input type="checkbox" name="hasVariants" ${item.hasVariants ? "checked" : ""} />
              <span class="edit-slider"></span>
            </label>
          </div>

          <!-- Variants Section -->
          <div class="edit-variants-section">

            <!-- Header: Variants title + Add button -->
            <div class="edit-variants-header">
              <h3 class="edit-variants-title">Variants</h3>
              <button type="button" class="edit-add-variant-btn">+ Add Variant Group</button>
            </div>

            ${item.hasVariants ? item.variants.map((variant, vIndex)=>{
            return `
            <div class="edit-variant-group">
              <div class="edit-variant-header">
                <label class="edit-field">
                  Variant Group
                  <input type="text" name="variants[${vIndex}][optionLabel]" value="${variant.optionLabel}" />
                </label>
                <button type="button" class="edit-delete-variant-btn">\u{2715}</button>
              </div>

              <div class="edit-variant-options">
                ${variant.options.map((option, oIndex)=>{
                return `
                    <div class="edit-variant-row">
                      <input
                        type="text"
                        name="variants[${vIndex}][options][${oIndex}][optionName]"
                        placeholder="Option name"
                        value="${option.optionName}"
                      />
                      <input
                        type="number"
                        name="variants[${vIndex}][options][${oIndex}][optionPrice]"
                        placeholder="Price"
                        value="${option.optionPrice}"
                      />
                      <button type="button" class="edit-delete-option-btn">\u{2715}</button>
                    </div>
                    `;
            }).join("")}
              </div>

              <button type="button" class="edit-add-option-btn">+ Add Option</button>   
            </div>
          `;
        }).join("") : ""}
          </div>

          <!-- ACTION BUTTONS -->
          <div class="edit-form-actions">
            <button type="submit" class="edit-update-btn">Update</button>
            <button type="button" class="edit-delete-btn">Delete Item</button>
          </div>

        </div>
      </div>
    </form>
  </div>
</div>
`;
        this._formDiv.innerHTML = "";
        this._formDiv.insertAdjacentHTML("beforeend", markUp);
    }
    _mapMenuCategoriesMarkUp(categories, selectedCategory) {
        const selectEl = document.querySelector(".edit-field-select");
        // Start fresh
        selectEl.innerHTML = "";
        // Default option (only selected if no category exists)
        selectEl.insertAdjacentHTML("beforeend", `<option value="" disabled ${!selectedCategory ? "selected" : ""}>
       Select category
     </option>`);
        // Add actual categories
        const markup = categories.map((cat)=>`
        <option value="${cat}" ${cat === selectedCategory ? "selected" : ""}>
          ${cat[0].toUpperCase() + cat.slice(1)}
        </option>
      `).join("");
        selectEl.insertAdjacentHTML("beforeend", markup);
        // Add "new category" option
        selectEl.insertAdjacentHTML("beforeend", `<option value="new-category">Add new category</option>`);
    }
    _updateItemData(handler) {
        if (this._submitHandler) this._formDiv.removeEventListener("submit", this._submitHandler);
        this._submitHandler = (e)=>{
            e.preventDefault();
            const form = e.target.closest(".edit-item-form");
            if (!form) return;
            const formData = new FormData(form);
            const data = {};
            for (let [key, value] of formData.entries())data[key] = value;
            this._formDiv.removeEventListener("submit", this._submitHandler);
            this._submitHandler = null;
            handler(data);
            const backdrop = form.closest(".modal-backdrop");
            if (backdrop) backdrop.remove();
            this._showSuccess();
            setTimeout(()=>this._hideSuccess(), 1000);
        };
        this._formDiv.addEventListener("submit", this._submitHandler);
    }
    _updateImagePreview() {
        // Click image to open file dialog
        this._formDiv.addEventListener("click", (e)=>{
            const wrapper = e.target.closest(".file-upload-preview-wrapper");
            if (!wrapper) return;
            const input = wrapper.querySelector(".edit-image-input");
            if (!input) return;
            input.click();
        });
        // Update preview when file selected
        this._formDiv.addEventListener("change", (e)=>{
            const input = e.target.closest(".edit-image-input");
            if (!input) return;
            const file = input.files[0];
            if (!file) return;
            const preview = input.closest(".file-upload-preview-wrapper").querySelector(".edit-image-preview");
            const reader = new FileReader();
            reader.onload = (e)=>{
                preview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    _addVariantGroup() {
        this._formDiv.addEventListener("click", (e)=>{
            const btn = e.target.closest(".edit-add-variant-btn");
            if (!btn) return;
            const variantsSection = btn.closest(".edit-variants-section");
            if (!variantsSection) return;
            // Determine next index
            const currentGroups = variantsSection.querySelectorAll(".edit-variant-group");
            const vIndex = currentGroups.length;
            // Build markup for a new empty variant group
            const markup = `
      <div class="edit-variant-group">
        <div class="edit-variant-header">
          <label class="edit-field">
            Variant Group
            <input type="text" name="variants[${vIndex}][optionLabel]" value="" placeholder="Variant Label" />
          </label>
          <button type="button" class="edit-delete-variant-btn">\u{2715}</button>
        </div>

        <div class="edit-variant-options">
          <div class="edit-variant-row">
            <input
              type="text"
              name="variants[${vIndex}][options][0][optionName]"
              placeholder="Option name"
            />
            <input
              type="number"
              name="variants[${vIndex}][options][0][optionPrice]"
              placeholder="Price"
            />
            <button type="button" class="edit-delete-option-btn">\u{2715}</button>
          </div>
        </div>

        <button type="button" class="edit-add-option-btn">+ Add Option</button>
      </div>
    `;
            // Insert new group at the bottom of variants section
            variantsSection.insertAdjacentHTML("beforeend", markup);
            // Get the newly added group
            const newGroup = variantsSection.querySelector(".edit-variant-group:last-child");
            // Scroll smoothly to the new group
            newGroup.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            // Focus on the group name input
            const input = newGroup.querySelector("input[name^='variants'][name$='[optionLabel]']");
            if (input) input.focus();
            this._reindexVariants(); // make sure indices stay correct
            // Auto-enable the hasVariants toggle when a group is added
            const checkbox = this._formDiv.querySelector('[name="hasVariants"]');
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                const variantsSection = this._formDiv.querySelector(".edit-variants-section");
                if (variantsSection) variantsSection.style.display = "";
            }
        });
    }
    _addOption() {
        this._formDiv.addEventListener("click", (e)=>{
            const btn = e.target.closest(".edit-add-option-btn");
            if (!btn) return;
            const variantGroup = btn.closest(".edit-variant-group");
            if (!variantGroup) return;
            const optionsContainer = variantGroup.querySelector(".edit-variant-options");
            if (!optionsContainer) return;
            // Determine next option index
            const currentOptions = optionsContainer.querySelectorAll(".edit-variant-row");
            const oIndex = currentOptions.length;
            // Determine vIndex for this variant group
            const groupInput = variantGroup.querySelector("input[name^='variants'][name$='[optionLabel]']");
            const vIndexMatch = groupInput.name.match(/variants\[(\d+)\]/);
            const vIndex = vIndexMatch ? vIndexMatch[1] : 0;
            // Build new option row
            const markup = `
      <div class="edit-variant-row">
        <input
          type="text"
          name="variants[${vIndex}][options][${oIndex}][optionName]"
          placeholder="Option name"
        />
        <input
          type="number"
          name="variants[${vIndex}][options][${oIndex}][optionPrice]"
          placeholder="Price"
        />
        <button type="button" class="edit-delete-option-btn">\u{2715}</button>
      </div>
    `;
            optionsContainer.insertAdjacentHTML("beforeend", markup);
            // Scroll to the new option
            const newOption = optionsContainer.querySelector(".edit-variant-row:last-child");
            newOption.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            // Focus on the new option name input
            const input = newOption.querySelector("input[name$='[optionName]']");
            if (input) input.focus();
            this._reindexVariants(); // make sure names stay correct
        });
    }
    _deleteVariant() {
        this._formDiv.addEventListener("click", (e)=>{
            const btn = e.target.closest(".edit-delete-variant-btn");
            if (!btn) return;
            const confirmDelete = window.confirm("Delete this variant group?");
            if (!confirmDelete) return;
            const group = btn.closest(".edit-variant-group");
            if (group) group.remove();
            this._reindexVariants();
            const remaining = this._formDiv.querySelectorAll(".edit-variant-group");
            if (remaining.length === 0) {
                const checkbox = this._formDiv.querySelector('[name="hasVariants"]');
                if (checkbox) checkbox.checked = false;
            }
        });
    }
    _reindexVariants() {
        const groups = this._formDiv.querySelectorAll(".edit-variant-group");
        groups.forEach((group, vIndex)=>{
            // Update variant label input
            const labelInput = group.querySelector('input[name*="[optionLabel]"]');
            labelInput.name = `variants[${vIndex}][optionLabel]`;
            // Update option inputs
            const optionRows = group.querySelectorAll(".edit-variant-row");
            optionRows.forEach((row, oIndex)=>{
                const nameInput = row.querySelector('input[name*="[optionName]"]');
                const priceInput = row.querySelector('input[name*="[optionPrice]"]');
                nameInput.name = `variants[${vIndex}][options][${oIndex}][optionName]`;
                priceInput.name = `variants[${vIndex}][options][${oIndex}][optionPrice]`;
            });
        });
    }
    _deleteOption() {
        this._formDiv.addEventListener("click", (e)=>{
            const btn = e.target.closest(".edit-delete-option-btn");
            if (!btn) return;
            const row = btn.closest(".edit-variant-row");
            if (row) row.remove();
            this._reindexVariants();
        });
    }
    _addHandlerHasVariantsToggle() {
        this._formDiv.addEventListener("change", (e)=>{
            const checkbox = e.target.closest('[name="hasVariants"]');
            if (!checkbox) return;
            const variantsSection = this._formDiv.querySelector(".edit-variants-section");
            if (checkbox.checked) {
                if (variantsSection) variantsSection.style.display = "";
                return;
            }
            const existingGroups = this._formDiv.querySelectorAll(".edit-variant-group");
            if (existingGroups.length === 0) {
                if (variantsSection) variantsSection.style.display = "none";
                return;
            }
            // Revert toggle until user confirms
            checkbox.checked = true;
            this._showVariantsToggleConfirm(()=>{
                checkbox.checked = false;
                existingGroups.forEach((g)=>g.remove());
                if (variantsSection) variantsSection.style.display = "none";
            });
        });
    }
    _showVariantsToggleConfirm(onConfirm) {
        const markup = `
      <div class="edit-confirm-overlay">
        <div class="edit-confirm-dialog">
          <p class="edit-confirm-msg">Toggling this off will remove all existing variants. Do you want to continue?</p>
          <div class="edit-confirm-actions">
            <button type="button" class="edit-confirm-cancel-btn">Cancel</button>
            <button type="button" class="edit-confirm-yes-btn">Continue</button>
          </div>
        </div>
      </div>
    `;
        const container = this._formDiv.querySelector(".modal-container");
        container.insertAdjacentHTML("beforeend", markup);
        const overlay = container.querySelector(".edit-confirm-overlay");
        overlay.querySelector(".edit-confirm-yes-btn").addEventListener("click", ()=>{
            overlay.remove();
            onConfirm();
        });
        overlay.querySelector(".edit-confirm-cancel-btn").addEventListener("click", ()=>{
            overlay.remove();
        });
    }
    _addHandlerDeleteItem(handler) {
        this._formDiv.addEventListener("click", (e)=>{
            const btn = e.target.closest(".edit-delete-btn");
            if (!btn) return;
            const confirmed = window.confirm("Delete this item? This cannot be undone.");
            if (!confirmed) return;
            const backdrop = btn.closest(".modal-backdrop");
            if (backdrop) backdrop.remove();
            handler(this._currentItemId);
        });
    }
    _closeModal() {
        this._formDiv.addEventListener("click", (e)=>{
            const btn = e.target.closest(".modal-close-btn");
            if (!btn) return;
            const backdrop = btn.closest(".modal-backdrop");
            if (backdrop) backdrop.remove();
        });
    }
    _newEditCategoryToggle(handler) {
        this._formDiv.addEventListener("change", (e)=>{
            const select = e.target.closest(".edit-field-select");
            if (!select) return;
            const row = select.closest(".category-wrapper")?.querySelector(".new-category-row");
            if (!row) return;
            if (select.value === "new-category") {
                row.classList.remove("hidden");
                row.querySelector(".new-category-field").focus();
            } else row.classList.add("hidden");
        });
        this._formDiv.addEventListener("click", (e)=>{
            const btn = e.target.closest(".edit-field .new-category-button");
            if (!btn) return;
            const row = btn.closest(".new-category-row");
            const input = row.querySelector(".new-category-field");
            const name = input.value.trim();
            if (!name) {
                alert("Please enter a category name");
                return;
            }
            handler(name);
            input.value = "";
            row.classList.add("hidden");
        });
        this._formDiv.addEventListener("keydown", (e)=>{
            if (e.key !== "Enter") return;
            const input = e.target.closest(".edit-new-category-input");
            if (!input) return;
            e.preventDefault();
            const row = input.closest(".new-category-row");
            const name = input.value.trim();
            if (!name) {
                alert("Please enter a category name");
                return;
            }
            handler(name);
            input.value = "";
            row.classList.add("hidden");
        });
    }
}
exports.default = new MenuEditView();

},{"./view.js":"j6ZzV","@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}],"9r3uf":[function(require,module,exports,__globalThis) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
class SettingsView {
    _modal = document.getElementById("settingsModal");
    _openBtn = document.getElementById("settingsBtn");
    _closeBtn = document.getElementById("settingsCloseBtn");
    _addBtn = document.getElementById("addAdjustmentBtn");
    _list = document.getElementById("adjustmentList");
    _showRemovedToggle = document.getElementById("showRemovedToggle");
    _categoryList = document.getElementById("categoryList");
    _categoryInput = document.getElementById("categoryInput");
    _addCategoryBtn = document.getElementById("addCategoryBtn");
    // ── Open / Close ─────────────────────────────────────────────────────────────
    _addHandlerOpen(handler) {
        this._openBtn.addEventListener("click", ()=>{
            this._modal.classList.remove("hidden");
            handler();
        });
    }
    _addHandlerClose() {
        this._closeBtn.addEventListener("click", ()=>this._close());
        this._modal.addEventListener("click", (e)=>{
            if (e.target === this._modal) this._close();
        });
    }
    _close() {
        this._modal.classList.add("hidden");
        this._removeForm();
    }
    // ── Category List ────────────────────────────────────────────────────────────
    renderCategories(categories) {
        if (categories.length === 0) {
            this._categoryList.innerHTML = '<li class="adjustment-empty">No categories yet.</li>';
            return;
        }
        this._categoryList.innerHTML = categories.map((cat)=>`
        <li class="category-item">
          <span class="category-item-name">${cat[0].toUpperCase() + cat.slice(1)}</span>
          <button class="category-delete-btn" data-category="${cat}" type="button">Delete</button>
        </li>`).join("");
    }
    _addHandlerAddCategory(handler) {
        this._addCategoryBtn.addEventListener("click", ()=>{
            handler(this._categoryInput.value);
            this._categoryInput.value = "";
        });
        this._categoryInput.addEventListener("keydown", (e)=>{
            if (e.key !== "Enter") return;
            handler(this._categoryInput.value);
            this._categoryInput.value = "";
        });
    }
    _addHandlerDeleteCategory(handler) {
        this._categoryList.addEventListener("click", (e)=>{
            const btn = e.target.closest(".category-delete-btn");
            if (!btn) return;
            handler(btn.dataset.category);
        });
    }
    // ── Adjustment List ───────────────────────────────────────────────────────────
    renderAdjustments(adjustments) {
        if (adjustments.length === 0) {
            this._list.innerHTML = '<li class="adjustment-empty">No adjustments yet.</li>';
            return;
        }
        this._list.innerHTML = adjustments.map((adj)=>`
        <li class="adjustment-item" data-id="${adj.id}">
          <label class="switch">
            <input type="checkbox" class="adj-toggle" ${adj.enabled ? "checked" : ""} />
            <span class="slider round"></span>
          </label>
          <div class="adjustment-item-info">
            <div class="adjustment-item-name">${adj.name}</div>
            <div class="adjustment-item-meta">
              ${adj.type === "fee" ? "Fee" : "Discount"} &middot;
              ${adj.calculation === "fixed" ? "&#8369;" + adj.value.toFixed(2) : adj.value + "%"}
            </div>
          </div>
          <div class="adjustment-item-controls">
            <button class="adjustment-edit-btn" data-id="${adj.id}" type="button">Edit</button>
            <button class="adjustment-delete-btn" data-id="${adj.id}" type="button">Delete</button>
          </div>
        </li>
      `).join("");
    }
    // ── Add / Edit Form ───────────────────────────────────────────────────────────
    showForm(adjustment = null) {
        this._removeForm();
        const isEdit = adjustment !== null;
        const html = `
      <div class="adj-form" id="adjForm">
        <h4 class="adj-form-title">${isEdit ? "Edit Adjustment" : "New Adjustment"}</h4>

        <div class="edit-field">
          <label for="adjName">Name</label>
          <input type="text" id="adjName" placeholder="e.g. VAT, Service Charge"
            value="${isEdit ? adjustment.name : ""}" />
        </div>

        <p class="adj-form-sublabel">Type</p>
        <div class="adj-selector" id="adjTypeSelector">
          <button type="button" class="adj-selector-btn ${!isEdit || adjustment.type === "fee" ? "active" : ""}" data-value="fee">Fee</button>
          <button type="button" class="adj-selector-btn ${isEdit && adjustment.type === "discount" ? "active" : ""}" data-value="discount">Discount</button>
        </div>
        <input type="hidden" id="adjType" value="${isEdit ? adjustment.type : "fee"}" />

        <p class="adj-form-sublabel">Calculation</p>
        <div class="adj-selector" id="adjCalcSelector">
          <button type="button" class="adj-selector-btn ${!isEdit || adjustment.calculation === "fixed" ? "active" : ""}" data-value="fixed">Fixed (&#8369;)</button>
          <button type="button" class="adj-selector-btn ${isEdit && adjustment.calculation === "percentage" ? "active" : ""}" data-value="percentage">
            Percentage (%)
            <span class="adj-info-tip">i</span>
          </button>
        </div>
        <input type="hidden" id="adjCalc" value="${isEdit ? adjustment.calculation : "fixed"}" />

        <div class="edit-field">
          <label for="adjValue" id="adjValueLabel">
            ${isEdit && adjustment.calculation === "percentage" ? "Value (%)" : "Value (&#8369;)"}
          </label>
          <input type="number" id="adjValue" min="0" step="0.01" placeholder="0"
            value="${isEdit ? adjustment.value : ""}" />
        </div>

        <div class="adj-form-actions">
          <button type="button" class="btn" id="adjCancelBtn">Cancel</button>
          <button type="button" class="btn primary" id="adjSaveBtn"
            data-edit-id="${isEdit ? adjustment.id : ""}">
            ${isEdit ? "Update" : "Add"}
          </button>
        </div>
      </div>
    `;
        this._list.insertAdjacentHTML("beforebegin", html);
        // Wire selector groups
        document.querySelectorAll(".adj-selector").forEach((group)=>{
            group.addEventListener("click", (e)=>{
                const btn = e.target.closest(".adj-selector-btn");
                if (!btn) return;
                group.querySelectorAll(".adj-selector-btn").forEach((b)=>b.classList.remove("active"));
                btn.classList.add("active");
                if (group.id === "adjCalcSelector") {
                    document.getElementById("adjCalc").value = btn.dataset.value;
                    document.getElementById("adjValueLabel").textContent = btn.dataset.value === "percentage" ? "Value (%)" : "Value (\u20B1)";
                } else document.getElementById("adjType").value = btn.dataset.value;
            });
        });
        document.getElementById("adjCancelBtn").addEventListener("click", ()=>this._removeForm());
        this._wireInfoTip();
        document.getElementById("adjName").focus();
    }
    _wireInfoTip() {
        document.querySelectorAll(".adj-info-tip").forEach((tip)=>{
            tip.addEventListener("click", (e)=>{
                e.stopPropagation();
                document.querySelector(".adj-tooltip")?.remove();
                const rect = tip.getBoundingClientRect();
                const el = document.createElement("div");
                el.className = "adj-tooltip";
                el.textContent = "% of the running subtotal at the time this adjustment is applied";
                document.body.appendChild(el);
                el.style.left = `${rect.left + rect.width / 2 - el.offsetWidth / 2}px`;
                el.style.top = `${rect.top - el.offsetHeight - 8}px`;
                setTimeout(()=>{
                    document.addEventListener("click", ()=>el.remove(), {
                        once: true
                    });
                }, 0);
            });
        });
    }
    _removeForm() {
        document.getElementById("adjForm")?.remove();
    }
    _getFormData() {
        return {
            id: document.getElementById("adjSaveBtn")?.dataset.editId || null,
            name: document.getElementById("adjName")?.value.trim(),
            type: document.getElementById("adjType")?.value,
            calculation: document.getElementById("adjCalc")?.value,
            value: parseFloat(document.getElementById("adjValue")?.value)
        };
    }
    // ── Handlers ──────────────────────────────────────────────────────────────────
    _addHandlerAdd() {
        this._addBtn.addEventListener("click", ()=>this.showForm());
    }
    _addHandlerSave(handler) {
        this._modal.addEventListener("click", (e)=>{
            if (!e.target.closest("#adjSaveBtn")) return;
            const data = this._getFormData();
            if (!data.name) {
                alert("Please enter a name.");
                return;
            }
            if (isNaN(data.value) || data.value < 0) {
                alert("Please enter a valid value.");
                return;
            }
            handler(data);
            this._removeForm();
        });
    }
    _addHandlerEdit(handler) {
        this._list.addEventListener("click", (e)=>{
            const btn = e.target.closest(".adjustment-edit-btn");
            if (!btn) return;
            handler(btn.dataset.id);
        });
    }
    _addHandlerDelete(handler) {
        this._list.addEventListener("click", (e)=>{
            const btn = e.target.closest(".adjustment-delete-btn");
            if (!btn) return;
            handler(btn.dataset.id);
        });
    }
    _addHandlerToggle(handler) {
        this._list.addEventListener("change", (e)=>{
            const toggle = e.target.closest(".adj-toggle");
            if (!toggle) return;
            const id = toggle.closest(".adjustment-item").dataset.id;
            handler(id);
        });
    }
    _addHandlerShowRemoved(handler) {
        this._showRemovedToggle.addEventListener("change", ()=>{
            handler(this._showRemovedToggle.checked);
        });
    }
    syncShowRemovedToggle(value) {
        this._showRemovedToggle.checked = value;
    }
}
exports.default = new SettingsView();

},{"@parcel/transformer-js/src/esmodule-helpers.js":"jnFvT"}]},["9D6WG","68rHr"], "68rHr", "parcelRequireae58", {})

//# sourceMappingURL=Pointy Project.494665d6.js.map
