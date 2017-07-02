/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
"use strict";
const NullDependency = require("./NullDependency");

/**
 * 
 */
class ConstDependency extends NullDependency {

  /**
   * 
   * @param {String} expression 常量表达式的内容
   * @param {Number | Tuple<start : Number , end : Number>} range 表达式在代码中的所占的范围
   */
  constructor(expression, range) {
    super();
    
    this.expression = expression;
    this.range = range;
  }

  /**
   * 设置用于计算hash的原始值 
   * @param {crypto.Hash} hash 
   */
  updateHash(hash) {
    hash.update(this.range + "");
    hash.update(this.expression + "");
  }
}

/**
 * ConstDependencyTemplate
 */
ConstDependency.Template = class ConstDependencyTemplate {
  /**
   * 
   * @param {Dependency} dep 依赖
   * @param {ReplaceSource} source 源
   */
  apply(dep, source) {
    if (typeof dep.range === "number") {
      source.insert(dep.range, dep.expression);
      return;
    }

    // 使用依赖的表达式内容替换依赖的原始表达式
    source.replace(dep.range[0], dep.range[1] - 1, dep.expression);
  }
};

module.exports = ConstDependency;
