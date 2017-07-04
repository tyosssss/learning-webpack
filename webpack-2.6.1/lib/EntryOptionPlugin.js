/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
	*/
"use strict";

const SingleEntryPlugin = require("./SingleEntryPlugin");
const MultiEntryPlugin = require("./MultiEntryPlugin");
const DynamicEntryPlugin = require("./DynamicEntryPlugin");

/**
 * 根据配置项config.entry , 注册对应的入口插件
 */
module.exports = class EntryOptionPlugin {
  apply(compiler) {
    compiler.plugin("entry-option", (context, entry) => {
      function itemToPlugin(item, name) {
        if (Array.isArray(item)) {
          return new MultiEntryPlugin(context, item, name);
        } else {
          return new SingleEntryPlugin(context, item, name);
        }
      }

      if (typeof entry === "string" || Array.isArray(entry)) {
        compiler.apply(itemToPlugin(entry, "main"));
      } else if (typeof entry === "object") {
        Object
          .keys(entry)
          .forEach(name =>
            compiler.apply(itemToPlugin(entry[name], name))
          );
      } else if (typeof entry === "function") {
        compiler.apply(new DynamicEntryPlugin(context, entry));
      }

      return true;
    });
  }
};
