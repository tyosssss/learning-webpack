/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var DepBlockHelpers = exports;

//
// 1. 单块
// __webpack_require__.e/* <方法名> */(<chunkId>) [/*! <chunkName> */] [<chunkReason>].then
// ).catch(
// )
// 
// 2. 多块
// Promise.all( .. , .. , ..)
// 

/**
 * 获得加载依赖块的包装器的代码
 * 
 * 
 * @param {Block} depBlock 依赖块
 * @param {Object} outputOptions 输出配置
 * @param {Block} requestShortener 请求路径简写器
 * @param {String} name 加载依赖块的函数名
 * @returns {String[]} 代码块
 */
DepBlockHelpers.getLoadDepBlockWrapper = function (depBlock, outputOptions, requestShortener, name) {
  var promiseCode = DepBlockHelpers.getDepBlockPromise(depBlock, outputOptions, requestShortener, name);
  return [
    promiseCode + ".then(",
    ").catch(",
    ")"
  ];
};

/**
 * @param {Block} depBlock 依赖块
 * @param {Object} outputOptions 输出配置
 * @param {RequestShortener} requestShortener 请求路径简写器
 * @param {String} name 加载依赖块的函数名
 */
DepBlockHelpers.getDepBlockPromise = function (depBlock, outputOptions, requestShortener, name) {
  if (depBlock.chunks) {

    // 
    var chunks = depBlock.chunks.filter(function (chunk) {
      return !chunk.hasRuntime() && chunk.id !== null;
    });

    if (chunks.length === 1) {
      var chunk = chunks[0];

      return "__webpack_require__.e" + asComment(name) +
        "(" + JSON.stringify(chunk.id) + "" +
        (
          outputOptions.pathinfo && depBlock.chunkName
            ? "/*! " + requestShortener.shorten(depBlock.chunkName) + " */"
            : ""
        ) +
        asComment(depBlock.chunkReason) +
        ")";
    } else if (chunks.length > 0) {
      return "Promise.all" + asComment(name) + "(" +
        (outputOptions.pathinfo && depBlock.chunkName ? "/*! " + requestShortener.shorten(depBlock.chunkName) + " */" : "") +
        "[" +
        chunks.map(function (chunk) {
          return "__webpack_require__.e(" + JSON.stringify(chunk.id) + ")";
        }).join(", ") +
        "])";
    }
  }

  return "new Promise(function(resolve) { resolve(); })";
};

function asComment(str) {
  if (!str) return "";
  return "/* " + str + " */";
}
