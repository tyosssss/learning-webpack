/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
"use strict";

const DependenciesBlockVariable = require("./DependenciesBlockVariable");

function disconnect(i) {
  i.disconnect();
}

function unseal(i) {
  i.unseal();
}

/**
 * 依赖块
 * 
 * @class DependenciesBlock
 */
class DependenciesBlock {
  constructor() {
    /**
     * 块中包含的依赖列表
     * @type {DependenciesBlock[]} 
     */
    this.dependencies = [];

    /**
     * 块中包含的异步块列表
     * @type {AsyncDependenciesBlock[]}
     */
    this.blocks = [];

    /**
     * 块中包含的依赖变量列表
     * @type {DependenciesBlockVariable[]}
     */
    this.variables = [];
  }

	/**
	 * 向块中添加异步依赖块
	 * @param {AsyncDependenciesBlock} block 异步块
	 */
  addBlock(block) {
    this.blocks.push(block);
    block.parent = this;
  }

	/**
	 * 向块中添加依赖的变量
	 * @param {String} name 变量的名称
	 * @param {String} expression 计算变量值的表达式 
	 * @param {DependenciesBlock} dependencies 计算变量表达式时的依赖
	 */
  addVariable(name, expression, dependencies) {
    // 避免重复
    for (let v of this.variables) {
      if (v.name === name && v.expression === expression) {
        return;
      }
    }

    this.variables.push(new DependenciesBlockVariable(name, expression, dependencies));
  }

	/**
	 * 向块中添加依赖
	 * @param {Dependency} dependency 依赖的实例
	 */
  addDependency(dependency) {
    this.dependencies.push(dependency);
  }

	/**
   * 更新生成内容摘要的原始值
   * 
   * @param {crypto.hash} hash hash实例
   */
  updateHash(hash) {
    function updateHash(i) {
      i.updateHash(hash);
    }

    this.dependencies.forEach(updateHash);	// 所有依赖
    this.blocks.forEach(updateHash);				// 所有异步块
    this.variables.forEach(updateHash);			// 所有变量
  }

	/**
	 * 
	 */
  disconnect() {
    this.dependencies.forEach(disconnect);
    this.blocks.forEach(disconnect);
    this.variables.forEach(disconnect);
  }

	/**
	 * 
	 */
  unseal() {
    this.blocks.forEach(unseal);
  }

	/**
	 * 判断快是否包含依赖
	 * @param {Function} filter (module:)
	 */
  hasDependencies(filter) {
    if (filter) {
      if (this.dependencies.some(filter)) {
        return true;
      }
    } else {
      if (this.dependencies.length > 0) {
        return true;
      }
    }

    return this.blocks.concat(this.variables).some(item => item.hasDependencies(filter));
  }

  /**
   * 排序块中的列表
   * @memberof DependenciesBlock
   */
  sortItems() {
    this.blocks.forEach(block => block.sortItems());
  }
}

module.exports = DependenciesBlock;
