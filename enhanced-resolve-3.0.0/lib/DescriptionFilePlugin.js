/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var assign = require("object-assign");
var DescriptionFileUtils = require("./DescriptionFileUtils");

/**
 * 读取包描述文件的内容
 * @param {*} source 
 * @param {*} filenames 
 * @param {*} target 
 */
function DescriptionFilePlugin(source, filenames, target) {
	this.source = source;
	this.filenames = [].concat(filenames);	// 包的描述文件
	this.target = target;
}
module.exports = DescriptionFilePlugin;

DescriptionFilePlugin.prototype.apply = function (resolver) {
	var filenames = this.filenames;
	var target = this.target;

	resolver.plugin(this.source, function (request, callback) {
		var fs = this.fileSystem;			// 文件系统
		var directory = request.path;	// 读取目录

		// 从path目录中读取描述文件
		DescriptionFileUtils.loadDescriptionFile(resolver, directory, filenames, function (err, result) {

			//
			// 处理异常
			//
			if (err) return callback(err);
			if (!result) {
				if (callback.missing) {
					filenames.forEach(function (filename) {
						callback.missing.push(resolver.join(directory, filename));
					})
				}

				if (callback.log) callback.log("No description file found");

				return callback();
			}

			var relativePath = "." +
				request.path
					.substr(result.directory.length)
					.replace(/\\/g, "/");

			var obj = assign({}, request, {
				descriptionFilePath: result.path,
				descriptionFileData: result.content,
				descriptionFileRoot: result.directory,
				relativePath: relativePath
			});

			resolver.doResolve(target, obj, "using description file: " + result.path + " (relative path: " + relativePath + ")", createInnerCallback(function (err, result) {
				if (err) return callback(err);
				if (result) return callback(null, result);

				// Don't allow other description files or none at all
				callback(null, null);
			}, callback));
		});
	});
};
