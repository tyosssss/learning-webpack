/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const AsyncDependenciesBlock = require("../AsyncDependenciesBlock");
const RequireEnsureDependency = require("./RequireEnsureDependency");

/**
 * 
 */
module.exports = class RequireEnsureDependenciesBlock extends AsyncDependenciesBlock {

  /**
   * Creates an instance of RequireEnsureDependenciesBlock.
   * @param {Expression} expr 
   * @param {FunctionExpression} [successExpression] 
   * @param {FunctionExpression} [errorExpression] 
   * @param {String} chunkName 
   * @param {Tuple<start,end>} chunkNameRange 
   * @param {Module} module 
   * @param {SourceLocation} loc 
   */
  constructor(expr, successExpression, errorExpression, chunkName, chunkNameRange, module, loc) {
    super(chunkName, module, loc);
    
    this.expr = expr;
    
    // 定义 成功回调函数的函数体 的代码范围
    const successBodyRange = successExpression && successExpression.body && successExpression.body.range;
    if (successBodyRange) {
      this.range = [successBodyRange[0] + 1, successBodyRange[1] - 1];
    }

    // 定义 块名的代码范围 "..."
    this.chunkNameRange = chunkNameRange;
    const dep = new RequireEnsureDependency(this);
    dep.loc = loc;
    this.addDependency(dep);
  }
};
