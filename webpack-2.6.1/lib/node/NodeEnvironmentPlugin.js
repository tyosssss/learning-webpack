/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const NodeWatchFileSystem = require("./NodeWatchFileSystem");
const NodeOutputFileSystem = require("./NodeOutputFileSystem");
const NodeJsInputFileSystem = require("enhanced-resolve/lib/NodeJsInputFileSystem");
const CachedInputFileSystem = require("enhanced-resolve/lib/CachedInputFileSystem");

/**
 * 初始化Node环境的插件
 */
class NodeEnvironmentPlugin {
	apply(compiler) {
		const inputFileSystem = compiler.inputFileSystem = new CachedInputFileSystem(new NodeJsInputFileSystem(), 60000);
		compiler.outputFileSystem = new NodeOutputFileSystem();
		compiler.watchFileSystem = new NodeWatchFileSystem(compiler.inputFileSystem);

		compiler.plugin("before-run", (compiler, callback) => {
			if (compiler.inputFileSystem === inputFileSystem)
				inputFileSystem.purge();

			callback();
		});
	}
}
module.exports = NodeEnvironmentPlugin;
