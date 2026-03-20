#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const entrypoint = path.join(__dirname, "..", "dist", "npm", "main.js");

let bunBinary;

try {
  bunBinary = require.resolve("bun/bin/bun.exe");
} catch (error) {
  console.error(
    "Failed to resolve the bundled Bun runtime. Try reinstalling hunkdiff.",
  );
  if (error && error.message) {
    console.error(error.message);
  }
  process.exit(1);
}

const result = spawnSync(bunBinary, [entrypoint, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(typeof result.status === "number" ? result.status : 1);
