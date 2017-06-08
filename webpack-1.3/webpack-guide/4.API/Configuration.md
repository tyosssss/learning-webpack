# CONFIGURATION

## output

### output.library

If set, export the bundle as library. **output.library** is the name.

_如果设置它,则将导出的包作为一个库.**output.library**是库的名称._

Use this, if you are writing a library and want to publish it as single file.

_如果你正在编写一个库,通过使用它可以将你的库发布为单个文件._


### output.libraryTarget

Which format to export the library:

_导出库的格式 :_

**"var"** - Export by setting a variable: var Library = xxx (default)

_**"var"** - 通过设置一个变量导出: var Library = xx_

**"this"** - Export by setting a property of this: this["Library"] = xxx

_**"this"** - 通过设置this的属性导出:this["Library"] = xxx_

**"commonjs"** - Export by setting a property of exports: exports["Library"] = xxx

_**"commonjs"** - 通过设置exports的属性导出:exports["Library"] = xxx_

**"commonjs2"** - Export by setting module.exports: module.exports = xxx

_通过设置module.exports导出:module.exports = xxx_

**"amd"** - Export to AMD (optionally named - set the name via the library option )

_导出AMD(可选的命名 - 通过library选项命名)_

**"umd"** - Export to AMD, CommonJS2 or as property in root

_在根作用域中导出AMD,CommonJS2或者一个属性_

### output.umdNamedDefine

If output.libraryTarget is set to umd and output.library is set, setting this to true will name the AMD module.

_如果output.libraryTarget='umd'并且设置了output.library,那么该设置=true时将会命名AMD模块_

### output.sourcePrefix

Prefixes every line of the source in the bundle with this string.

_使用此字符串作为包的源代码中每行的前缀_

Default: "\t"

### output.crossOriginLoading

This option enables cross-origin loading of chunks.

_此选项允许跨域加载块._

Possible values are:

_可能的值有:_

**false** - Disable cross-origin loading.

_**false** - 禁止跨域加载_

**"anonymous"** - Cross-origin loading is enabled. When using anonymous no credentials will be send with the request.

_**"anonymous"** - 启用跨域加载.当使用匿名时,不会与请求一起发送凭证信息_

**"use-credentials"** - Cross-origin loading is enabled and credentials will be send with the request.

_**"use-credentials"** - 启用跨域加载.凭证信息将与请求一起发送_

Default: false

## externals ( 外部依赖 )

Specify dependencies that shouldn’t be resolved by webpack, but should become dependencies of the resulting bundle. The kind of the dependency depends on **output.libraryTarget**.

_指定不应该被webpack解析的依赖关系,但是应该成为结果包的依赖关系.这类依赖关系的类型取决于**output.libraryTarget**_

As value an object, a string, a function, a RegExp and an array is accepted.
