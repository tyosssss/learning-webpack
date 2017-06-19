/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

/**
 * 读取包描述文件的内容
 * @param {String} source 绑定的开始事件
 * @param {String} message 消息
 * @param {String} target 绑定的目标事件
 */
function TryNextPlugin(source, message, target) {
	this.source = source;
	this.message = message;
	this.target = target;
}

module.exports = TryNextPlugin;

TryNextPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	var message = this.message;
	
	resolver.plugin(this.source, function(request, callback) {
		resolver.doResolve(target, request, message, callback);
	});
};
