const { Tapable } = require('../common')
const tapable = new Tapable
const fn = (function () {
  let empty = true

  return any => (...args) => {
    process.stdout.write((empty ? '' : ' -> ') + any)
    empty = false
  }
})()

// applyPlugins
tapable.plugin('event', fn('a'))
tapable.plugin('event', fn('b'))
tapable.plugin('event', fn('c'))
tapable.applyPlugins('event')