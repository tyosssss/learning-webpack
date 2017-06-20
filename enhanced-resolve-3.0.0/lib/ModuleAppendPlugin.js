/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var assign = require("object-assign");

/**
 * 为模块请求路径添加扩展名
 * @param {String} source 绑定的开始事件
 * @param {String} appending 后缀
 * @param {String} target 绑定的目标事件
 */
function ModuleAppendPlugin(source, appending, target) {
	this.source = source;
	this.appending = appending;
	this.target = target;
}

module.exports = ModuleAppendPlugin;

ModuleAppendPlugin.prototype.apply = function (resolver) {
	var appending = this.appending;
	var target = this.target;

	resolver.plugin(this.source, function (request, callback) {
		var
			i = request.request.indexOf("/"),
			j = request.request.indexOf("\\");

		var p = i < 0
			? j
			: j < 0
				? i
				: i < j
					? i
					: j;

		var moduleName, remainingRequest;

		// 
		// 获得模块名
		// 获得模块请求路径
		//
		if (p < 0) {
			moduleName = request.request;
			remainingRequest = "";
		} else {
			moduleName = request.request.substr(0, p);
			remainingRequest = request.request.substr(p);
		}

		if (moduleName === "." || moduleName === "..") return callback();

		var moduleFinalName = moduleName + appending;

		var obj = assign({}, request, {
			request: moduleFinalName + remainingRequest
		});

		resolver.doResolve(
			target,
			obj,
			"module variation " + moduleFinalName,
			callback
		);
	});
};
