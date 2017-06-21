

exports.enhancedResolver = require('../enhanced-resolve-3.0.0/lib/node')

exports.RuleSet = require('../webpack-2.6.1/lib/RuleSet')

exports.Tapable = require('../tapable-0.2.6/lib/Tapable')

exports.createAsync = index => callback => {
  console.log(index)
  callback()
}

exports.callback = function (err, ...args) {
  if (err) {
    console.log('error', err)
  } else {
    console.log('ok', args)
  }
}

exports.log = (...args) => console.log.apply(console, args)