/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

/**
 * 使用iterator遍历数组
 * 
 * 保证数组都会遍历到 , 优先使用数组中排名考前的返回值
 * 
 * @param {Array} array
 * @param {Function} iterator 迭代器
 * @param {Function} callback 
 */
module.exports = function forEachBail(array, iterator, callback) {
	if (array.length == 0) return callback();

	var currentPos = array.length;
	var currentResult;
	var done = [];

	for (var i = 0; i < array.length; i++) {
		var itCb = createIteratorCallback(i);

		iterator(array[i], itCb);

		if (currentPos == 0)
			break;
	}

	function createIteratorCallback(i) {
		return function () {
			
			if (i >= currentPos) return; // ignore
			
			var args = Array.prototype.slice.call(arguments);
			done.push(i);
			
			if (args.length > 0) {
				currentPos = i + 1;
				done = done.filter(function (item) {
					return item <= i;
				});
				currentResult = args;
			}

			if (done.length == currentPos) {
				callback.apply(null, currentResult);
				currentPos = 0;
			}
		};
	}
};
