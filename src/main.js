// require('../styles/main.css')

import utils1 from './utils/1'
import utils2 from './utils/2'

// require('bundle-loader!VendorJquery')

require.ensure([],function(require){
  var a = require('VendorJquery')

  console.log(a)
})


console.log('main.js')