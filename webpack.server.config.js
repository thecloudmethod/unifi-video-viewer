const webpack = require('webpack');
const WebpackConfigFactory = require('@nestjs/ng-universal')
  .WebpackConfigFactory;

/**
 * In fact, passing following configuration to the WebpackConfigFactory is not required
 * default options object returned from this method has equivalent entries defined by default.
 *
 * Example: WebpackConfigFactory.create(webpack);
 */
let wpcfg = WebpackConfigFactory.create(webpack, {
  // This is our Nest server for Dynamic universal
  server: './server/main.ts',
  // This is an example of Static prerendering (generative)
  prerender: './prerender.ts',
});

wpcfg.plugins.push(new webpack.DefinePlugin({
  'process.env.FLUENTFFMPEG_COV': false
}))

module.exports = wpcfg