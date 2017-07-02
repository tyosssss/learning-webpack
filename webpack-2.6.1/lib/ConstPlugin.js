/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
"use strict";
const ConstDependency = require("./dependencies/ConstDependency");
const NullFactory = require("./NullFactory");
const ParserHelpers = require("./ParserHelpers");

const getQuery = (request) => {
  const i = request.indexOf("?");
  return request.indexOf("?") < 0 ? "" : request.substr(i);
};

/**
 * 处理代码中遇到的直接量依赖的插件
 */
class ConstPlugin {
  apply(compiler) {
    compiler.plugin("compilation", (compilation, params) => {
      compilation.dependencyFactories.set(ConstDependency, new NullFactory());
      compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());

      params.normalModuleFactory.plugin("parser", parser => {
        /**
         * 处理 if 语句
         * 
         * if(<test>) <consequent>
         * else <alternate>
         */
        parser.plugin("statement if", function (statement) {
          // 运算条件表达式
          const param = this.evaluateExpression(statement.test);
          const bool = param.asBool();

          if (typeof bool === "boolean") {
            //
            // 优化代码 : 
            // 如果是能计算出来的布尔直接量 , 那么添加常量依赖 ( 直接使用结果替换表达式 )
            // 
            if (statement.test.type !== "Literal") {
              const dep = new ConstDependency(`${bool}`, param.range);
              dep.loc = statement.loc;
              this.state.current.addDependency(dep);
            }

            return bool;
          }
        });

        /**
         * 处理 ? : 表达式 -- 与if一致
         */
        parser.plugin("expression ?:", function (expression) {
          const param = this.evaluateExpression(expression.test);
          const bool = param.asBool();

          if (typeof bool === "boolean") {
            if (expression.test.type !== "Literal") {
              const dep = new ConstDependency(` ${bool}`, param.range);
              dep.loc = expression.loc;
              this.state.current.addDependency(dep);
            }
            return bool;
          }
        });

        parser.plugin("evaluate Identifier __resourceQuery", function (expr) {
          if (!this.state.module) return;
          return ParserHelpers.evaluateToString(getQuery(this.state.module.resource))(expr);
        });

        parser.plugin("expression __resourceQuery", function () {
          if (!this.state.module) return;

          // 添加变量依赖
          this.state.current.addVariable(
            "__resourceQuery",
            JSON.stringify(getQuery(this.state.module.resource))
          );

          return true;
        });
      });
    });
  }
}

module.exports = ConstPlugin;
