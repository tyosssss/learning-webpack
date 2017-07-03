/**
 * installedModules  : 已加载的对象
 * 
 * installedChunks   : 已加载的块
 */
/******/ (function(modules) { // webpackBootstrap
  
// --------------------------------------- 1. watefall("bootstrap" , source, chunk, hash, moduleTemplate, dependencyTemplates)
// install a JSONP callback for chunk loading
var parentJsonpFunction = window[JSON.stringify("webpackJsonp")];
/**
 * @param {String[]} chunkIds
 * @param {Object} moreModules
 * @param {} executeModules
 */
window["webpackJsonp"] = function webpackJsonpCallback(chunkIds, moreModules, executeModules) {
  var moduleId, chunkId, i = 0, resolves = [], result;

  // 找出
  for (; i < chunkIds.length; i++) {
    chunkId = chunkIds[i];
    if (installedChunks[chunkId]) {
      resolves.push(installedChunks[chunkId][0]);
    }
    installedChunks[chunkId] = 0;
  }

  for (moduleId in moreModules) {
    if (Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
      modules[moduleId] = moreModules[moduleId];
    }
  }

  if (parentJsonpFunction) parentJsonpFunction(chunkIds, moreModules, executeModules);

  while (resolves.length) {
    resolves.shift()();
  }

  if (executeModules) {
    for (i = 0; i < executeModules.length; i++) {
      result = __webpack_require__(__webpack_require__.s = executeModules[i]);
    }

    return result;
  }
};

// --------------------------------------- 2. watefall("local-vars" , source, chunk, hash)
// The module cache
var installedModules = {};

// objects to store loaded and loading chunks
var installedChunks = {
  chunkId: 0 // ...
};

// The require function
function __webpack_require__(moduleId) {
  // Check if module is in cache ( 如果模块已经加载 , 那么直接返回;否则 , 创建一个新的模块 )
  if (installedModules[moduleId]) {
    return installedModules[moduleId].exports;
  }
  // Create a new module (and put it into the cache) (创建一个新模块对象 , 同时将其访日缓存列表中 )
  var module = installedModules[moduleId] = {
    // --------------------------------------- 3. watefall("module-obj" , source, chunk, hash)
  };

  /** 
   * Execute the module function ( 执行模块函数 )
   * @param {Object} module 模块对象
   * @param {Object} exports 模块的导出对象
   * @param {Function} require 模块中引用其他模块的函数
   * @this module.exports
   */
  modules[moduleId].call(
    module.exports,
    module,
    module.exports,
    // --------------------------------------- 4. watefall("module-require" , '__webpack__require_', chunk, hash,'moduleId') 
    __webpack__require_
  );

  // Flag the module as loaded ( 标记模块加载完毕 )
  module.l = true;

  // Return the exports of the module ( 返回模块导出的内容 )
  return module.exports;
}

// --------------------------------------- 5. watefall("require-extensions" , '', chunk, hash)
// This file contains only the entry chunk.
// The chunk loading function for additional chunks
__webpack_require__.e = function requireEnsure(chunkId) {
  var installedChunkData = installedChunks[chunkId];

  // 如果已经加载 , 那么直接返回
  if (installedChunkData === 0) {
    return new Promise(function (resolve) { resolve(); });
  }

  // a Promise means "currently loading".
  if (installedChunkData) {
    return installedChunkData[2];
  }

  // setup Promise in chunk cache
  var promise = new Promise(function (resolve, reject) {
    installedChunkData = installedChunks[chunkId] = [resolve, reject];
  });
  installedChunkData[2] = promise;

  // start chunk loading
  var head = document.getElementsByTagName('head')[0];
  // 6. ---------------------------------------watefall("jsonp-script" , '', chunk, hash)
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.charset = 'utf-8';
  script.async = true;
  script.timeout = 12000
  if (__webpack_require__.nc) {
    script.setAttribute("nonce", __webpack_require__.nc);
  }
  script.src = __webpack_require__.p +
    // 7. ---------------------------------------watefall("asset-path" , path,data)
    // 8. ---------------------------------------watefall("current-hash" , hash, length)
    "${scriptSrcPath}"

  var timeout = setTimeout(onScriptComplete, "${output.chunkLoadTimeout}");
  script.onerror = script.onload = onScriptComplete;
  function onScriptComplete() {
    // avoid mem leaks in IE.
    script.onerror = script.onload = null;
    clearTimeout(timeout);

    var chunk = installedChunks[chunkId];
    if (chunk !== 0) {
      if (chunk) {
        chunk[1](new Error('Loading chunk ' + chunkId + ' failed.'));
      }
      installedChunks[chunkId] = undefined;
    }
  }

  head.appendChild(script);

  return promise;
}

// on error function for async loading
__webpack_require__.oe = function (err) { console.error(err); throw err; };

// expose the modules object (__webpack_modules__)
__webpack_require__.m = modules;

// expose the module cache
__webpack_require__.c = installedModules;

// identity function for calling harmony imports with the correct context
__webpack_require__.i = function (value) { return value; };

// define getter function for harmony exports
__webpack_require__.d = function (exports, name, getter) {
  if (!__webpack_require__.o(exports, name)) {
    Object.defineProperty(exports, name, {
      configurable: false,
      enumerable: true,
      get: getter
    })
  }
}

// getDefaultExport function for compatibility with non-harmony modules
__webpack_require__.n = function (module) {
  var getter = module && module.__esModule
    ? function getDefault() { return module['default']; }
    : function getModuleExports() { return module; };

  return getter;
}

// Object.prototype.hasOwnProperty.call
__webpack_require__.o = function (object, property) { return Object.prototype.hasOwnProperty.call(object, property); };

// / __webpack_public_path__
__webpack_require__.p = "${publicPath}";

// --------------------------------------- 9. watefall("startup" , '', chunk, hash)
// Load entry module and return exports
return __webpack_require__(__webpack_require__.s = "${chunk.entryModule.id}");


/******/ })
/************************************************************************/
/******/ (
  // 
  // {
  // 
  //    /***/ moduleID :
  //      模块代码
  //    /***/ moduleID :
  //      ...
  //  
  //  }
  //
)