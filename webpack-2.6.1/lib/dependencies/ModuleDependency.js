/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const Dependency = require("../Dependency");

/**
 * 模块依赖
 * 
 * @class ModuleDependency
 * @extends {Dependency}
 */
class ModuleDependency extends Dependency {
  constructor(request) {
    super();
    this.request = request;
    this.userRequest = request;
  }

	/**
	 * 判断other是否与依赖是相同的资源 ( 类型相同 && 请求路径 )
	 * @param {Any} other
	 * @returns {Boolean} 
	 */
  isEqualResource(other) {
    if (!(other instanceof ModuleDependency))
      return false;

    return this.request === other.request;
  }
}

module.exports = ModuleDependency;
