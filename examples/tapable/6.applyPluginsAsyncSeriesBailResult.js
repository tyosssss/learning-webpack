const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return (any, delay, bail) => (callback) => {
    setTimeout(() => {
      console.log(' '.repeat(delay / 100) + (empty ? '' : ' -> ') + any)
      empty = false

      callback()

      if (bail) {
        callback(null, 'bail')
      }
    }, delay)
  }
})()

// applyPlugins
tapable.plugin('event', fn('a', 500))
tapable.plugin('event', fn('b', 100))
tapable.plugin('event', fn('c', 500))
tapable.plugin('event', fn('d', 300, true))
tapable.plugin('event', fn('f', 200))
tapable.plugin('event', fn('e', 100))
tapable.applyPluginsAsyncSeriesBailResult('event', function (err, result) {
  if (err) {
    console.log('error', err)
    return
  }

  console.log('ok', result)
})