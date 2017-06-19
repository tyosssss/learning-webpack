/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var assign = require("object-assign");
var createInnerCallback = require("./createInnerCallback");
var getInnerRequest = require("./getInnerRequest");

/**
 * 处理别名 -- 将别名替换为真实的请求路径
 * @param {String} source 绑定的开始事件
 * @param {name : String , alias : String , onlyModule : Boolean} options 
 * @param {String} target 绑定的目标事件
 */
function AliasPlugin(source, options, target) {
	this.source = source;
	this.name = options.name;								// 别名
	this.alias = options.alias;							// 别名对应的真实路径
	this.onlyModule = options.onlyModule;		// true = 精准匹配; false = 非精准匹配
	this.target = target;
}
module.exports = AliasPlugin;

AliasPlugin.prototype.apply = function (resolver) {
	var target = this.target;
	var name = this.name;
	var alias = this.alias;
	var onlyModule = this.onlyModule;

	resolver.plugin(this.source, function (request, callback) {
		var innerRequest = getInnerRequest(resolver, request);

		if (!innerRequest) return callback();

		// 
		// 非精准匹配 , 请求路径中包含别名
		//  精准匹配 , 完全匹配请求路径
		// 
		if ((!onlyModule && innerRequest.indexOf(name + "/") === 0) ||
			innerRequest === name) {

			// 
			if (innerRequest.indexOf(alias + "/") !== 0 &&
				innerRequest != alias) {

				// 最终的请求 = 真实路径 + 别名之后的内容
				var newRequestStr = alias + innerRequest.substr(name.length);

				var obj = assign({}, request, {
					request: newRequestStr
				});

				return resolver.doResolve(
					target,
					obj,
					"aliased with mapping '" + name + "': '" + alias + "' to '" + newRequestStr + "'",
					createInnerCallback(function (err, result) {
						if (arguments.length > 0) return callback(err, result);

						// don't allow other aliasing or raw request
						callback(null, null);
					}, callback)
				);
			}
		}

		return callback();
	});
};
