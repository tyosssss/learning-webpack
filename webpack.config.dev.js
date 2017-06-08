'use strict'

let path = require('path')
let webpack = require("webpack")

// webpack plugins
let HtmlwebpackPlugin = require('html-webpack-plugin')
// let ExtractTextPlugin = require('extract-text-webpack-plugin')

const BASE_PATH = path.resolve('G:\\Code\\github\\77681649\\learning-webpack')
const SRC_PATH  = path.resolve(BASE_PATH , 'src')
const DIST_PATH = path.resolve(BASE_PATH , 'dist')

const HBS_PATH_PREFIX = 'crocodile-wireless/hotel/public/webresource'
const ABS_PATH_PREFIX = 'crocodile-wireless/flight/public/webresource'


console.log(SRC_PATH)
console.log(DIST_PATH)

var obj = {a:1,b:2,c:3,d:4}

function forEach(collection , fn){
  if(Array.isArray(collection)) return collection.forEach(fn)

  for(let key in collection)
    if(collection.hasOwnProperty(key)) fn(collection[key] , key , collection)
}

let controllers = {
  data:{
    hotel:{
      'hotel/public/webresources/index'   : `./${HBS_PATH_PREFIX}/controller/index`,
      'hotel/public/webresources/list'    : `./${HBS_PATH_PREFIX}/controller/list`,
      'hotel/public/webresources/detail'  : `./${HBS_PATH_PREFIX}/controller/detail`,
    },

    flight:{
      'flight/public/webresources/index'   : `./${ABS_PATH_PREFIX}/controller/index`,
      'flight/public/webresources/list'    : `./${ABS_PATH_PREFIX}/controller/list`,
      'flight/public/webresources/detail'  : `./${ABS_PATH_PREFIX}/controller/detail`,
    }
  },

  getEntries(sys='all'){
    if(sys !== 'all') return this.data[sys]

    let final = {}
    forEach(this.data , (obj)=>forEach(obj , (it,k)=> final[k] = it))

    return final
  },

  getChucks(sys='all'){
    let getChuck = obj=>Object.keys(obj)

    if(sys !== 'all') return getChuck(this.data[sys])

    let final = []
    forEach(this.data , (obj)=> final = final.concat(getChuck(obj)) )

    return final
  }
}

console.log(controllers.getEntries())
console.log(controllers.getChucks())


function genAlias(mappings){
  let alias = {}

  for(let prop in mappings)
    if(mappings.hasOwnProperty(prop))
      alias[prop] = path.resolve(SRC_PATH, mappings[prop])

  return alias
}

module.exports = {

  context:SRC_PATH,

  // 单入口 , 单bundle
  // entry:['./app.js'],

  // 多入口 , 单bundle
  // entry:[
  //   './src/app.js',
  //   './src/controller/index.js',
  //   './src/controller/list.js',
  //   './src/controller/detail.js'
  // ],

  // 多入口 , 多bundle
  entry: Object.assign(
      // controllers.getEntries(),

      {
        // 'calendar':'calendar',
        // 'crocodile/component/slider': ['slider'],
        // 'crocodile/component/slider': [path.resolve(SRC_PATH , 'crocodile/component/slider')],
        // 'crocodile/component/calendar': ['calendar'],
        'crocodile/crocodile': [
          'crocodile',
          './crocodile/vendor/underscore',
          './crocodile/vendor/zepto'
        ]
      }
  ),

  output:{
    filename:'[name].js',
    chunkFilename: "[name].js",
    path:DIST_PATH
  },

  module: {

    noParse:[
      path.resolve(SRC_PATH , 'crocodile/vendor/react'),
      path.resolve(SRC_PATH , 'crocodile/vendor/react-dom'),
      path.resolve(SRC_PATH , 'crocodile/vendor/underscore'),
      path.resolve(SRC_PATH , 'crocodile/vendor/zepto')
    ],

    loaders: [
      // 必须要有 .babelrc
      {
        test: /[\.js|\.jsx]$/,
        loaders:  [ 'babel' ],
        exclude: /node_modules/
      }
    ]
  },

  resolve: {
    extensions: ['', '.js', '.jsx'],
    alias: genAlias({
      // crocodile
      'crocodile': 'crocodile/crocodile',

      'react' : 'crocodile/vendor/react',
      'react-dom': 'crocodile/vendor/react-dom',

      'button': 'crocodile/component/button',
      'input':'crocodile/component/input',
      'list':'crocodile/component/list',
      'calendar':'crocodile/component/calendar',
      'slider': 'crocodile/component/slider',

      'utilsLayout': 'crocodile/utils/layout',

      // hotel
      'hotelIndex'      : `${HBS_PATH_PREFIX}/controller/index`,
      'hotelList'      : `${HBS_PATH_PREFIX}/controller/list`,

      'hotel-common'    : `${HBS_PATH_PREFIX}/common`,
      'hotel-containers': `${HBS_PATH_PREFIX}/containers`,
      'hotel-controller': `${HBS_PATH_PREFIX}/controller`,

      // ticket
      'flight-common'    : `${ABS_PATH_PREFIX}/common`,
      'flight-containers': `${ABS_PATH_PREFIX}/containers`,
      'flight-controller': `${ABS_PATH_PREFIX}/controller`,
    })
  },

  plugins: [
    // new HtmlwebpackPlugin({
    //   title: 'Webpack Demo',
    //   filename: path.resolve(DIST_PATH,'index.html'),
    //   inject: true,
    //   hash: false
    // }),

    new webpack.ProvidePlugin({
      'Crocodile' : 'crocodile',
      'React' : 'react',
      'ReactDOM': 'react-dom'
    }),

    //
    // hotel config
    new webpack.optimize.CommonsChunkPlugin({
      name      : 'hotel/public/webresources/config',
      filename  : 'hotel/public/webresources/config.js',

      chidlren  : true,
      async     : 'hotel/public/webresources/config',
      chunks    : controllers.getChucks('hotel'),
      minChunks : function(module, count){
        let excludes = /button\.jsx/

        return !excludes.test(module.resource) && count >= 2
      }
    }),

    //
    // flight config
    // new webpack.optimize.CommonsChunkPlugin({
    //   name      : 'flight/public/webresources/config',
    //   filename  : 'flight/public/webresources/config.js',

    //   chidlren  : true,
    //   async     : 'flight/public/webresources/config',
    //   chunks    : controllers.getChucks('flight'),
    //   minChunks : 2
    // }),

    //
    // crocodile
    //
    new webpack.optimize.CommonsChunkPlugin({
      name      : 'crocodile/crocodile',
      filename  : 'crocodile/crocodile.js',
      minChunks : 2
    }),

    new webpack.DefinePlugin({
      '__crocodile_config__':{
        'baseUrl' : 'bb',
        'xxx':'cc'
      }
    })
  ]
};
