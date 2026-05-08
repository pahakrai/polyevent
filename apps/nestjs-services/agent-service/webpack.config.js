const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

module.exports = function (options) {
  return {
    ...options,
    devtool: 'source-map',
    output: {
      ...options.output,
      devtoolModuleFilenameTemplate: (info) => {
        const rel = path.relative(
          path.join(__dirname, '..', '..', '..'),
          info.absoluteResourcePath
        );
        return `webpack:///${rel.replace(/\\/g, '/')}`;
      },
    },
    externals: [
      { '@xenova/transformers': 'commonjs @xenova/transformers' },
      { 'onnxruntime-node': 'commonjs onnxruntime-node' },
      { 'sharp': 'commonjs sharp' },
      { 'onnxruntime': 'commonjs onnxruntime' },
      nodeExternals({
        allowlist: [/^@polydom\//],
      }),
    ],
    module: {
      ...options.module,
      rules: [
        ...(options.module?.rules || []),
        { test: /\.html$/, type: 'asset/resource' },
        { test: /\.node$/, use: 'node-loader' },
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
