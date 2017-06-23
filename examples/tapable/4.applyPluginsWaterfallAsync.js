const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return (any, delay, fn) => (current, callback) => {
    setTimeout(function () {
      process.stdout.write(
        ' '.repeat(delay / 100) +
        any + ' : ' +
        fn.toString().replace(/a/g, current) +
        '\r\n'
      )

      empty = false

      callback(null, fn(current))
    }, delay)
  }
})()

// applyPlugins
tapable.plugin('event', fn('a', 1000, a => a + a))
tapable.plugin('event', fn('b', 200, a => a * 2))
tapable.plugin('event', fn('c', 100, a => a * a))

tapable.applyPluginsAsyncWaterfall('event', 1, function (err, result) {
  if (err) {
    console.log('error', err)
  }

  console.log('result : ' + result)
})