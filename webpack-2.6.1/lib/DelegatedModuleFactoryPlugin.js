/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const DelegatedModule = require("./DelegatedModule");

/** 
 * @param {Object} options 选项
 * @param {String} options.source "dll-reference " + dll_name
 * @param {String} options.type 请求的类型 "require" , "object"
 * @param {String} options.context 上下文路径
 * @param {String} options.scope dll模块引用前缀
 * @param {Object} options.content dll编译信息
 */
class DelegatedModuleFactoryPlugin {
	constructor(options) {
		this.options = options;
		options.type = options.type || "require";
		options.extensions = options.extensions || ["", ".js"];
	}

	apply(normalModuleFactory) {
		const scope = this.options.scope;
		
		if(scope) {
			// 
			// scope 模式
			//
			normalModuleFactory.plugin("factory", factory => (data, callback) => {
				const dependency = data.dependencies[0];
				const request = dependency.request;
				
				/**
				 * 如果请求以scope为前缀 
				 * 
				 */
				if(request && request.indexOf(scope + "/") === 0) {
					/**
					 * scope = "abc"
					 * request = "abc/crocodile/a/b"
					 * innherRequest = "./crocodile/a/b"
					 */
					const innerRequest = "." + request.substr(scope.length);
					let resolved;
					
					// 从manifest中查找中 , 请求是否是dll中已经编译的
					if(innerRequest in this.options.content) {
						resolved = this.options.content[innerRequest];
						
						return callback(
							null, 
							new DelegatedModule(
								this.options.source, 	// sourceMap 
								resolved, 						// 编译之后的数据
								this.options.type, 		// 类型
								innerRequest					// 请求路径
							)
						);
					}

					//
					// 补全后缀之后再进行检索
					//
					for(let i = 0; i < this.options.extensions.length; i++) {
						const requestPlusExt = innerRequest + this.options.extensions[i];
						
						if(requestPlusExt in this.options.content) {
							resolved = this.options.content[requestPlusExt];
							return callback(null, new DelegatedModule(this.options.source, resolved, this.options.type, requestPlusExt));
						}
					}
				}

				return factory(data, callback);
			});
		} else {
			// 
			// module 模式
			//
			normalModuleFactory.plugin("module", module => {
				if(module.libIdent) {
					const request = module.libIdent(this.options);
					
					if(request && request in this.options.content) {
						const resolved = this.options.content[request];
						
						return new DelegatedModule(this.options.source, resolved, this.options.type, request);
					}
				}
				return module;
			});
		}
	}
}
module.exports = DelegatedModuleFactoryPlugin;
