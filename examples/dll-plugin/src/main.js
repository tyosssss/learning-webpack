const webpack = require('webpack');
const SRC_PATH = path.resolve('src')

const vendors = [
  './1.js'
];

module.exports = {
	context: path.resolve(SRC_PATH),
  output: {
    path: 'build',
    filename: '[name].[chunkhash].js',
    library: '[name]_[chunkhash]',
  },
  entry: {
    vendor: vendors,
  },
  plugins: [
    new webpack.DllPlugin({
      path: 'manifest.json',
      name: '[name]_[chunkhash]',
      context: __dirname,
    }),
  ],
};
