/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Tapable = require("tapable");
const MultiModule = require("./MultiModule");

/**
 * 多入口模块依赖的工厂
 * 
 * @class MultiModuleFactory
 */
module.exports = class MultiModuleFactory extends Tapable {
  constructor() {
    super();
  }

  /**
   * 创建模块实例
   * 
   * @param {ModuleInfo} data 模块信息
   * @param {Function} callback 当创建完成时触发 (err,module:Module)=>void
   */
  create(data, callback) {
    const dependency = data.dependencies[0];

    callback(null, new MultiModule(data.context, dependency.dependencies, dependency.name));
  }
};
