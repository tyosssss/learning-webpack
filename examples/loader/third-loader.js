module.exports = function (resource){
  console.log('third loader')
  console.log(resource)
  // console.log('request' , this.request)
  return resource
}

