# LIBRARY AND EXTERNALS

You developed a library and want to distribute it in compiled/bundled versions (in addition to the modularized version). You want to allow the user to use it in a **script tag** tag or with a amd loader (i. e. **require.js**). Or you depend on various precompilations and want to remove the pain for the user and distribute it as simple compiled commonjs module.

_你开发了一个库,并且希望以编译/打包的之后的版本(除了模块化版本)分发它.你希望用户能通过script tag或AMD方式加载它.或者你的库依赖于各种预编译程序,并且减轻用户使用的痛苦,以简单的编译之后的commonjs模块分发出去._

## configuration options ( 配置选项 )

Webpack has three configuration options that are relevant for these use cases:

_Webpack有三个与这些用例相关的相关配置:_

**output.library** allows you to optionally specify the name of your library.

_**output.library** 允许你可选地指定库的名称._

**output.libraryTarget** allows you to specify the type of output. I.e. CommonJs, AMD, for usage in a script tag or as UMD module.

_**output.libraryTarget** 允许你指定输出类型 (CommonJS , AMD , script tag , UMD)_

**externals** allows you to specify dependencies for your library that are not resolved by webpack, but become dependencies of the output. This means they are imported from the environment during runtime.

_**externals** 允许你指定库的依赖,这些依赖不会被webpack解析,而是成为输出的依赖关系.这意味着它们应该在运行期间从环境导入._


## Examples ( 例子 )

Compile library for usage in a script tag

_在script tag中使用一个编译库_

depends on "jquery", but jquery should not be included in the bundle.


_依赖"jquery",但是"jquery"不应该包含在包中._


library should be available at Foo in the global context.

_库"Foo"在全局范围内可用._

```javascript

var jQuery = require("jquery");
var math = require("math-library");

function Foo() {}

// ...

module.exports = Foo;

```


Recommended configuration (only relevant stuff):

_推荐配置:_

```javascript
{
    output: {
        // export itself to a global var
        libraryTarget: "var",
        // name of the global var: "Foo"
        library: "Foo"
    },
    externals: {
        // require("jquery") is external and available
        //  on the global var jQuery
        "jquery": "jQuery"
    }
}

```

Resulting bundle:

_包的结果:_

```javascript

var Foo = (/* ... webpack bootstrap ... */
{
    0: function(...) {
        var jQuery = require(1);
        /* ... */
    },
    1: function(...) {
        module.exports = jQuery;
    },
    /* ... */
});

```

## Applications and externals ( 应用程序和外部依赖 )

You can also use the externals option to import an existing API into applications. For example, if you want to use jQuery from a CDN via a separate script tag while still explicitly declaring it as a dependency via **require("jquery")**, you would specify it as external like so: **{ externals: { jquery: "jQuery" } }.**

_使用"externals"选项将现有API导入到应用.例如,如果你想通过单独的 script tag从CDN中使用"jquery",同时依然通过**require("jquery")**显示声明为依赖关系,你可以指定它为一个外部依赖,例如:_

```javascript

// webpack config
{ externals: { jquery: "jQuery" } }

// html
<script src="http://cdn.xxx.com/jquery.2.1.js"></script>

```

## Resolving and externals ( 解析和外部依赖 )

Externals processing happens before resolving the request, which means you need to specify the unresolved request. Loaders are not applied to externals, so you need to “externalize” a request with a loader: **require("bundle!jquery") { externals: { "bundle!jquery": "bundledJQuery" } }**

_外部依赖处理发生在解析请求之前,这意味着你需要指定未解析的请求.加载器不应该被应用与外部依赖,所以你需要使用加载器"外部化"一个请求_

```javascript

// 异步加载
require("bundle!jquery")

//
{
  externals:{
    "bundle!jquery": "bundledJQuery"
  }
}

```
