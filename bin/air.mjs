#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const cli = path.join(root, "src", "cli.ts");

const child = spawn(process.execPath, [tsx, cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: root,
});

child.on("exit", (code) => process.exit(code ?? 1));
