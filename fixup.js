#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

let fd = fs.openSync(path.resolve(__dirname, "dist/umd/package.json"), 'w');
fs.writeFileSync(fd, `{
  "type": "commonjs"
}`);
fs.closeSync(fd);

fd = fs.openSync(path.resolve(__dirname, "dist/esm/package.json"), "w");
fs.writeFileSync(fd, `{
  "type": "module"
}`);
fs.closeSync(fd);
