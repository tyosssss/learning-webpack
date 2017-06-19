/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const DelegatedSourceDependency = require("./dependencies/DelegatedSourceDependency");
const DelegatedModuleFactoryPlugin = require("./DelegatedModuleFactoryPlugin");
const ExternalModuleFactoryPlugin = require("./ExternalModuleFactoryPlugin");

/**
 * 引用dll
 * @param {Object} options
 * @param {String} options.manifest dll的模块清单
 */
class DllReferencePlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compiler) {
		compiler.plugin("compilation", (compilation, params) => {
			const normalModuleFactory = params.normalModuleFactory;
			compilation.dependencyFactories.set(DelegatedSourceDependency, normalModuleFactory);
		});

		compiler.plugin("before-compile", (params, callback) => {
			const manifest = this.options.manifest;
			
      // 读取 manifest
      if(typeof manifest === "string") {
				params.compilationDependencies.push(manifest);
				
        compiler.inputFileSystem.readFile(manifest, function(err, result) {
					if(err) return callback(err);
					params["dll reference " + manifest] = JSON.parse(result.toString("utf-8"));
					return callback();
				});
			} else {
				return callback();
			}
		});

		compiler.plugin("compile", (params) => {
			let manifest = this.options.manifest;
			
			if(typeof manifest === "string") {
				manifest = params["dll reference " + manifest];
			}

			const name = this.options.name || manifest.name;
			const sourceType = this.options.sourceType || "var";
			const externals = {};
			const source = "dll-reference " + name;
			
      externals[source] = name;

			// 
			// add 插件
			// 1. ExternalModuleFactoryPlugin -- 将dll导出为外部模块
			// 2. DelegatedModuleFactoryPlugin
			//
			params.normalModuleFactory.apply(new ExternalModuleFactoryPlugin(sourceType, externals));
			params.normalModuleFactory.apply(new DelegatedModuleFactoryPlugin({
				source: source,
				type: this.options.type,
				scope: this.options.scope,
				context: this.options.context || compiler.options.context,
				content: this.options.content || manifest.content,
				extensions: this.options.extensions
			}));
		});
	}
}

module.exports = DllReferencePlugin;
