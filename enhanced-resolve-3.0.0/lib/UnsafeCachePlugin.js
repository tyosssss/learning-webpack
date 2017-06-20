/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var assign = require("object-assign");

/**
 * 缓存解析结果
 * @param {String} source 绑定的开始事件
 * @param {Function} filterPredicate 返回fales表示无需缓存
 * @param {Object} cache 缓存的解析结果
 * @param {String} target 绑定的目标事件
 */
function UnsafeCachePlugin(source, filterPredicate, cache, target) {
	this.source = source;
	this.filterPredicate = filterPredicate;
	this.cache = cache || {};
	this.target = target;
}

module.exports = UnsafeCachePlugin;

function getCacheId(request) {
	return JSON.stringify({
		context: request.context,
		path: request.path,
		query: request.query,
		request: request.request
	});
}

UnsafeCachePlugin.prototype.apply = function (resolver) {
	var filterPredicate = this.filterPredicate;
	var cache = this.cache;
	var target = this.target;

	resolver.plugin(
		this.source,
		function (request, callback) {

			// 如果返回false , 那么不缓存
			if (!filterPredicate(request)) return callback();

			var cacheId = getCacheId(request);
			var cacheEntry = cache[cacheId];

			// 已经缓存 , 直接使用缓存
			if (cacheEntry) {
				return callback(null, cacheEntry);
			}

			resolver.doResolve(
				target,
				request,
				null,

				/**
				 * 当after-resolve执行完毕,返回最终的解析结果
				 * @param {Error} err 
				 * @param {ResolverRequest} result 
				 */
				createInnerCallback(function done(err, result) {
					if (err) return callback(err);
					if (result) return callback(null, cache[cacheId] = result);

					callback();
				}, callback));
		});
};
