var jquery = require('./jquery')
var common1 = require('./common1')
var common2 = require('./common2')

module.exports = function () {
  console.log('aaad')

  console.log(__dirname)
  console.log(__webpack_public_path__)
  console.log(__webpack_require__ )
  console.log(__webpack_chunk_load__  )
   console.log(__webpack_modules__   )
   console.log(__webpack_hash__    )
   console.log(__non_webpack_require__     )
   console.log(DEBUG      )
}
