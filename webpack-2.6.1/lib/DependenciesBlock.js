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
	 * 添加块
	 * @param {} block 
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
	 * 添加依赖
	 * @param {Dependency} dependency 
	 */
	addDependency(dependency) {
		this.dependencies.push(dependency);
	}

	/**
	 * 更新Hash
	 * @param {String} hash 
	 */
	updateHash(hash) {
		function updateHash(i) {
			i.updateHash(hash);
		}

		this.dependencies.forEach(updateHash);
		this.blocks.forEach(updateHash);
		this.variables.forEach(updateHash);
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

	sortItems() {
		this.blocks.forEach(block => block.sortItems());
	}
}

module.exports = DependenciesBlock;
