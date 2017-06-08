module.exports = function (resource){
  console.log('first loader')
  console.log(this.resource)
  // console.log('request' , this.request)
  return resource
}
