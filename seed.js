const { resolve, join } = require('path')
const webpack = require('./webpack-2.6.1/lib/webpack')
const configPath = process.argv[2]
const config = require(resolve(configPath))

webpack(config, function (err) {
  if (err) {
    console.log('error', err)
  } else {
    console.log('ok')
  }
})