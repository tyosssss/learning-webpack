/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var forEachBail = require("./forEachBail");
var getPaths = require("./getPaths");
var assign = require("object-assign");

/**
 * 模拟node node_modules解析方式 , 从上下文目录开始,从内到外逐一查找指定目录中的模块内容
 * @param {String} source 绑定的开始事件
 * @param {String[]} directories 
 * @param {String} target 绑定的目标事件
 */
function ModulesInHierachicDirectoriesPlugin(source, directories, target) {
	this.source = source;
	this.directories = [].concat(directories);
	this.target = target;
}

module.exports = ModulesInHierachicDirectoriesPlugin;

ModulesInHierachicDirectoriesPlugin.prototype.apply = function (resolver) {
	var directories = this.directories;
	var target = this.target;

	resolver.plugin(this.source, function (request, callback) {
		var fs = this.fileSystem;
		var topLevelCallback = callback;

		// 
		var addrs =
			getPaths(request.path)
				.paths																						// 从请求的上下文路径开始的所有目录片段 ['path/to' , 'path']
				.map(p => directories.map(d => this.join(p, d)))	// 添加模块目录名 [ ['path/to/node_modules'] , ['path/node_modules'] 
				.reduce((array, p) => {														// 二维 --> 一维 ['path/to/node_modules' , 'path/node_modules']
					array.push.apply(array, p);
					return array;
				},
				[]);

		forEachBail(addrs, function (addr, callback) {

			// 
			// 判断目录是否存在
			// 优先级 : 优先使用 离请求层级最近的目录 
			//
			fs.stat(addr, function (err, stat) {
				if (!err && stat && stat.isDirectory()) {
					var obj = assign({}, request, {
						path: addr,
						request: "./" + request.request
					});
					var message = "looking for modules in " + addr;

					return resolver.doResolve(
						target,
						obj,
						message,
						createInnerCallback(callback, topLevelCallback)
					);
				}

				if (topLevelCallback.log)
					topLevelCallback.log(addr + " doesn't exist or is not a directory");

				if (topLevelCallback.missing)
					topLevelCallback.missing.push(addr);

				return callback();
			});
		}, callback);
	});
};
