import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { canUseBrewArgs, formatBrewCommand, linuxInstallArgs, resolveLinuxPkg } from "./install.ts";
import { prependToPath } from "./platform.ts";

test("formatBrewCommand joins brew args", () => {
  assert.equal(formatBrewCommand(["install", "--cask", "docker"]), "brew install --cask docker");
  assert.equal(formatBrewCommand(["install", "git"]), "brew install git");
});

test("canUseBrewArgs rejects casks on Linux", () => {
  assert.equal(canUseBrewArgs(["install", "--cask", "docker"], "linux"), false);
  assert.equal(canUseBrewArgs(["install", "--cask", "docker"], "darwin"), true);
  assert.equal(canUseBrewArgs(["install", "git"], "linux"), true);
  assert.equal(canUseBrewArgs([], "darwin"), false);
});

test("resolveLinuxPkg accepts string or per-pm map", () => {
  assert.equal(resolveLinuxPkg("apt", "git"), "git");
  assert.equal(resolveLinuxPkg("apt", { apt: "docker.io", dnf: "docker" }), "docker.io");
  assert.equal(resolveLinuxPkg("pacman", { apt: "docker.io" }), undefined);
  assert.equal(resolveLinuxPkg("dnf", undefined), undefined);
});

test("linuxInstallArgs matches the package manager", () => {
  assert.deepEqual(linuxInstallArgs("apt", "git"), ["sudo", "apt-get", "install", "-y", "git"]);
  assert.deepEqual(linuxInstallArgs("dnf", "git"), ["sudo", "dnf", "install", "-y", "git"]);
  assert.deepEqual(linuxInstallArgs("pacman", "git"), ["sudo", "pacman", "-S", "--noconfirm", "git"]);
  assert.deepEqual(linuxInstallArgs("zypper", "git"), ["sudo", "zypper", "--non-interactive", "install", "git"]);
});

test("prependToPath puts an existing dir first and skips duplicates", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "air-path-"));
  const previous = process.env.PATH ?? "";
  try {
    process.env.PATH = `/usr/bin${path.delimiter}/bin`;
    prependToPath(dir);
    assert.equal(process.env.PATH?.startsWith(`${dir}${path.delimiter}`), true);
    const once = process.env.PATH;
    prependToPath(dir);
    assert.equal(process.env.PATH, once);
  } finally {
    process.env.PATH = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
