/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const ReplaceSource = require("webpack-sources").ReplaceSource;
const RawSource = require("webpack-sources").RawSource;

/**
 * 
 * 
 * @class DependenciesBlockVariable
 */
class DependenciesBlockVariable {
  /**
   * Creates an instance of DependenciesBlockVariable.
   * @param {String} name 依赖的变量名
   * @param {String} expression 生成变量值的表达式
   * @param {Dependency[]} dependencies 依赖块的变量
   * @memberof DependenciesBlockVariable
   */
  constructor(name, expression, dependencies) {
    this.name = name;
    this.expression = expression;
    this.dependencies = dependencies || [];
  }

  /**
   * 
   * 
   * @param {crypto.hash} hash 
   * @memberof DependenciesBlockVariable
   */
  updateHash(hash) {
    hash.update(this.name);
    hash.update(this.expression);
    
    this.dependencies.forEach(d => {
      d.updateHash(hash);
    });
  }

  /**
   * 生成依赖块变量的最终代码
   * 
   * @param {DependencyTemplate[]} dependencyTemplates 依赖模板
   * @param {Object} outputOptions 输出选项
   * @param {RequestShortener} requestShortener 请求路径简写器
   * @returns {ReplaceSource} 返回最终代码源
   * @memberof DependenciesBlockVariable
   */
  expressionSource(dependencyTemplates, outputOptions, requestShortener) {
    const source = new ReplaceSource(new RawSource(this.expression));

    // render 变量的依赖
    this.dependencies.forEach(dep => {
      const template = dependencyTemplates.get(dep.constructor);

      if (!template) {
        throw new Error(`No template for dependency: ${dep.constructor.name}`);
      }

      template.apply(dep, source, outputOptions, requestShortener, dependencyTemplates);
    });

    return source;
  }

  /**
   * 
   * 
   * @memberof DependenciesBlockVariable
   */
  disconnect() {
    this.dependencies.forEach(d => {
      d.disconnect();
    });
  }

  /**
   * 
   * 
   * @param {any} filter 
   * @returns 
   * @memberof DependenciesBlockVariable
   */
  hasDependencies(filter) {
    if (filter) {
      if (this.dependencies.some(filter)) return true;
    } else {
      if (this.dependencies.length > 0) return true;
    }
    return false;
  }
}

module.exports = DependenciesBlockVariable;
