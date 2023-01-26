const path = require("path");

const isProduction = process.env.NODE_ENV == "production";

const config = {
  devtool: "source-map",
  entry: {
    index: "./src/index.ts",
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist/umd"),
    globalObject: "globalThis",
    library: {
      name: "WorkerSwarmer",
      type: "umd",
    },
  },
  plugins: [
    // Add your plugins here
    // Learn more about plugins from https://webpack.js.org/configuration/plugins/
  ],
  module: {
    rules: [
      {
        test: /\.ts$/i,
        loader: "ts-loader",
        exclude: ["/node_modules/"],
      },
    ],
  },
  resolve: {
    extensions: [".ts", "..."],
  },
};

module.exports = () => {
  if (isProduction) {
    config.mode = "production";
  } else {
    config.mode = "development";
  }
  return config;
};
