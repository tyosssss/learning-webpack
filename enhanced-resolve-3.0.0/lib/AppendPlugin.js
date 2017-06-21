/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");

/**
 * 向路径追加指定路径
 * @param {String} source 绑定的开始事件
 * @param {String} appending 追加路径
 * @param {String} target 绑定的目标事件
 */
function AppendPlugin(source, appending, target) {
  this.source = source;
  this.appending = appending;
  this.target = target;
}
module.exports = AppendPlugin;

AppendPlugin.prototype.apply = function (resolver) {
  var target = this.target;
  var appending = this.appending;

  resolver.plugin(this.source, function (request, callback) {
    var obj = assign({}, request, {
      path: request.path + appending,
      relativePath: request.relativePath && (request.relativePath + appending)
    });

    resolver.doResolve(target, obj, appending, callback);
  });
};
