

let helloWorld = require('./third-loader!./second-loader!./first-loader!./resourceA')

helloWorld()
