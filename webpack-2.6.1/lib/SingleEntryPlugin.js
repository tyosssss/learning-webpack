/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const SingleEntryDependency = require("./dependencies/SingleEntryDependency");

/**
 * 处理单文件入口
 * 
 * @class SingleEntryPlugin
 */
class SingleEntryPlugin {
  constructor(context, entry, name) {
    this.context = context; // 上下文的路径
    this.entry = entry;     // 入口文件路径 
    this.name = name;       // 入口名称 
  }

  apply(compiler) {

    /**
     * 添加模块工厂与依赖的映射
     */
    compiler.plugin("compilation", (compilation, params) => {
      const normalModuleFactory = params.normalModuleFactory;
      compilation.dependencyFactories.set(SingleEntryDependency, normalModuleFactory);
    });

    /**
     * 1. 创建单入口模块依赖
		 * 2. 将入口模块依赖添加到compilation中
     */
    compiler.plugin("make", (compilation, callback) => {
      const dep = SingleEntryPlugin.createDependency(this.entry, this.name);
      
      compilation.addEntry(this.context, dep, this.name, callback);
    });
  }

  static createDependency(entry, name) {
    const dep = new SingleEntryDependency(entry);
    dep.loc = name;

    return dep;
  }
}

module.exports = SingleEntryPlugin;
