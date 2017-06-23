const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return (any, bail) => (...args) => {
    process.stdout.write((empty ? '' : ' -> ') + any)
    empty = false

    if (bail) {
      return true
    }
  }
})()

// applyPlugins
tapable.plugin('event', fn('a'))
tapable.plugin('event', fn('b'))
tapable.plugin('event', fn('c'))
tapable.plugin('event', fn('d'))
tapable.plugin('event', fn('f'))
tapable.plugin('event', fn('e'))
tapable.applyPluginsBailResult('event')