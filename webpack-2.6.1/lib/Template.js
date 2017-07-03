/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Tapable = require("tapable");
const ConcatSource = require("webpack-sources").ConcatSource;

const START_LOWERCASE_ALPHABET_CODE = "a".charCodeAt(0);
const START_UPPERCASE_ALPHABET_CODE = "A".charCodeAt(0);
const DELTA_A_TO_Z = "z".charCodeAt(0) - START_LOWERCASE_ALPHABET_CODE + 1;

/**
 * 代码生成模板
 */
module.exports = class Template extends Tapable {
  constructor(outputOptions) {
    super();
    this.outputOptions = outputOptions || {};
  }

  /**
   * 获得函数体的内容
   * @static
   * @param {String} fn 
   * @returns {String}
   */
  static getFunctionContent(fn) {
    return fn.toString().replace(/^function\s?\(\)\s?\{\n?|\n?\}$/g, "").replace(/^\t/mg, "");
  }

  /**
   * 将字符串str转换为合法的标识符
   * 
   * @static
   * @param {String} str 
   * @returns {String}
   */
  static toIdentifier(str) {
    if (typeof str !== "string") return "";

    return str
      .replace(/^[^a-zA-Z$_]/, "_")
      .replace(/[^a-zA-Z0-9$_]/g, "_");
  }

  /**
   * 将字符串str转化为合法的文件路径
   * 
   * @static
   * @param {any} str 
   * @returns 
   */
  static toPath(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/[^a-zA-Z0-9_!§$()=\-\^°]+/g, "-")
      .replace(/^-|-$/, "");
  }

  /**
   * map number to a single character a-z, A-Z or <_ + number> if number is too big
   * 将数字n作为ASCII码,并将其转换为字母. 如果超出字母的编码范围 , 那么返回 '_' + n
   * 
   * @static
   * @param {Number} n 数字
   * @returns {String}
   */
  static numberToIdentifer(n) {
    // lower case
    if (n < DELTA_A_TO_Z) {
      return String.fromCharCode(START_LOWERCASE_ALPHABET_CODE + n);
    }

    // upper case
    n -= DELTA_A_TO_Z;
    if (n < DELTA_A_TO_Z) {
      return String.fromCharCode(START_UPPERCASE_ALPHABET_CODE + n);
    }

    // fall back to _ + number
    n -= DELTA_A_TO_Z;
    return "_" + n;
  }

  /**
   * 将字符串str缩进一个单位 ( \t )
   * 
   * @param {String} str 字符串
   * @returns {String} 返回增加了缩进的字符串
   */
  indent(str) {
    if (Array.isArray(str)) {
      return str.map(this.indent.bind(this)).join("\n");
    } else {
      str = str.trimRight();

      if (!str) return "";

      var ind = (str[0] === "\n" ? "" : "\t");

      return ind + str.replace(/\n([^\n])/g, "\n\t$1");
    }
  }

  /**
   * 为字符串str添加前缀prefix
   * 
   * @param {String} str 字符串
   * @param {String} prefix 待添加的前缀
   * @returns {String}
   */
  prefix(str, prefix) {
    if (Array.isArray(str)) {
      str = str.join("\n");
    }

    str = str.trim();

    if (!str) return "";
    const ind = (str[0] === "\n" ? "" : prefix);

    return ind + str.replace(/\n([^\n])/g, "\n" + prefix + "$1");
  }

  /**
   * 如果str是数组 , 那么将数组转换为字符串;否则,直接返回
   * 
   * @param {Array|Any} str 
   * @returns 
   */
  asString(str) {
    if (Array.isArray(str)) {
      return str.join("\n");
    }

    return str;
  }

  /**
   * render 块中的模块列表
   * 
   * @param {Chunk} chunk 代码块
   * @param {ModuleTemplate} moduleTemplate 模块模板
   * @param {Map<Dependency,DependencyTemplate>} dependencyTemplates 依赖模板列表
   * @param {String} prefix 前缀字符串
   * @returns {Source} 返回渲染好的源实例
   */
  renderChunkModules(chunk, moduleTemplate, dependencyTemplates, prefix) {
    if (!prefix) prefix = "";

    var source = new ConcatSource();

    // 处理没有模块的情况
    if (chunk.modules.length === 0) {
      source.add("[]");
      return source;
    }

    var removedModules = chunk.removedModules;

    // render 块中所有模块的最终代码
    var allModules = chunk.modules.map(function (module) {
      return {
        id: module.id,
        source: moduleTemplate.render(module, dependencyTemplates, chunk)
      };
    });

    if (removedModules && removedModules.length > 0) {
      removedModules.forEach(function (id) {
        allModules.push({
          id: id,
          source: "false"
        });
      });
    }

    var bounds = this.getModulesArrayBounds(chunk.modules);

    if (bounds) {
      // Render a spare array
      var minId = bounds[0];
      var maxId = bounds[1];

      // 
      // Array(0).concat(
      //  [
      //    /* moduelID */
      //    ... 模块的代码
      //    ,
      //    /* moduelID */
      //    ...
      //  ]
      // )
      //
      if (minId !== 0) source.add("Array(" + minId + ").concat(");
      source.add("[\n");

      // 生成 Map<id,Module>
      var modules = {};
      allModules.forEach(function (module) {
        modules[module.id] = module;
      });

      // 遍历modules
      for (var idx = minId; idx <= maxId; idx++) {
        var module = modules[idx];
        if (idx !== minId) source.add(",\n");
        source.add("/* " + idx + " */");
        if (module) {
          source.add("\n");
          source.add(module.source);
        }
      }
      source.add("\n" + prefix + "]");
      if (minId !== 0) source.add(")");
    } else {
      // Render an object

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
      source.add("{\n");

      // 按字母顺序排序
      allModules
        .sort(function (a, b) {
          var aId = a.id + "";
          var bId = b.id + "";
          if (aId < bId) return -1;
          if (aId > bId) return 1;
          return 0;
        })
        .forEach(function (module, idx) {
          if (idx !== 0) source.add(",\n");

          source.add("\n/***/ " + JSON.stringify(module.id) + ":\n");
          source.add(module.source);
        });

      source.add("\n\n" + prefix + "}");
    }

    return source;
  }

  /**
   * 获得模块数组的边界
   * 
   * @param {Module[]} modules 
   * @returns {Tuple[min,max] | Boolean} 返回边界 , 没有边界则返回false
   */
  getModulesArrayBounds(modules) {
    // 如果moduleID是数字的 , 那么不作任何操作
    if (!modules.every(moduleIdIsNumber)) return false;

    // 
    // 找出moduleID中的最大值和最小值
    //
    var maxId = -Infinity;
    var minId = Infinity;
    modules.forEach(function (module) {
      if (maxId < module.id) maxId = module.id;
      if (minId > module.id) minId = module.id;
    });

    if (minId < 16 + ("" + minId).length) {
      // add minId x ',' instead of 'Array(minId).concat(...)'
      minId = 0;
    }

    var objectOverhead = modules
      .map(function (module) {
        var idLength = (module.id + "").length;
        return idLength + 2;
      })
      .reduce(function (a, b) {
        return a + b;
      }, -1);

    var arrayOverhead = minId === 0
      ? maxId
      : 16 + ("" + minId).length + maxId;

    return arrayOverhead < objectOverhead ? [minId, maxId] : false;
  }
};

/**
 * 判断模块id是否为数组
 * 
 * @param {Module} module 
 * @returns 返回判断结果
 */
function moduleIdIsNumber(module) {
  return typeof module.id === "number";
}
