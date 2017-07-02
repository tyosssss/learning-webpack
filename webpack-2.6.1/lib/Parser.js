/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
"use strict";

// Syntax: https://developer.mozilla.org/en/SpiderMonkey/Parser_API
const acorn = require("acorn-dynamic-import").default;
const Tapable = require("tapable");
const json5 = require("json5");
const BasicEvaluatedExpression = require("./BasicEvaluatedExpression");

/**
 * 解析器状态
 * @typedef {Object} ParserState
 * @proprety {Compilation} compilation 编译实例
 * @property {Module|Dependency} current 正在使用的模块和依赖 ( 发现的模块和依赖会添加到current中 )
 * @property {Module} module 模块
 * @property {Object} options webpack的所有配置
 * @property {} localModules
 */

/**
 * 解析器的作用域 -- 表示遍历代码时的作用域
 * @typedef {Object} ParserScope
 * @property {String[]} definitions 存储所有的声明定义的名称 -- 变量名,常量名,函数名,类名,函数参数
 * @property {Map<name : String , rename: String>} renames 存储标志符与别名的映射
 * @property {Boolean} [inTry=false] 作用域是否在try语句中
 * @property {Boolean} [inShorthand=false] 作用域是否在对象的简写函数中
 */

/**
 * 
 * @param {Number} startRange 
 * @param {Number} endRange 
 */
function joinRanges(startRange, endRange) {
  if (!endRange) return startRange;
  if (!startRange) return endRange;
  return [startRange[0], endRange[1]];
}

const POSSIBLE_AST_OPTIONS = [
  {
    ranges: true,
    locations: true,
    ecmaVersion: 2017,
    sourceType: "module",
    plugins: {
      dynamicImport: true
    }
  },
  {
    ranges: true,
    locations: true,
    ecmaVersion: 2017,
    sourceType: "script",
    plugins: {
      dynamicImport: true
    }
  }
];

/**
 * Parser
 */
class Parser extends Tapable {
  constructor(options) {
    super();

    /**
     * 解析器选项 ( config.module.rules.parser )
     * @type {Object}
     */
    this.options = options;

    /**
     * 解析的器作用域
     * @type {}ParserScope
     */
    this.scope = undefined;

    /** 
     * 当前解析器的状态
     * @type {ParserState} 
     */
    this.state = undefined;

    /**
     * 存储代码中的所有注释
     * @type {Object[]}
     */
    this.comments = undefined;

    /**
     * 初始化执行器
     */
    this.initializeEvaluating();
  }

  /**
   * 初始化执行器
   */
  initializeEvaluating() {
    /**
     * 模拟对"直接量"的求值过程 , 根据表达式类型 , 返回相应的表达式结果
     * -- Number
     * -- String
     * -- Boolean
     * -- RegExp
     * -- null
     */
    this.plugin("evaluate Literal", expr => {
      /**
       * 如果直接量的类型是Number , String , Boolean 直接返回相应的结果实例
       */
      switch (typeof expr.value) {
        case "number":
          return new BasicEvaluatedExpression().setNumber(expr.value).setRange(expr.range);
        case "string":
          return new BasicEvaluatedExpression().setString(expr.value).setRange(expr.range);
        case "boolean":
          return new BasicEvaluatedExpression().setBoolean(expr.value).setRange(expr.range);
      }

      // null
      if (expr.value === null)
        return new BasicEvaluatedExpression().setNull().setRange(expr.range);

      // RegExp
      if (expr.value instanceof RegExp)
        return new BasicEvaluatedExpression().setRegExp(expr.value).setRange(expr.range);
    });

    /**
     * 模拟对"逻辑表达式"的求值过程
     */
    this.plugin("evaluate LogicalExpression", function (expr) {
      let left;
      let leftAsBool;
      let right;

      if (expr.operator === "&&") {
        // 左值求值
        left = this.evaluateExpression(expr.left);
        leftAsBool = left && left.asBool();

        // 左值结果 = false    模拟断点机制不继续执行 , 将左值的结果设置为表达式的结果
        // 左值结果 = 不是布尔  返回undefined
        if (leftAsBool === false) return left.setRange(expr.range);
        if (leftAsBool !== true) return;

        // 右值求值
        right = this.evaluateExpression(expr.right);

        // 将右值的结果设置为表达式的结果
        return right.setRange(expr.range);
      } else if (expr.operator === "||") {
        // 与 && 类似
        left = this.evaluateExpression(expr.left);
        leftAsBool = left && left.asBool();

        if (leftAsBool === true) return left.setRange(expr.range);
        if (leftAsBool !== false) return;

        right = this.evaluateExpression(expr.right);

        return right.setRange(expr.range);
      }
    });

    /**
     * 对"二元表达式"的求值过程
     */
    this.plugin("evaluate BinaryExpression", function (expr) {
      let left;
      let right;
      let res;

      if (expr.operator === "+") { // 加法
        // 
        // 左右部分分别求值
        //
        left = this.evaluateExpression(expr.left);
        right = this.evaluateExpression(expr.right);

        // 左值或右值部分无效 , 那么结果执行
        if (!left || !right) return;

        res = new BasicEvaluatedExpression();

        /**
         * 根据类型 , 分别对其进行相应的求值操作
         */
        if (left.isString()) {
          if (right.isString()) {
            // string + string
            res.setString(left.string + right.string);
          } else if (right.isNumber()) {
            // string + number
            res.setString(left.string + right.number);
          } else if (
            right.isWrapped() &&
            right.prefix &&
            right.prefix.isString()
          ) {
            res.setWrapped(
              new BasicEvaluatedExpression()
                .setString(left.string + right.prefix.string)
                .setRange(joinRanges(left.range, right.prefix.range)),
              right.postfix);
          } else if (right.isWrapped()) {
            res.setWrapped(
              new BasicEvaluatedExpression()
                .setString(left.string)
                .setRange(left.range),
              right.postfix);
          } else {
            res.setWrapped(left, null);
          }
        } else if (left.isNumber()) {
          if (right.isString()) {
            // number + string
            res.setString(left.number + right.string);
          } else if (right.isNumber()) {
            // number + number
            res.setNumber(left.number + right.number);
          }
        } else if (left.isWrapped()) {
          if (
            left.postfix &&
            left.postfix.isString() &&
            right.isString()
          ) {
            res.setWrapped(
              left.prefix,
              new BasicEvaluatedExpression()
                .setString(left.postfix.string + right.string)
                .setRange(joinRanges(left.postfix.range, right.range))
            );
          } else if (
            left.postfix &&
            left.postfix.isString() &&
            right.isNumber()
          ) {
            res.setWrapped(
              left.prefix,
              new BasicEvaluatedExpression()
                .setString(left.postfix.string + right.number)
                .setRange(joinRanges(left.postfix.range, right.range))
            );
          } else if (right.isString()) {
            res.setWrapped(left.prefix, right);
          } else if (right.isNumber()) {
            res.setWrapped(
              left.prefix,
              new BasicEvaluatedExpression()
                .setString(right.number + "")
                .setRange(right.range));
          } else {
            res.setWrapped(left.prefix, new BasicEvaluatedExpression());
          }
        } else {
          // null + string
          // undefined + string
          // boolean + string
          // object + string
          // array + string
          if (right.isString()) {
            res.setWrapped(null, right);
          }
        }

        res.setRange(expr.range);

        return res;
      } else if (expr.operator === "-") {
        left = this.evaluateExpression(expr.left);
        right = this.evaluateExpression(expr.right);
        
        if (!left || !right) return;
        if (!left.isNumber() || !right.isNumber()) return;
        
        res = new BasicEvaluatedExpression();
        res.setNumber(left.number - right.number);
        res.setRange(expr.range);
        
        return res;
      } else if (expr.operator === "*") {
        left = this.evaluateExpression(expr.left);
        right = this.evaluateExpression(expr.right);
        
        if (!left || !right) return;
        if (!left.isNumber() || !right.isNumber()) return;
        
        res = new BasicEvaluatedExpression();
        res.setNumber(left.number * right.number);
        res.setRange(expr.range);
        
        return res;
      } else if (expr.operator === "/") {
        left = this.evaluateExpression(expr.left);
        right = this.evaluateExpression(expr.right);
        
        if (!left || !right) return;
        if (!left.isNumber() || !right.isNumber()) return;
        
        res = new BasicEvaluatedExpression();
        res.setNumber(left.number / right.number);
        res.setRange(expr.range);
        
        return res;
      } else if (expr.operator === "==" || expr.operator === "===") {
        left = this.evaluateExpression(expr.left);
        right = this.evaluateExpression(expr.right);
        
        if (!left || !right) return;
        
        res = new BasicEvaluatedExpression();
        res.setRange(expr.range);
        
        if (left.isString() && right.isString()) {
          return res.setBoolean(left.string === right.string);
        } else if (left.isNumber() && right.isNumber()) {
          return res.setBoolean(left.number === right.number);
        } else if (left.isBoolean() && right.isBoolean()) {
          return res.setBoolean(left.bool === right.bool);
        }
      } else if (expr.operator === "!=" || expr.operator === "!==") {
        left = this.evaluateExpression(expr.left);
        right = this.evaluateExpression(expr.right);
        
        if (!left || !right) return;
        res = new BasicEvaluatedExpression();
        res.setRange(expr.range);
        
        if (left.isString() && right.isString()) {
          return res.setBoolean(left.string !== right.string);
        } else if (left.isNumber() && right.isNumber()) {
          return res.setBoolean(left.number !== right.number);
        } else if (left.isBoolean() && right.isBoolean()) {
          return res.setBoolean(left.bool !== right.bool);
        }
      }
    });

    /**
     * 对"一元表达式"的求值过程 
     */
    this.plugin("evaluate UnaryExpression", function (expr) {
      if (expr.operator === "typeof") {
        let res;
        let name;
        
        if (expr.argument.type === "Identifier") {
          name = this.scope.renames["$" + expr.argument.name] || expr.argument.name;
          if (this.scope.definitions.indexOf(name) === -1) {
            res = this.applyPluginsBailResult1("evaluate typeof " + name, expr);
            if (res !== undefined) return res;
          }
        }

        if (expr.argument.type === "MemberExpression") {
          let expression = expr.argument;
          let exprName = [];
          while (expression.type === "MemberExpression" && !expression.computed) {
            exprName.unshift(this.scope.renames["$" + expression.property.name] || expression.property.name);
            expression = expression.object;
          }

          if (expression.type === "Identifier") {
            exprName.unshift(this.scope.renames["$" + expression.name] || expression.name);
            if (this.scope.definitions.indexOf(name) === -1) {
              exprName = exprName.join(".");
              res = this.applyPluginsBailResult1("evaluate typeof " + exprName, expr);
              if (res !== undefined) return res;
            }
          }
        }

        if (expr.argument.type === "FunctionExpression") {
          return new BasicEvaluatedExpression().setString("function").setRange(expr.range);
        }

        const arg = this.evaluateExpression(expr.argument);
        if (arg.isString() || arg.isWrapped()) return new BasicEvaluatedExpression().setString("string").setRange(expr.range);
        else if (arg.isNumber()) return new BasicEvaluatedExpression().setString("number").setRange(expr.range);
        else if (arg.isBoolean()) return new BasicEvaluatedExpression().setString("boolean").setRange(expr.range);
        else if (arg.isArray() || arg.isConstArray() || arg.isRegExp()) return new BasicEvaluatedExpression().setString("object").setRange(expr.range);
      } else if (expr.operator === "!") {
        const argument = this.evaluateExpression(expr.argument);
        if (!argument) return;
        
        if (argument.isBoolean()) {
          return new BasicEvaluatedExpression().setBoolean(!argument.bool).setRange(expr.range);
        } else if (argument.isString()) {
          return new BasicEvaluatedExpression().setBoolean(!argument.string).setRange(expr.range);
        } else if (argument.isNumber()) {
          return new BasicEvaluatedExpression().setBoolean(!argument.number).setRange(expr.range);
        }
      }
    });

    /**
     * 对"typedef undefined"的求值过程 
     */
    this.plugin("evaluate typeof undefined", function (expr) {
      return new BasicEvaluatedExpression().setString("undefined").setRange(expr.range);
    });

    /**
     * 对"标志符"的求值过程
     */
    this.plugin("evaluate Identifier", function (expr) {
      // 获得标志符的名称 , 优先使用标志符的别名
      const name = this.scope.renames["$" + expr.name] || expr.name;

      // 如果 作用域中没有定义该标志 , 触发"evaluate Identifier [name]" , 进行求值操作
      // 否则 直接返回结果
      if (this.scope.definitions.indexOf(expr.name) === -1) {
        const result = this.applyPluginsBailResult1("evaluate Identifier " + name, expr);

        if (result) return result;
        return new BasicEvaluatedExpression().setIdentifier(name).setRange(expr.range);
      } else {
        return this.applyPluginsBailResult1("evaluate defined Identifier " + name, expr);
      }
    });

    /**
     * 对"访问对象表达式"的求值过程 
     */
    this.plugin("evaluate MemberExpression", function (expression) {
      let expr = expression;
      let exprName = [];
      
      while (expr.type === "MemberExpression" && expr.property.type === (expr.computed ? "Literal" : "Identifier")) {
        exprName.unshift(expr.property.name || expr.property.value);
        expr = expr.object;
      }

      if (expr.type === "Identifier") {
        const name = this.scope.renames["$" + expr.name] || expr.name;
        if (this.scope.definitions.indexOf(name) === -1) {
          exprName.unshift(name);
          exprName = exprName.join(".");
          if (this.scope.definitions.indexOf(expr.name) === -1) {
            const result = this.applyPluginsBailResult1("evaluate Identifier " + exprName, expression);
            if (result) return result;
            return new BasicEvaluatedExpression().setIdentifier(exprName).setRange(expression.range);
          } else {
            return this.applyPluginsBailResult1("evaluate defined Identifier " + exprName, expression);
          }
        }
      }
    });

    /**
     * 对"函数调用表达式"的求值过程 -- 处理链接调用 ( a.b.c() )
     */
    this.plugin("evaluate CallExpression", function (expr) {
      if (expr.callee.type !== "MemberExpression") return;
      if (expr.callee.property.type !== (expr.callee.computed ? "Literal" : "Identifier")) return;
      
      const param = this.evaluateExpression(expr.callee.object);
      if (!param) return;
      
      const property = expr.callee.property.name || expr.callee.property.value;
      return this.applyPluginsBailResult("evaluate CallExpression ." + property, expr, param);
    });

    /**
     * 对"调用.replace方法"的求值过程
     */
    this.plugin("evaluate CallExpression .replace", function (expr, param) {
      if (!param.isString()) return;
      if (expr.arguments.length !== 2) return;
      
      let arg1 = this.evaluateExpression(expr.arguments[0]);
      let arg2 = this.evaluateExpression(expr.arguments[1]);
      
      if (!arg1.isString() && !arg1.isRegExp()) return;
      arg1 = arg1.regExp || arg1.string;
      
      if (!arg2.isString()) return;
      arg2 = arg2.string;
      
      return new BasicEvaluatedExpression().setString(param.string.replace(arg1, arg2)).setRange(expr.range);
    });

    /**
     * 对"substr,sbustring方法"的求值过程
     */
    ["substr", "substring"].forEach(fn => {
      this.plugin("evaluate CallExpression ." + fn, function (expr, param) {
        if (!param.isString()) return;
        let arg1;
        let result, str = param.string;
        switch (expr.arguments.length) {
          case 1:
            arg1 = this.evaluateExpression(expr.arguments[0]);
            if (!arg1.isNumber()) return;
            result = str[fn](arg1.number);
            break;
          case 2:
            {
              arg1 = this.evaluateExpression(expr.arguments[0]);
              const arg2 = this.evaluateExpression(expr.arguments[1]);
              if (!arg1.isNumber()) return;
              if (!arg2.isNumber()) return;
              result = str[fn](arg1.number, arg2.number);
              break;
            }
          default:
            return;
        }
        return new BasicEvaluatedExpression().setString(result).setRange(expr.range);
      });

      /**
       * @param {string} kind "cooked" | "raw"
       * @param {any[]} quasis quasis
       * @param {any[]} expressions expressions
       * @return {BasicEvaluatedExpression[]} Simplified template
       */
      function getSimplifiedTemplateResult(kind, quasis, expressions) {
        const parts = [];

        for (let i = 0; i < quasis.length; i++) {
          parts.push(new BasicEvaluatedExpression().setString(quasis[i].value[kind]).setRange(quasis[i].range));

          if (i > 0) {
            const prevExpr = parts[parts.length - 2],
              lastExpr = parts[parts.length - 1];
            const expr = this.evaluateExpression(expressions[i - 1]);
            if (!(expr.isString() || expr.isNumber())) continue;

            prevExpr.setString(prevExpr.string + (expr.isString() ? expr.string : expr.number) + lastExpr.string);
            prevExpr.setRange([prevExpr.range[0], lastExpr.range[1]]);
            parts.pop();
          }
        }
        return parts;
      }

      this.plugin("evaluate TemplateLiteral", function (node) {
        const parts = getSimplifiedTemplateResult.call(this, "cooked", node.quasis, node.expressions);
        if (parts.length === 1) {
          return parts[0].setRange(node.range);
        }
        return new BasicEvaluatedExpression().setTemplateString(parts).setRange(node.range);
      });
      this.plugin("evaluate TaggedTemplateExpression", function (node) {
        if (this.evaluateExpression(node.tag).identifier !== "String.raw") return;
        const parts = getSimplifiedTemplateResult.call(this, "raw", node.quasi.quasis, node.quasi.expressions);
        return new BasicEvaluatedExpression().setTemplateString(parts).setRange(node.range);
      });
    });

    /**
     * 对"split方法"的求值过程
     */
    this.plugin("evaluate CallExpression .split", function (expr, param) {
      if (!param.isString()) return;
      if (expr.arguments.length !== 1) return;
      let result;
      const arg = this.evaluateExpression(expr.arguments[0]);
      if (arg.isString()) {
        result = param.string.split(arg.string);
      } else if (arg.isRegExp()) {
        result = param.string.split(arg.regExp);
      } else return;
      return new BasicEvaluatedExpression().setArray(result).setRange(expr.range);
    });

    /**
     * 对"三元表达式"的求值过程 , 返回求值结果
     */
    this.plugin("evaluate ConditionalExpression", function (expr) {
      // 对条件进行求值
      const condition = this.evaluateExpression(expr.test);
      const conditionValue = condition.asBool();
      let res;

      /**
       * 根据条件值 , 进行后续操作
       * 1. 条件值 不是 bool
       * 
       * 
       * 2. 条件值 是 bool , 根据布尔值执行相应的语句部分 , 并对其进行求值
       */
      if (conditionValue === undefined) {
        const consequent = this.evaluateExpression(expr.consequent);  // true  语句
        const alternate = this.evaluateExpression(expr.alternate);    // false 语句

        if (!consequent || !alternate) {
          return;
        }

        res = new BasicEvaluatedExpression();

        // 
        consequent.isConditional()
          ? res.setOptions(consequent.options)
          : res.setOptions([consequent]);

        //
        alternate.isConditional()
          ? res.addOptions(alternate.options)
          : res.addOptions([alternate])
      } else {
        res = this.evaluateExpression(
          conditionValue
            ? expr.consequent
            : expr.alternate
        );
      }

      res.setRange(expr.range);

      return res;
    });

    /**
     * 对"数组访问表达式"的求值过程
     */
    this.plugin("evaluate ArrayExpression", function (expr) {
      const items = expr.elements.map(function (element) {
        return element !== null && this.evaluateExpression(element);
      }, this);

      if (!items.every(Boolean)) return;

      return new BasicEvaluatedExpression().setItems(items).setRange(expr.range);
    });
  }



  //
  // ==================================================== prewalk* 预遍历
  //
  /**
   * 预遍历 ( 先序遍历 ) -- 收集声明定义(变量,常量,类,函数的名称)
   * @param {StamentNode[]} statements 
   */
  prewalkStatements(statements) {
    for (let index = 0, len = statements.length; index < len; index++) {
      const statement = statements[index];
      this.prewalkStatement(statement);
    }
  }

  /**
   * 预遍历 语句 -- 执行响应的处理函数
   * @param {StatementNode} 语句节点
   */
  prewalkStatement(statement) {
    const handler = this["prewalk" + statement.type];

    if (handler) {
      handler.call(this, statement);
    }
  }

  /**
   * 预遍历 块语句 -- 遍历块语句中的所有语句
   * @param {StatementNode} 语句节点
   */
  prewalkBlockStatement(statement) {
    this.prewalkStatements(statement.body);
  }

  /**
   * 预遍历 if语句 -- 遍历 then 和 else 部分 
   * if(test) { consequent } else { alternate }
   * @param {StatementNode} 语句节点
   */
  prewalkIfStatement(statement) {
    this.prewalkStatement(statement.consequent);

    if (statement.alternate)
      this.prewalkStatement(statement.alternate);
  }

  /**
   * 预遍历 label语句 -- 遍历 label的内容部分 
   * name:body
   * @param {StatementNode} 语句节点
   */
  prewalkLabeledStatement(statement) {
    this.prewalkStatement(statement.body);
  }

  /**
   * 预遍历 with语句 -- 遍历 with语句中语句块 
   * with(object){ body }
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkWithStatement(statement) {
    this.prewalkStatement(statement.body);
  }

  /**
   * 预遍历 switch语句 -- 遍历 switch语句中case部分 switch(discriminant){ cases[] }
   * @param {StatementNode} 语句节点
   */
  prewalkSwitchStatement(statement) {
    this.prewalkSwitchCases(statement.cases);
  }

  /**
   * 预遍历 case语句 -- 遍历 case语句中语句块 case test : consequent
   * @param {StatementNode} 语句节点
   */
  prewalkSwitchCases(switchCases) {
    for (let index = 0, len = switchCases.length; index < len; index++) {
      const switchCase = switchCases[index];
      this.prewalkStatements(switchCase.consequent);
    }
  }

  /**
   * 预遍历 try.catch.finally语句 -- 遍历 try语句块  try { block } catch() { handler } finally { finalizer }
   * @param {StatementNode} 语句节点
   */
  prewalkTryStatement(statement) {
    this.prewalkStatement(statement.block);
  }

  /**
   * 预遍历 while语句 -- 遍历while语句的语句块  while(test) { body }
   * @param {StatementNode} 语句节点
   */
  prewalkWhileStatement(statement) {
    this.prewalkStatement(statement.body);
  }

  /**
   * 预遍历 do...while语句 -- 遍历do...while语句的语句块  
   * do { body } while(test)
   * @param {StatementNode} 语句节点
   */
  prewalkDoWhileStatement(statement) {
    this.prewalkStatement(statement.body);
  }

  /**
   * 预遍历 for语句 -- 遍历for语句的初始化的变量声明和语句块部分 
   * 
   * for ( <init> ; <test> ; <update> ) { <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkForStatement(statement) {
    if (statement.init) {
      if (statement.init.type === "VariableDeclaration")
        this.prewalkStatement(statement.init);
    }

    this.prewalkStatement(statement.body);
  }

  /**
   * 预遍历 for...in语句 -- 遍历for ... in语句的变量声明和语句块部分 
   * 
   * for( <left> in <right> ) { <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkForInStatement(statement) {
    if (statement.left.type === "VariableDeclaration")
      this.prewalkStatement(statement.left);

    this.prewalkStatement(statement.body);
  }

  /**
   * 预遍历 for...of语句 -- 遍历for ... in语句的变量声明和语句块部分 
   * 
   * for( <left> of <right> ) { <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkForOfStatement(statement) {
    if (statement.left.type === "VariableDeclaration")
      this.prewalkStatement(statement.left);

    this.prewalkStatement(statement.body);
  }

  /**
   * 预遍历 import声明
   * 1. 将找到的声明记录下来 ( 记录在scope中 )
   * 2. emit "import"
   * 3. emit "import specifier"
   * 
   * import <specifiers> from < source>
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkImportDeclaration(statement) {
    const source = statement.source.value;

    this.applyPluginsBailResult("import", statement, source);

    statement.specifiers.forEach(function (specifier) {
      const name = specifier.local.name;

      this.scope.renames["$" + name] = undefined;
      this.scope.definitions.push(name);

      switch (specifier.type) {
        case "ImportDefaultSpecifier":
          this.applyPluginsBailResult("import specifier", statement, source, "default", name);
          break;
        case "ImportSpecifier":
          this.applyPluginsBailResult("import specifier", statement, source, specifier.imported.name, name);
          break;
        case "ImportNamespaceSpecifier":
          this.applyPluginsBailResult("import specifier", statement, source, null, name);
          break;
      }
    }, this);
  }

  /**
   * 预遍历 命名的export声明
   * 1. 将找到的声明记录下来 ( 记录在scope中 )
   * 2. emit "export"
   * 3. emit "export declaration"
   * 4. emit "export specifier"
   * 
   * export <declaration>                 export aa const AA = 1
   * export <specifiers>                  export {a , b as c}
   * export <specifiers> from <source>    export {a , b as c} from '../1'
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkExportNamedDeclaration(statement) {
    let source;

    //
    // emit export
    //
    if (statement.source) {
      // expot 
      source = statement.source.value;
      this.applyPluginsBailResult("export import", statement, source);
    } else {
      this.applyPluginsBailResult1("export", statement);
    }

    // 
    // handle export <declaration>
    //
    if (statement.declaration) {
      if (/Expression$/.test(statement.declaration.type)) {
        // 不支持表达式
        throw new Error("Doesn't occur?");
      } else {
        if (!this.applyPluginsBailResult("export declaration",
          statement,
          statement.declaration
        )) {
          // 遍历声明语句
          const pos = this.scope.definitions.length;
          this.prewalkStatement(statement.declaration);

          // 获得遍历export声明语句时找到的定义 , 依次触发export specifier 事件
          const newDefs = this.scope.definitions.slice(pos);

          for (let index = newDefs.length - 1; index >= 0; index--) {
            const def = newDefs[index];
            this.applyPluginsBailResult("export specifier", statement, def, def, index);
          }
        }
      }
    }

    // 
    // handle <specifiers> [from <source>]
    //
    if (statement.specifiers) {
      for (let specifierIndex = 0; specifierIndex < statement.specifiers.length; specifierIndex++) {
        const specifier = statement.specifiers[specifierIndex];
        switch (specifier.type) {
          case "ExportSpecifier":
            {
              const name = specifier.exported.name;
              if (source)
                this.applyPluginsBailResult("export import specifier", statement, source, specifier.local.name, name, specifierIndex);
              else
                this.applyPluginsBailResult("export specifier", statement, specifier.local.name, name, specifierIndex);
              break;
            }
        }
      }
    }
  }

  /**
   * 预遍历 默认的export声明
   * 1. 将找到的声明记录下来 ( 记录在scope中 )
   * 2. emit "export specifier"
   * 
   * export default <declaration>
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkExportDefaultDeclaration(statement) {
    // 只处理默认的声明导出  exports default const a = 1
    if (/Declaration$/.test(statement.declaration.type)) {
      // 遍历声明语句
      const pos = this.scope.definitions.length;
      this.prewalkStatement(statement.declaration);

      // 获得遍历export声明语句时找到的定义 , 依次触发export specifier 事件
      const newDefs = this.scope.definitions.slice(pos);
      for (let index = 0, len = newDefs.length; index < len; index++) {
        const def = newDefs[index];
        this.applyPluginsBailResult("export specifier", statement, def, "default");
      }
    }
  }

  /**
   * 预遍历 export * 声明
   * 1. 将找到的声明记录下来 ( 记录在scope中 )
   * 2. emit "export import"
   * 3. emit "export specifier"
   * 
   * export * as <local> from <source>
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkExportAllDeclaration(statement) {
    const source = statement.source.value;

    this.applyPluginsBailResult("export import", statement, source);
    this.applyPluginsBailResult("export import specifier", statement, source, null, null, 0);
  }

  /**
   * 变量声明语句 -- 遍历声明部分
   * @param {StatmentNode} statement 语句
   */
  prewalkVariableDeclaration(statement) {
    if (statement.declarations)
      this.prewalkVariableDeclarators(statement.declarations);
  }

  /**
   * 预遍历 变量声明语句的声明部分 -- 遍历声明部分 , 将找到的声明定义记录下来 ( 记录在scope中 )
   * 
   * @param {VariableDeclarator[]} declarators 声明部分
   */
  prewalkVariableDeclarators(declarators) {
    declarators.forEach(declarator => {
      switch (declarator.type) {
        case "VariableDeclarator":
          {
            // 深入模式 , 获得声明定义的名称
            this.enterPattern(declarator.id, (name, decl) => {
              if (!this.applyPluginsBailResult1("var-" + declarator.kind + " " + name, decl)) {
                if (!this.applyPluginsBailResult1("var " + name, decl)) {
                  this.scope.renames["$" + name] = undefined;

                  // 避免重复添加
                  if (this.scope.definitions.indexOf(name) < 0)
                    this.scope.definitions.push(name);
                }
              }
            });
            break;
          }
      }
    });
  }

  /**
   * 预遍历 函数声明 -- 将找到的函数名称记录下来 ( 记录在scope中 )
   * 
   * function <id> (<params>) {  <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkFunctionDeclaration(statement) {
    // 命名函数
    if (statement.id) {
      this.scope.renames["$" + statement.id.name] = undefined;
      this.scope.definitions.push(statement.id.name);
    }
  }

  /**
   * 预遍历 类声明 -- 将找到的类名称记录下来 ( 记录在scope中 )
   * 
   * class <id> extends <superClass> { <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  prewalkClassDeclaration(statement) {
    if (statement.id) {
      this.scope.renames["$" + statement.id.name] = undefined;
      this.scope.definitions.push(statement.id.name);
    }
  }



  //
  // ==================================================== walk* 遍历语句
  //
  /**
   * ( 先序遍历 )
   * Walking iterates the statements and expressions and processes them
   */
  walkStatements(statements) {
    for (let index = 0, len = statements.length; index < len; index++) {
      const statement = statements[index];
      this.walkStatement(statement);
    }
  }

  /**
   * 遍历 块语句 -- emit "statement" 执行响应的处理函数
   * @param {StatementNode} 语句节点
   */
  walkStatement(statement) {
    if (this.applyPluginsBailResult1("statement", statement) !== undefined) {
      return;
    }

    const handler = this["walk" + statement.type];

    if (handler)
      handler.call(this, statement);
  }

  /**
   * 遍历 块语句 --> 遍历块语句中的所有语句
   * @param {StatementNode} 语句节点
   */
  walkBlockStatement(statement) {
    this.walkStatements(statement.body);
  }

  /**
   * 遍历 表达式语句 --> 遍历表达式语句中的表达式
   */
  walkExpressionStatement(statement) {
    this.walkExpression(statement.expression);
  }

  /**
   * 遍历 if语句 -- 遍历 then 和 else 部分 
   * 
   * 
   * if(test) { consequent } else { alternate }
   * 
   * @param {StatementNode} 语句节点
   */
  walkIfStatement(statement) {
    const result = this.applyPluginsBailResult1("statement if", statement);

    //
    // 无结果返回 , 执行条件表达式 , 遍历consequent和alternate部分
    // 有结果返回 , 根据结果的真值情况 , 遍历if语句相应的部分
    //
    if (result === undefined) {
      this.walkExpression(statement.test);
      this.walkStatement(statement.consequent);
      if (statement.alternate)
        this.walkStatement(statement.alternate);
    } else {
      if (result)
        this.walkStatement(statement.consequent);
      else if (statement.alternate)
        this.walkStatement(statement.alternate);
    }
  }

  /**
   * 遍历 label语句 -- 遍历 label的内容部分 
   * name:body
   * @param {StatementNode} 语句节点
   */
  walkLabeledStatement(statement) {
    const result = this.applyPluginsBailResult1("label " + statement.label.name, statement);
    if (result !== true)
      this.walkStatement(statement.body);
  }

  /**
   * 预遍历 with语句 -- 遍历 with语句中语句块 
   * with(object){ body }
   * 
   * @param {StatementNode} 语句节点
   */
  walkWithStatement(statement) {
    this.walkExpression(statement.object);
    this.walkStatement(statement.body);
  }

  /**
   * 遍历 switch语句 -- 遍历 switch语句中case部分 switch(discriminant){ cases[] }
   * @param {StatementNode} 语句节点
   */
  walkSwitchStatement(statement) {
    this.walkExpression(statement.discriminant);
    this.walkSwitchCases(statement.cases);
  }

  /**
   * 遍历 case语句 -- 遍历 case语句中语句块 case test : consequent
   * @param {StatementNode} 语句节点
   */
  walkSwitchCases(switchCases) {
    for (let index = 0, len = switchCases.length; index < len; index++) {
      const switchCase = switchCases[index];

      // 遍历test表达式
      if (switchCase.test) {
        this.walkExpression(switchCase.test);
      }

      this.walkStatements(switchCase.consequent);
    }
  }

  /**
   * 遍历 return语句 -- 遍历表达式部分
   * @param {StatementNode} 语句节点
   */
  walkReturnStatement(statement) {
    this.walkTerminatingStatement(statement);
  }

  /**
   * 遍历 throw语句 -- 遍历表达式部分
   * @param {StatementNode} 语句节点
   */
  walkThrowStatement(statement) {
    this.walkTerminatingStatement(statement);
  }

  walkTerminatingStatement(statement) {
    if (statement.argument)
      this.walkExpression(statement.argument);
  }

  /**
   * 遍历 try.catch.finally语句 -- 遍历 try语句块  
   * try { block } catch() { handler } finally { finalizer }
   * @param {StatementNode} 语句节点
   */
  walkTryStatement(statement) {
    if (this.scope.inTry) {
      this.walkStatement(statement.block);
    } else {
      this.scope.inTry = true;
      this.walkStatement(statement.block);
      this.scope.inTry = false;
    }

    if (statement.handler)
      this.walkCatchClause(statement.handler);

    if (statement.finalizer)
      this.walkStatement(statement.finalizer);
  }

  /**
   * 遍历 catch语句 -
   * @param {StatementNode} catchClause 语句节点
   */
  walkCatchClause(catchClause) {
    // 进入作用域
    this.inScope([catchClause.param], function () {
      this.prewalkStatement(catchClause.body);
      this.walkStatement(catchClause.body);
    }.bind(this));
  }

  /**
   * 遍历 while语句 -- 遍历do...while语句的语句块  
   * do { body } while(test)
   * @param {StatementNode} 语句节点
   */
  walkWhileStatement(statement) {
    this.walkExpression(statement.test);
    this.walkStatement(statement.body);
  }

  /**
   * 遍历 do...while语句 -- 遍历do...while语句的语句块  
   * do { body } while(test)
   * @param {StatementNode} 语句节点
   */
  walkDoWhileStatement(statement) {
    this.walkStatement(statement.body);
    this.walkExpression(statement.test);
  }

  /**
   * 遍历 for语句 -- 遍历for语句的初始化的变量声明和语句块部分 
   * 
   * for ( <init> ; <test> ; <update> ) { <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  walkForStatement(statement) {
    if (statement.init) {
      if (statement.init.type === "VariableDeclaration")
        this.walkStatement(statement.init);
      else
        this.walkExpression(statement.init);
    }

    if (statement.test)
      this.walkExpression(statement.test);

    if (statement.update)
      this.walkExpression(statement.update);

    this.walkStatement(statement.body);
  }

  /**
   * 预遍历 for...in语句 -- 遍历for ... in语句的各个语句部分
   * 
   * for( <left> in <right> ) { <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  walkForInStatement(statement) {
    if (statement.left.type === "VariableDeclaration")
      this.walkStatement(statement.left);
    else
      this.walkExpression(statement.left);

    this.walkExpression(statement.right);
    this.walkStatement(statement.body);
  }

  /**
   * 预遍历 for...of语句 -- 遍历for ... in语句的各个语句部分
   * 
   * for( <left> of <right> ) { <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  walkForOfStatement(statement) {
    if (statement.left.type === "VariableDeclaration")
      this.walkStatement(statement.left);
    else
      this.walkExpression(statement.left);
    this.walkExpression(statement.right);
    this.walkStatement(statement.body);
  }

  /**
   * 遍历 命名的export声明
   * 1. 遍历 声明部分
   * 
   * export <declaration>                 export aa const AA = 1
   * export <specifiers>                  export {a , b as c}
   * export <specifiers> from <source>    export {a , b as c} from '../1'
   * 
   * @param {StatementNode} 语句节点
   */
  walkExportNamedDeclaration(statement) {
    if (statement.declaration) {
      this.walkStatement(statement.declaration);
    }
  }

  /**
   * 预遍历 默认的export声明
   * 1. 将找到的声明记录下来 ( 记录在scope中 )
   * 2. emit "export specifier"
   * 
   * export default <declaration>
   * 
   * @param {StatementNode} 语句节点
   */
  walkExportDefaultDeclaration(statement) {
    this.applyPluginsBailResult1("export", statement);

    if (/Declaration$/.test(statement.declaration.type)) {
      if (!this.applyPluginsBailResult("export declaration", statement, statement.declaration)) {
        this.walkStatement(statement.declaration);
      }
    } else {
      this.walkExpression(statement.declaration);
      if (!this.applyPluginsBailResult("export expression", statement, statement.declaration)) {
        this.applyPluginsBailResult("export specifier", statement, statement.declaration, "default");
      }
    }
  }

  /**
   * 变量声明语句
   * @param {StatmentNode} statement 语句
   */
  walkVariableDeclaration(statement) {
    if (statement.declarations)
      this.walkVariableDeclarators(statement.declarations);
  }

  /**
   * 遍历 变量声明语句的声明部分
   * 
   * @param {VariableDeclarator[]} declarators 声明部分
   */
  walkVariableDeclarators(declarators) {
    declarators.forEach(declarator => {
      switch (declarator.type) {
        case "VariableDeclarator":
          {
            const renameIdentifier = declarator.init && this.getRenameIdentifier(declarator.init);

            if (renameIdentifier &&
              declarator.id.type === "Identifier" &&
              this.applyPluginsBailResult1("can-rename " + renameIdentifier, declarator.init)) {
              // renaming with "var a = b;"
              if (!this.applyPluginsBailResult1("rename " + renameIdentifier, declarator.init)) {

                this.scope.renames["$" + declarator.id.name] = this.scope.renames["$" + renameIdentifier] || renameIdentifier;
                const idx = this.scope.definitions.indexOf(declarator.id.name);

                if (idx >= 0) {
                  this.scope.definitions.splice(idx, 1);
                }
              }
            } else {
              this.walkPattern(declarator.id);
              if (declarator.init)
                this.walkExpression(declarator.init);
            }
            break;
          }
      }
    });
  }

  /**
   * 遍历 函数声明 -- 将找到的函数名称记录下来 ( 记录在scope中 )
   * 
   * function <id> (<params>) {  <body> }
   * 
   * @param {StatementNode} 语句节点
   */
  walkFunctionDeclaration(statement) {
    // 遍历参数列表
    statement.params.forEach(param => {
      this.walkPattern(param);
    });

    // 遍历函数体
    this.inScope(statement.params, function () {
      if (statement.body.type === "BlockStatement") {
        this.prewalkStatement(statement.body);
        this.walkStatement(statement.body);
      } else {
        this.walkExpression(statement.body);
      }
    }.bind(this));
  }

  /**
   * 遍历类声明
   * @param {Statement} statement 
   */
  walkClassDeclaration(statement) {
    this.walkClass(statement);
  }



  //
  // ==================================================== walkExpressions 遍历表达式
  //

  /**
   * 遍历 多个表达式节点
   * @param {Expression[]} expression 一个或多个表达式节点
   */
  walkExpressions(expressions) {
    for (let expressionsIndex = 0, len = expressions.length; expressionsIndex < len; expressionsIndex++) {
      const expression = expressions[expressionsIndex];
      if (expression)
        this.walkExpression(expression);
    }
  }

  /**
   * 遍历 表达式节点 -- 根据表达式的类型 , 调用相关的遍历函数
   * @param {Expression} expression 表达式节点
   */
  walkExpression(expression) {
    if (this["walk" + expression.type])
      return this["walk" + expression.type](expression);
  }

  /**
   * 遍历 await表达式 -- 继续遍历 await的表达式部分
   * await argument
   * @param {Expression} expression 表达式节点
   */
  walkAwaitExpression(expression) {
    const argument = expression.argument;

    if (this["walk" + argument.type])
      return this["walk" + argument.type](argument);
  }

  /**
   * 遍历 数组表达式 -- 继续遍历 数组表达式的元素部分elements
   * [elements]
   * 
   * @param {Expression} expression 表达式节点
   */
  walkArrayExpression(expression) {
    if (expression.elements)
      this.walkExpressions(expression.elements);
  }

  /**
   * 遍历 spread表达式 -- 继续遍历 表达式的参数部分
   * 
   * { ... argument }
   * [ ... argument ]
   * 
   * @param {Expression} expression 表达式节点
   */
  walkSpreadElement(expression) {
    if (expression.argument)
      this.walkExpression(expression.argument);
  }

  /**
   * 遍历 对象表达式 -- 针对属性的特性进行相应的处理
   * 1. 如果key需要计算 , 那么继续遍历key部分的表达式
   * 2. 修改作用域标志 inshorthand
   * 3. 继续遍历value部分的表达式
   * 4. 还原作用域
   * 
   * {properties}
   * 
   * @param {Expression} expression 表达式节点
   */
  walkObjectExpression(expression) {
    for (let propIndex = 0, len = expression.properties.length; propIndex < len; propIndex++) {
      const prop = expression.properties[propIndex];

      // 需要计算的属性 , 计算键值
      if (prop.computed)
        this.walkExpression(prop.key);

      // 简写 , 修改作用域中的状态 
      if (prop.shorthand)
        this.scope.inShorthand = true;

      // 遍历 value
      this.walkExpression(prop.value);

      // 恢复inShorthand
      if (prop.shorthand)
        this.scope.inShorthand = false;
    }
  }

  /**
   * 遍历 函数表达式
   * 1. 遍历参数列表
   * 2. 根据参数构造一个新的作用域之后 , 遍历 函数体 ( 递归调用 prewalk , walk 模拟执行 )
   * 
   * @param {Expression} expression 表达式节点
   */
  walkFunctionExpression(expression) {
    // 处理参数列表中的模式
    expression.params.forEach(param => {
      this.walkPattern(param);
    });

    this.inScope(
      expression.params,
      function () {
        /**
         * 新的作用域 , 执行函数
         * 
         * 1. 块语句
         *   嵌套
         *    prewalk 语句块
         *    walk 语句块
         * 
         * 2. 单语句 ( 表达式 )
         *  直接遍历表达式
         */
        if (expression.body.type === "BlockStatement") {
          this.prewalkStatement(expression.body);
          this.walkStatement(expression.body);
        } else {
          this.walkExpression(expression.body);
        }
      }.bind(this)
    );
  }

  /**
   * 遍历 箭头函数表达式 -- 遍历函数体
   * @param {Expression} expression 表达式节点
   */
  walkArrowFunctionExpression(expression) {
    expression.params.forEach(param => {
      this.walkPattern(param);
    });

    this.inScope(expression.params, function () {
      if (expression.body.type === "BlockStatement") {
        this.prewalkStatement(expression.body);
        this.walkStatement(expression.body);
      } else {
        this.walkExpression(expression.body);
      }
    }.bind(this));
  }

  /**
   * 遍历 逗号表达式 -- 遍历 逗号表达式的每个子表达式
   * <expression> , <expression> , ...
   * 
   * @param {Expression} expression 表达式节点
   */
  walkSequenceExpression(expression) {
    if (expression.expressions)
      this.walkExpressions(expression.expressions);
  }

  /**
   * 遍历 自增/自减表达式 -- 遍历 表达式中的参数部分
   * ++<argument>
   * 
   * @param {Expression} expression 表达式节点
   */
  walkUpdateExpression(expression) {
    this.walkExpression(expression.argument);
  }

  /**
   * 遍历 一元表达式 -- 按不同的运算符分别处理
   * 
   * 1. typedef 运算符   满足特定条件时 , 触发"type [name]" , 对表达式进行处理
   * 2. 其他运算符       遍历 表达式的参数部分
   * 
   * typedef | delete | - | + | ! | ~ <argument>
   * 
   * @param {Expression} expression 表达式节点
   */
  walkUnaryExpression(expression) {
    if (expression.operator === "typeof") {
      let expr = expression.argument;
      let exprName = [];

      /**
       * 如果是访问对象成员的表达式 , 记录表达式的所有标志符
       * 
       * typedef <MemberExpression>
       * typedef a.b
       * 
       * MemberExpression
       *  object   : type=Identifier name = a
       *  property : type=Identifier name = b
       */
      while (
        expr.type === "MemberExpression" &&
        expr.property.type === (expr.computed ? "Literal" : "Identifier")
      ) {
        exprName.unshift(expr.property.name || expr.property.value);
        expr = expr.object;
      }

      /**
       * 如果 expr是标志符 && 没有在作用域中定义
       * 那么 通过触发事件"typeof [name]" , 处理该表达式
       *  
       */
      if (expr.type === "Identifier" && this.scope.definitions.indexOf(expr.name) === -1) {
        exprName.unshift(this.scope.renames["$" + expr.name] || expr.name);
        exprName = exprName.join(".");

        const result = this.applyPluginsBailResult1("typeof " + exprName, expression);

        // 有结果 , 无需后序的处理
        if (result === true)
          return;
      }
    }

    this.walkExpression(expression.argument);
  }

  /**
   * 遍历 二元表达式 -- 分别遍历左值部分和右值部分
   * <left> + - * / ... <right>
   * @param {Expression} expression 表达式节点
   */
  walkBinaryExpression(expression) {
    this.walkLeftRightExpression(expression);
  }

  /**
   * 遍历 逻辑表达式 -- 分别遍历左值部分和右值部分
   * <left> && || <right>
   * @param {Expression} expression 表达式节点
   */
  walkLogicalExpression(expression) {
    this.walkLeftRightExpression(expression);
  }

  /**
   * 分别遍历左值部分和右值部分
   * @param {Expression} expression 表达式节点
   */
  walkLeftRightExpression(expression) {
    this.walkExpression(expression.left);
    this.walkExpression(expression.right);
  }

  /**
   * 遍历 赋值表达式
   * 1. 重命名标志符赋值
   * 2. 标志符赋值
   * 3. 有重构的标志符赋值 
   * 
   * 
   * <left> = <right>
   * @param {Expression} expression 表达式节点
   */
  walkAssignmentExpression(expression) {
    const renameIdentifier = this.getRenameIdentifier(expression.right);

    // 重命名标志符赋值
    if (expression.left.type === "Identifier" &&
      renameIdentifier &&
      this.applyPluginsBailResult1("can-rename " + renameIdentifier, expression.right)) {
      /**
       * renaming "a = b;"
       */
      if (!this.applyPluginsBailResult1("rename " + renameIdentifier, expression.right)) {
        this.scope.renames["$" + expression.left.name] = renameIdentifier;

        // 删除没有定义的标志符
        const idx = this.scope.definitions.indexOf(expression.left.name);
        if (idx >= 0) {
          this.scope.definitions.splice(idx, 1);
        }
      }
    } else if (expression.left.type === "Identifier") { // 标志符赋值
      if (!this.applyPluginsBailResult1("assigned " + expression.left.name, expression)) {
        this.walkExpression(expression.right);
      }

      this.scope.renames["$" + expression.left.name] = undefined;

      if (!this.applyPluginsBailResult1("assign " + expression.left.name, expression)) {
        this.walkExpression(expression.left);
      }
    } else {
      // 有重构的标志符赋值
      this.walkExpression(expression.right);
      this.walkPattern(expression.left);

      // 深入构造模式
      this.enterPattern(expression.left, (name, decl) => {
        this.scope.renames["$" + name] = undefined;
      });
    }
  }

  /**
   * 遍历 三元表达式 -- 与 if语句类似
   * @param {Expression} expression 表达式节点
   */
  walkConditionalExpression(expression) {
    const result = this.applyPluginsBailResult1("expression ?:", expression);

    if (result === undefined) {
      this.walkExpression(expression.test);
      this.walkExpression(expression.consequent);
      if (expression.alternate)
        this.walkExpression(expression.alternate);
    } else {
      if (result)
        this.walkExpression(expression.consequent);
      else if (expression.alternate)
        this.walkExpression(expression.alternate);
    }
  }

  /**
   * 遍历 new表达式 -- 遍历 调用者部分和参数部分
   * @param {Expression} expression 表达式节点
   */
  walkNewExpression(expression) {
    this.walkExpression(expression.callee);

    if (expression.arguments)
      this.walkExpressions(expression.arguments);
  }

  /**
   * 遍历 yield表达式 -- 
   * @param {Expression} expression 表达式节点
   */
  walkYieldExpression(expression) {
    if (expression.argument)
      this.walkExpression(expression.argument);
  }

  /**
   * 遍历 模板字符串表达式 -- 遍历模板字符串中的表达式部分
   * @param {Expression} expression 表达式节点
   */
  walkTemplateLiteral(expression) {
    if (expression.expressions)
      this.walkExpressions(expression.expressions);
  }

  /**
   * 遍历 表达式 -- 
   * @param {Expression} expression 表达式节点
   */
  walkTaggedTemplateExpression(expression) {
    if (expression.tag)
      this.walkExpression(expression.tag);

    if (expression.quasi && expression.quasi.expressions)
      this.walkExpressions(expression.quasi.expressions);
  }

  /**
   * 遍历 类表达式
   * 
   * let Class1 = class ...
   * @param {Expression} expression 表达式节点
   */
  walkClassExpression(expression) {
    this.walkClass(expression);
  }

  /**
   * 遍历 函数调用表达式
   * 
   * <callee>(<arguments>)
   * 
   * @param {Expression} expression 表达式节点
   */
  walkCallExpression(expression) {
    let result;

    function walkIIFE(functionExpression, options) {
      const params = functionExpression.params;
      const args = options.map(function (arg) {
        const renameIdentifier = this.getRenameIdentifier(arg);
        if (renameIdentifier && this.applyPluginsBailResult1("can-rename " + renameIdentifier, arg)) {
          if (!this.applyPluginsBailResult1("rename " + renameIdentifier, arg))
            return renameIdentifier;
        }
        this.walkExpression(arg);
      }, this);

      this.inScope(params.filter(function (identifier, idx) {
        return !args[idx];
      }), function () {
        // 处理参数列表
        for (let i = 0; i < args.length; i++) {
          const param = args[i];
          if (!param) continue;
          if (!params[i] || params[i].type !== "Identifier") continue;
          this.scope.renames["$" + params[i].name] = param;
        }

        // 遍历 函数主体
        if (functionExpression.body.type === "BlockStatement") {
          this.prewalkStatement(functionExpression.body);
          this.walkStatement(functionExpression.body);
        } else
          this.walkExpression(functionExpression.body);
      }.bind(this));
    }

    if (expression.callee.type === "MemberExpression" &&
      expression.callee.object.type === "FunctionExpression" &&
      !expression.callee.computed &&
      (["call", "bind"]).indexOf(expression.callee.property.name) >= 0 &&
      expression.arguments &&
      expression.arguments.length > 1
    ) {
      // (function(...) { }.call/bind(?, ...))
      walkIIFE.call(this,
        expression.callee.object,
        expression.arguments.slice(1)
      );

      this.walkExpression(expression.arguments[0]);
    } else if (
      expression.callee.type === "FunctionExpression" &&
      expression.arguments
    ) {
      // 立即执行函数
      // (function(...) { }(...))
      walkIIFE.call(this, expression.callee, expression.arguments);
    } else if (expression.callee.type === "Import") {
      result = this.applyPluginsBailResult1("import-call", expression);
      if (result === true)
        return;

      if (expression.arguments)
        this.walkExpressions(expression.arguments);
    } else {
      // 
      // 执行表达式 , 获得调用的函数
      //
      const callee = this.evaluateExpression(expression.callee);

      if (callee.isIdentifier()) {
        result = this.applyPluginsBailResult1("call " + callee.identifier, expression);
        if (result === true)
          return;
      }

      // 遍历调用函数表达式
      if (expression.callee)
        this.walkExpression(expression.callee);

      // 遍历参数列表表达式
      if (expression.arguments)
        this.walkExpressions(expression.arguments);
    }
  }

  /**
   * 遍历 对象访问表达式 -- 
   * @param {Expression} expression 表达式节点
   */
  walkMemberExpression(expression) {
    let expr = expression;
    let exprName = [];

    // 收集嵌套访问的属性名
    while (
      expr.type === "MemberExpression" &&
      expr.property.type === (expr.computed ? "Literal" : "Identifier")) {
      exprName.unshift(expr.property.name || expr.property.value);
      expr = expr.object;
    }

    if (
      expr.type === "Identifier" &&
      this.scope.definitions.indexOf(expr.name) === -1) {

      exprName.unshift(this.scope.renames["$" + expr.name] || expr.name);

      let result = this.applyPluginsBailResult1("expression " + exprName.join("."), expression);
      if (result === true)
        return;

      exprName[exprName.length - 1] = "*";

      result = this.applyPluginsBailResult1("expression " + exprName.join("."), expression);
      if (result === true)
        return;
    }

    /**
     * 继续遍历后序表达式
     */
    this.walkExpression(expression.object);

    if (expression.computed === true)
      this.walkExpression(expression.property);
  }

  /**
   * 遍历类 -- 遍历 超类和类的方法部分
   * @param {ClassDeclaration} classy 类的声明节点
   */
  walkClass(classy) {
    // 遍历 超类
    if (classy.superClass)
      this.walkExpression(classy.superClass);

    // 遍历 类的主体
    if (classy.body && classy.body.type === "ClassBody") {
      classy.body.body.forEach(methodDefinition => {
        if (methodDefinition.type === "MethodDefinition")
          this.walkMethodDefinition(methodDefinition);
      });
    }
  }

  /**
   * 遍历类的方法定义 -- 遍历key和value部分
   * @param {Statement} methodDefinition 
   */
  walkMethodDefinition(methodDefinition) {
    if (methodDefinition.computed && methodDefinition.key)
      this.walkExpression(methodDefinition.key);

    if (methodDefinition.value)
      this.walkExpression(methodDefinition.value);
  }

  /**
   * 遍历 标志符
   * @param {Expression} expression 
   */
  walkIdentifier(expression) {
    // 如果发现标志符没有被定义 , 那么就触发事件对其进行处理
    if (this.scope.definitions.indexOf(expression.name) === -1) {
      const name = this.scope.renames["$" + expression.name] || expression.name;
      const result = this.applyPluginsBailResult1("expression " + name, expression);

      if (result === true)
        return;
    }
  }



  /**
   * 对表达式求值 
   * 如果 结果是标志符   则 返回别名标志符
   * 如果 结果不是标志符  则 返回undefined
   * 
   * @param {Expression} expr 表达式
   * @returns {String|undefined}
   */
  getRenameIdentifier(expr) {
    const result = this.evaluateExpression(expr);

    if (!result) return;

    // 结果是一个标志符 , 那么返回该标志符的名称
    if (result.isIdentifier()) return result.identifier;

    return;
  }

  /**
   * 对表达式进行求值操作, 并返回结果
   * ( 即通过触发 evaluate [type]事件 , 对指定类型的表达式进行求值操作 )
   * 
   * 需要对表达式求值的情况 : 
   * getRenameIdentifier
   * walkCallExpression
   * 
   * 对执行表达式进行求值 , 并返回求值结果
   * @param {Expression} expression 表达式节点
   * @returns {BasicEvaluatedExpression} 
   */
  evaluateExpression(expression) {
    try {
      const result = this.applyPluginsBailResult1("evaluate " + expression.type, expression);

      if (result !== undefined) return result;
    } catch (e) {
      console.warn(e);
      // ignore error
    }

    return new BasicEvaluatedExpression().setRange(expression.range);
  }

  /**
   * 模拟函数执行
   * 1. 作用域压栈 -- 基于函数参数 , 创建新的函数作用域
   * 2. 函数fn
   * 3. 作用域出栈 -- 还原作用域
   * @param {Parttern[]} params 参数列表
   * @param {Function} fn 执行的函数
   */
  inScope(params, fn) {
    const oldScope = this.scope;

    // 
    // 创建新的作用域
    //
    this.scope = {
      inTry: false,
      inShorthand: false,
      definitions: oldScope.definitions.slice(),  // 新的定义域
      renames: Object.create(oldScope.renames)    // 新的重命名映射
    };

    // 遍历参数列表 , 找出其中的标志符定义
    for (let paramIndex = 0, len = params.length; paramIndex < len; paramIndex++) {
      const param = params[paramIndex];

      // 记录函数参数
      if (typeof param !== "string") {
        // 需要解构
        this.enterPattern(param, param => {
          this.scope.renames["$" + param] = undefined;
          this.scope.definitions.push(param);
        });
      } else {
        // 无需解构
        this.scope.renames["$" + param] = undefined;
        this.scope.definitions.push(param);
      }
    }

    // 在新的作用域名执行函数
    fn();

    // 还原作用域
    this.scope = oldScope;
  }



  //
  // ================================================== enter* 深入模式
  //
  /**
   * 深入模式 ( 对象结构 , 数组结构 , 默认值 , rest语句 )
   * @param {Pattern} pattern 模式
   * @param {Function} onIdent 识别出定义名称之后触发 (name : String , pattern : Pattern) = > void
   */
  enterPattern(pattern, onIdent) {
    if (pattern && this["enter" + pattern.type])
      this["enter" + pattern.type](pattern, onIdent);
  }

  /**
   * 普通标志符 -- 直接返回标志符
   * @param {Pattern} pattern 模式
   * @param {Function} onIdent 识别出定义名称之后触发 (name : String , pattern : Pattern) = > void
   */
  enterIdentifier(pattern, onIdent) {
    onIdent(pattern.name, pattern);
  }

  /**
   * 对象解构 -- 深入所有解构出来的属性
   * let {properties} = {}
   * @param {Pattern} pattern 模式
   * @param {Function} onIdent 识别出定义名称之后触发 (name : String , pattern : Pattern) = > void
   */
  enterObjectPattern(pattern, onIdent) {
    for (let propIndex = 0, len = pattern.properties.length; propIndex < len; propIndex++) {
      const prop = pattern.properties[propIndex];
      this.enterPattern(prop.value, onIdent);
    }
  }

  /**
   * 数组解构 -- 深入所有解构出来的元素
   * let [elements] = array
   * @param {Pattern} pattern 模式
   * @param {Function} onIdent 识别出定义名称之后触发 (name : String , pattern : Pattern) = > void
   */
  enterArrayPattern(pattern, onIdent) {
    for (let elementIndex = 0, len = pattern.elements.length; elementIndex < len; elementIndex++) {
      const element = pattern.elements[elementIndex];
      this.enterPattern(element, onIdent);
    }
  }

  /**
   * rest -- 深入所有解构出来的元素
   * let [...argument] = array
   * @param {Pattern} pattern 模式
   * @param {Function} onIdent 识别出定义名称之后触发 (name : String , pattern : Pattern) = > void
   */
  enterRestElement(pattern, onIdent) {
    this.enterPattern(pattern.argument, onIdent);
  }

  /**
   * 默认值 -- 深入默认值的左表达式
   * var { left = right } = ...
   * @param {Pattern} pattern 模式
   * @param {Function} onIdent 识别出定义名称之后触发 (name : String , pattern : Pattern) = > void
   */
  enterAssignmentPattern(pattern, onIdent) {
    this.enterPattern(pattern.left, onIdent);
  }



  //
  // ================================================== walkPattern* 遍历模式
  //
  /**
   * 遍历模式 ( 对象结构 , 数组结构 , 默认值 , rest语句 ) -- 执行相关的walk函数
   * @param {Pattern} pattern 模式
   */
  walkPattern(pattern) {
    if (pattern.type === "Identifier")
      return;

    if (this["walk" + pattern.type])
      this["walk" + pattern.type](pattern);
  }

  /**
   * 默认值 -- 遍历left和right
   * let {left:right} = {}
   * @param {Pattern} pattern 模式
   */
  walkAssignmentPattern(pattern) {
    this.walkExpression(pattern.right);
    this.walkPattern(pattern.left);
  }

  /**
   * 对象解构 -- 遍历key和value
   * let {properties} = {}
   * @param {Pattern} pattern 模式
   */
  walkObjectPattern(pattern) {
    for (let i = 0, len = pattern.properties.length; i < len; i++) {
      const prop = pattern.properties[i];
      if (prop) {
        // 处理key
        if (prop.computed)
          this.walkExpression(prop.key);

        // 处理value
        if (prop.value)
          this.walkPattern(prop.value);
      }
    }
  }

  /**
   * 数组解构 -- 遍历元素
   * let [elements] = array
   * @param {Pattern} pattern 模式
   */
  walkArrayPattern(pattern) {
    for (let i = 0, len = pattern.elements.length; i < len; i++) {
      const element = pattern.elements[i];
      if (element)
        this.walkPattern(element);
    }
  }

  /**
   * rest -- 遍历参数
   * let [...argument] = array
   * @param {Pattern} pattern 模式
   */
  walkRestElement(pattern) {
    this.walkPattern(pattern.argument);
  }



  /**
   * 解析源代码
   * @param {String} source 源代码
   * @param {Object} initialState 初始状态
   * @returns {Object} 返回最终的状态
   */
  parse(source, initialState) {
    let ast;
    const comments = [];

    for (let i = 0, len = POSSIBLE_AST_OPTIONS.length; i < len; i++) {
      if (!ast) {
        try {
          comments.length = 0;
          POSSIBLE_AST_OPTIONS[i].onComment = comments;
          ast = acorn.parse(source, POSSIBLE_AST_OPTIONS[i]);
        } catch (e) {
          // ignore the error
        }
      }
    }

    if (!ast) {
      // for the error
      ast = acorn.parse(source, {
        ranges: true,
        locations: true,
        ecmaVersion: 2017,
        sourceType: "module",
        plugins: {
          dynamicImport: true
        },
        onComment: comments
      });
    }

    if (!ast || typeof ast !== "object")
      throw new Error("Source couldn't be parsed");

    const oldScope = this.scope;
    const oldState = this.state;
    const oldComments = this.comments;

    // 初始化作用域
    this.scope = {
      inTry: false,
      definitions: [],
      renames: {}
    };

    const state = this.state = initialState || {};

    // 保存注释
    this.comments = comments;

    //
    // 
    //
    if (this.applyPluginsBailResult("program", ast, comments) === undefined) {
      this.prewalkStatements(ast.body);

      this.walkStatements(ast.body);
    }

    //
    // 
    //
    this.scope = oldScope;
    this.state = oldState;
    this.comments = oldComments;

    return state;
  }

  /**
   * 
   * @param {*} expression 
   */
  parseString(expression) {
    switch (expression.type) {
      case "BinaryExpression":
        if (expression.operator === "+")
          return this.parseString(expression.left) + this.parseString(expression.right);
        break;
      case "Literal":
        return expression.value + "";
    }
    throw new Error(expression.type + " is not supported as parameter for require");
  }

  /**
   * 
   */
  parseCalculatedString(expression) {
    switch (expression.type) {
      case "BinaryExpression":
        if (expression.operator === "+") {
          const left = this.parseCalculatedString(expression.left);
          const right = this.parseCalculatedString(expression.right);
          if (left.code) {
            return {
              range: left.range,
              value: left.value,
              code: true
            };
          } else if (right.code) {
            return {
              range: [left.range[0], right.range ? right.range[1] : left.range[1]],
              value: left.value + right.value,
              code: true
            };
          } else {
            return {
              range: [left.range[0], right.range[1]],
              value: left.value + right.value
            };
          }
        }
        break;
      case "ConditionalExpression":
        {
          const consequent = this.parseCalculatedString(expression.consequent);
          const alternate = this.parseCalculatedString(expression.alternate);
          const items = [];
          if (consequent.conditional)
            Array.prototype.push.apply(items, consequent.conditional);
          else if (!consequent.code)
            items.push(consequent);
          else break;
          if (alternate.conditional)
            Array.prototype.push.apply(items, alternate.conditional);
          else if (!alternate.code)
            items.push(alternate);
          else break;
          return {
            value: "",
            code: true,
            conditional: items
          };
        }
      case "Literal":
        return {
          range: expression.range,
          value: expression.value + ""
        };
    }
    return {
      value: "",
      code: true
    };
  }

  /**
   * 
   */
  parseStringArray(expression) {
    if (expression.type !== "ArrayExpression") {
      return [this.parseString(expression)];
    }

    const arr = [];
    if (expression.elements)
      expression.elements.forEach(function (expr) {
        arr.push(this.parseString(expr));
      }, this);
    return arr;
  }

  /**
   * 
   * @param {*} expression 
   */
  parseCalculatedStringArray(expression) {
    if (expression.type !== "ArrayExpression") {
      return [this.parseCalculatedString(expression)];
    }

    const arr = [];
    if (expression.elements)
      expression.elements.forEach(function (expr) {
        arr.push(this.parseCalculatedString(expr));
      }, this);
    return arr;
  }

  /**
   * 执行单句表达式
   * @param {String} source 代码
   * @returns {} 返回执行结果
   */
  evaluate(source) {
    const ast = acorn.parse("(" + source + ")", {
      ranges: true,
      locations: true,
      ecmaVersion: 2017,
      sourceType: "module",
      plugins: {
        dynamicImport: true
      }
    });

    if (!ast || typeof ast !== "object" || ast.type !== "Program")
      throw new Error("evaluate: Source couldn't be parsed");

    if (ast.body.length !== 1 || ast.body[0].type !== "ExpressionStatement")
      throw new Error("evaluate: Source is not a expression");

    return this.evaluateExpression(ast.body[0].expression);
  }

  /**
   * 
   * @param {*} range 
   */
  getCommentOptions(range) {
    const comments = this.getComments(range);
    if (comments.length === 0) return null;
    const options = comments.map(comment => {
      try {
        return json5.parse(`{${comment.value}}`);
      } catch (e) {
        return {};
      }
    });
    return options.reduce((o, i) => Object.assign(o, i), {});
  }

  /**
   * 
   */
  getComments(range) {
    return this.comments.filter(comment => comment.range[0] >= range[0] && comment.range[1] <= range[1]);
  }
}

module.exports = Parser;
