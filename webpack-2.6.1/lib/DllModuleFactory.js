/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

var Tapable = require("tapable");
var DllModule = require("./DllModule");

class DllModuleFactory extends Tapable {
  constructor() {
    super();
  }

  /**
	 * 创建模块
	 * @param {ModuleData} data 创建模块的数据
	 * @param {Function} callback 回调函数 (err:Error,module:Module)=>void
	 */
  create(data, callback) {
    const dependency = data.dependencies[0];

    callback(null, new DllModule(data.context, dependency.dependencies, dependency.name, dependency.type));
  }
}

module.exports = DllModuleFactory;
