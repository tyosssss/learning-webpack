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

class DependenciesBlock {
	constructor() {
		this.dependencies = [];
		this.blocks = [];
		this.variables = [];
	}
	
	/**
	 * 为依赖块 , 添加它依赖的异步块
	 * @param {AsyncDependenciesBlock} block 异步块
	 */
	addBlock(block) {
		this.blocks.push(block);
		block.parent = this;
	}

	/**
	 * 
	 * @param {String} name 
	 * @param {*} expression 
	 * @param {*} dependencies 
	 */
	addVariable(name, expression, dependencies) {
		for(let v of this.variables) {
			if(v.name === name && v.expression === expression) {
				return;
			}
		}
		this.variables.push(new DependenciesBlockVariable(name, expression, dependencies));
	}

	/**
	 * 为依赖块 , 添加它依赖的依赖实例
	 * @param {Dependency} dependency 
	 */
	addDependency(dependency) {
		this.dependencies.push(dependency);
	}

	/**
	 * 为Block的所有依赖 , 更新用于计算Hash的原始值
	 * @param {String} hash 
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
	 * 
	 * @param {*} filter 
	 */
	hasDependencies(filter) {
		if(filter) {
			if(this.dependencies.some(filter)) {
				return true;
			}
		} else {
			if(this.dependencies.length > 0) {
				return true;
			}
		}

		return this.blocks.concat(this.variables).some(item => item.hasDependencies(filter));
	}

  /**
   * 
   * @memberof DependenciesBlock
   */
	sortItems() {
		this.blocks.forEach(block => block.sortItems());
	}
}

module.exports = DependenciesBlock;
