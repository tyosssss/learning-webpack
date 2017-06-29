/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const ConstDependency = require("./ConstDependency");
const CommonJsRequireDependency = require("./CommonJsRequireDependency");
const CommonJsRequireContextDependency = require("./CommonJsRequireContextDependency");
const RequireResolveDependency = require("./RequireResolveDependency");
const RequireResolveContextDependency = require("./RequireResolveContextDependency");
const RequireResolveHeaderDependency = require("./RequireResolveHeaderDependency");
const RequireHeaderDependency = require("./RequireHeaderDependency");

const NullFactory = require("../NullFactory");

const RequireResolveDependencyParserPlugin = require("./RequireResolveDependencyParserPlugin");
const CommonJsRequireDependencyParserPlugin = require("./CommonJsRequireDependencyParserPlugin");

const ParserHelpers = require("../ParserHelpers");

/**
 * 解析 CommonJS规范 "require , require.resolve , require.resolveWeak" 的插件
 * 
 * @class CommonJsPlugin
 */
class CommonJsPlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    const options = this.options;

    compiler.plugin("compilation", (compilation, params) => {
      /**
       * 添加依赖工厂和依赖模板实例 ==> Compilation
       */
      const normalModuleFactory = params.normalModuleFactory;
      const contextModuleFactory = params.contextModuleFactory;

      compilation.dependencyFactories.set(CommonJsRequireDependency, normalModuleFactory);
      compilation.dependencyTemplates.set(CommonJsRequireDependency, new CommonJsRequireDependency.Template());

      compilation.dependencyFactories.set(CommonJsRequireContextDependency, contextModuleFactory);
      compilation.dependencyTemplates.set(CommonJsRequireContextDependency, new CommonJsRequireContextDependency.Template());

      compilation.dependencyFactories.set(RequireResolveDependency, normalModuleFactory);
      compilation.dependencyTemplates.set(RequireResolveDependency, new RequireResolveDependency.Template());

      compilation.dependencyFactories.set(RequireResolveContextDependency, contextModuleFactory);
      compilation.dependencyTemplates.set(RequireResolveContextDependency, new RequireResolveContextDependency.Template());

      compilation.dependencyFactories.set(RequireResolveHeaderDependency, new NullFactory());
      compilation.dependencyTemplates.set(RequireResolveHeaderDependency, new RequireResolveHeaderDependency.Template());

      compilation.dependencyFactories.set(RequireHeaderDependency, new NullFactory());
      compilation.dependencyTemplates.set(RequireHeaderDependency, new RequireHeaderDependency.Template());



      /**
       * 绑定Parser事件 -- 解析代码
       */
      params.normalModuleFactory.plugin("parser", (parser, parserOptions) => {
        if (typeof parserOptions.commonjs !== "undefined" && !parserOptions.commonjs) {
          return;
        }

        const requireExpressions = ["require", "require.resolve", "require.resolveWeak"];
        
        /**
         * 劫持 求值 typedef require , require.resolve , require.resolveWeak
         * 返回 "function"
         */
        for (let expression of requireExpressions) {
          parser.plugin(`typeof ${expression}`, ParserHelpers.toConstantDependency("function"));
          parser.plugin(`evaluate typeof ${expression}`, ParserHelpers.evaluateToString("function"));
        }

        /**
         * 劫持 求值 typedef module
         * 返回 "object"
         */
        parser.plugin("evaluate typeof module", ParserHelpers.evaluateToString("object"));
        
        /**
         * 劫持 求值 ... = require
         * 1. 在作用域中添加 "require" 
         * 2. 添加常量模块 , 用于替换var require
         */
        parser.plugin("assign require", (expr) => {
          // to not leak to global "require", we need to define a local require here.
          const dep = new ConstDependency("var require;", 0);
          dep.loc = expr.loc;
          
          parser.state.current.addDependency(dep);
          parser.scope.definitions.push("require");
          
          return true;
        });

        parser.plugin("can-rename require", () => true);

        parser.plugin("rename require", (expr) => {
          // define the require variable. It's still undefined, but not "not defined".
          const dep = new ConstDependency("var require;", 0);
          dep.loc = expr.loc;
          parser.state.current.addDependency(dep);
          return false;
        });

        parser.plugin("typeof module", () => true);

        parser.plugin("evaluate typeof exports", ParserHelpers.evaluateToString("object"));

        parser.apply(
          new CommonJsRequireDependencyParserPlugin(options),
          new RequireResolveDependencyParserPlugin(options)
        );
      });
    });
  }
}
module.exports = CommonJsPlugin;
