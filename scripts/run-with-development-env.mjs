#!/usr/bin/env node

import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("A command is required.");
  process.exit(2);
}

const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit",
  windowsHide: false,
});

child.once("error", (error) => {
  console.error(`Unable to start ${command}: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
