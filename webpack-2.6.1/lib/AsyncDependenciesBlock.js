/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const DependenciesBlock = require("./DependenciesBlock");

module.exports = class AsyncDependenciesBlock extends DependenciesBlock {
  /**
   * Creates an instance of AsyncDependenciesBlock.
   * @param {String} name 块名
   * @param {Module} module 模块
   * @param {SourceLocation} loc 模块的引用语句的位置
   */
  constructor(name, module, loc) {
    super();

    this.chunkName = name;
    this.chunks = null;
    this.module = module;
    this.loc = loc;
  }

  get chunk() {
    throw new Error("`chunk` was been renamed to `chunks` and is now an array");
  }

  set chunk(chunk) {
    throw new Error("`chunk` was been renamed to `chunks` and is now an array");
  }

  updateHash(hash) {
    let { chunkName, chunks } = this

    hash.update(chunkName || "");

    hash.update(
      chunks
        ? chunks.map((chunk) => chunk.id !== null ? chunk.id : "").join(",")
        : ""
    );

    super.updateHash(hash);
  }

  disconnect() {
    this.chunks = null;
    super.disconnect();
  }

  unseal() {
    this.chunks = null;
    super.unseal();
  }

  sortItems() {
    super.sortItems();
    
    // 属于某个块
    if (this.chunks) {
      this.chunks.sort((a, b) => {
        let i = 0;
        while (true) { // eslint-disable-line no-constant-condition
          if (!a.modules[i] && !b.modules[i]) return 0;
          if (!a.modules[i]) return -1;
          if (!b.modules[i]) return 1;
          if (a.modules[i].id > b.modules[i].id) return 1;
          if (a.modules[i].id < b.modules[i].id) return -1;
          i++;
        }
      });
    }
  }
};
