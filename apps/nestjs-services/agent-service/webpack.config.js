const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [/^@polydom\//],
      }),
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
