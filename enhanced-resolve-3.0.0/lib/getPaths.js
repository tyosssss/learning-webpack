/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function popPathSeqment(pathInArray) {
	var
		i = pathInArray[0].lastIndexOf("/"),
		j = pathInArray[0].lastIndexOf("\\");

	var p = 
		i < 0 
			? j 
			: j < 0 
				? i 
				: i < j 
					? j 
					: i;

	if (p < 0) return null;
	
	var s = pathInArray[0].substr(p + 1);
	pathInArray[0] = pathInArray[0].substr(0, p || 1);
	
	return s;
}

/**
 * 获得path路径所有的可能的路径层级以及路径片段
 * 
 * @example
 * 
 * getPaths('examples/dll-plugin/src/main.js')
 * 
 * {
 * 	paths:[
 * 		"examples/dll-plugin/src/main.js",
 * 		"examples/dll-plugin/src",
 * 		"examples/dll-plugin"
 * 		"examples"
 * 	],
 * 	pathSeqment:[
 * 		"main.js",
 * 		"src",
 * 		"dll-plugin",
 * 		"examples"
 * 	]
 * }
 * 
 * @param {String} path 路径
 * @returns {paths:String[] , pathSeqments:String}
 */
module.exports = function getPaths(path) {
	var paths = [path];
	var pathSeqments = [];
	var addr = [path];		// 利用数组引用特性 , 返回两个值
	var pathSeqment = popPathSeqment(addr);

	while (pathSeqment) {
		pathSeqments.push(pathSeqment);
		paths.push(addr[0]);
		pathSeqment = popPathSeqment(addr);
	}

	pathSeqments.push(paths[paths.length - 1]);

	return {
		paths: paths,
		seqments: pathSeqments
	};
};

module.exports.basename = function basename(path) {
	return popPathSeqment([path]);
}
