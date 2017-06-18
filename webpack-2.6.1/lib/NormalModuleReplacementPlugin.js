/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");

class NormalModuleReplacementPlugin {
	constructor(resourceRegExp, newResource) {
		this.resourceRegExp = resourceRegExp;
		this.newResource = newResource;
	}

	apply(compiler) {
		const resourceRegExp = this.resourceRegExp;
		const newResource = this.newResource;

		compiler.plugin("normal-module-factory", (nmf) => {

			nmf.plugin("before-resolve", (result, callback) => {
				if (!result) return callback();

				if (resourceRegExp.test(result.request)) {
					// 替换资源的请求路径
					if (typeof newResource === "function") {
						newResource(result);
					} else {
						result.request = newResource;
					}
				}

				return callback(null, result);
			});

			nmf.plugin("after-resolve", (result, callback) => {
				if (!result)
					return callback();

				if (resourceRegExp.test(result.resource)) {
					// 替换资源路径
					if (typeof newResource === "function") {
						newResource(result);
					} else {
						result.resource = path.resolve(
							path.dirname(result.resource),
							newResource
						);
					}
				}
				return callback(null, result);
			});
		});
	}
}

module.exports = NormalModuleReplacementPlugin;
