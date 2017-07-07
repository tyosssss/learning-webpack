/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

/**
 * 
 * 
 * @class NullFactory
 */
class NullFactory {
  /**
   * 创建模块实例
   * 
   * @param {ModuleInfo} data 模块信息
   * @param {Function} callback 当创建完成时触发 (err,module:Module)=>void
   */
  create(data, callback) {
    return callback();
  }
}

module.exports = NullFactory;
