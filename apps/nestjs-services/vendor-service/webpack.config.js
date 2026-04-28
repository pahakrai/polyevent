const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [/^@polydom\//],
      }),
      // bcrypt's node-pre-gyp optional deps — must be externalized so the
      // real require() calls survive in the bundle and resolve from node_modules
      { 'mock-aws-s3': 'commonjs2 mock-aws-s3' },
      { 'aws-sdk': 'commonjs2 aws-sdk' },
      { 'nock': 'commonjs2 nock' },
      { '@mapbox/node-pre-gyp': 'commonjs2 @mapbox/node-pre-gyp' },
      { '@mapbox/node-pre-gyp/lib/util/nw-pre-gyp': 'commonjs2 @mapbox/node-pre-gyp/lib/util/nw-pre-gyp' },
    ],
    module: {
      ...options.module,
      rules: [
        ...(options.module?.rules || []),
        { test: /\.html$/, type: 'asset/resource' },
        { test: /\.node$/, loader: 'node-loader' },
      ],
    },
    plugins: [
      ...(options.plugins || []),
      new webpack.IgnorePlugin({
        checkResource(resource) {
          const lazyImports = [
            '@nestjs/microservices',
            '@nestjs/microservices/microservices-module',
            '@nestjs/websockets/socket-module',
            'class-transformer/storage',
            '@grpc/grpc-js',
            '@grpc/proto-loader',
            'mqtt',
            'nats',
            'amqplib',
            'amqp-connection-manager',
            'kafkajs',
          ];
          if (!lazyImports.includes(resource)) return false;
          try {
            require.resolve(resource, { paths: [process.cwd()] });
          } catch {
            return true;
          }
          return false;
        },
      }),
    ],
  };
};
