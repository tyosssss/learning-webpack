const { createAsync, Tapable, callback, log } = require('../common')
const fn1 = createAsync(1)
const fn2 = createAsync(2)
const fn3 = createAsync(3)

!(function () {
  const tapable = new Tapable()
  log('正常执行 -- 叠加')

  tapable.plugin('a', function (value, next) {
    fn1(() => next(null, value + 2))
  })

  tapable.plugin('a', function (value, next) {
    fn2(() => next(null, value + 4))
  })

  tapable.plugin('a', function (value, next) {
    fn3(() => next(null, value + 8))
  })

  tapable.applyPluginsAsyncWaterfall('a', 1, callback)
})()


!(function () {
  const tapable = new Tapable()

  log('发生错误 , 中断执行')
  tapable.plugin('a', function (value, next) {
    fn1(() => next())
  })

  tapable.plugin('a', function (value, next) {
    fn2(() => next({}))
  })

  tapable.plugin('a', function (value, next) {
    fn3(() => next())
  })

  tapable.applyPluginsAsyncWaterfall('a', 1, callback)
})()

