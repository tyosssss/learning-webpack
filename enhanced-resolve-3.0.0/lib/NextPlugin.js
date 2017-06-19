/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

/**
 * 读取包描述文件的内容
 * @param {String} source 绑定的开始事件
 * @param {String} target 绑定的目标事件
 */
function NextPlugin(source, target) {
	this.source = source;
	this.target = target;
}
module.exports = NextPlugin;

NextPlugin.prototype.apply = function(resolver) {
	var target = this.target;
	
	resolver.plugin(this.source, function(request, callback) {
		resolver.doResolve(target, request, null, callback);
	});
};
