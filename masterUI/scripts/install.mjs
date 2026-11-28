#!/usr/bin/env node
// master-ui installer: puts the upstream design skills into <project>/.claude/skills/,
// project-local only. Never installs globally, never installs hooks.
//
//   node install.mjs --project <dir> --set landing|app|redesign|small
//   node install.mjs --project <dir> --only impeccable,hallmark
//   node install.mjs --project <dir> --check          # report only, install nothing
//   node install.mjs --project <dir> --set app --update  # refresh to upstream HEAD
//
// Prints a human summary, then one final line: MASTER_UI_SKILLS {json}
// mapping each skill to the folder whose SKILL.md to read.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(fs.readFileSync(path.join(here, "sources.json"), "utf8"));

function parseArgs(argv) {
  const a = { project: process.cwd(), set: null, only: null, check: false, update: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--project") a.project = argv[++i];
    else if (k === "--set") a.set = argv[++i];
    else if (k === "--only") a.only = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (k === "--check") a.check = true;
    else if (k === "--update") a.update = true;
    else if (k === "-h" || k === "--help") {
      console.log("usage: install.mjs --project <dir> (--set <" + Object.keys(sources.sets).join("|") + "> | --only a,b) [--check] [--update]");
      process.exit(0);
    } else {
      console.error(`unknown argument: ${k}`);
      process.exit(2);
    }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const project = path.resolve(args.project);
if (!fs.existsSync(project)) {
  console.error(`project folder not found: ${project}`);
  process.exit(2);
}

let wanted;
if (args.only) wanted = args.only;
else if (args.set) {
  wanted = sources.sets[args.set];
  if (!wanted) {
    console.error(`unknown set "${args.set}"; known: ${Object.keys(sources.sets).join(", ")}`);
    process.exit(2);
  }
} else wanted = Object.keys(sources.skills);

for (const name of wanted) {
  if (!sources.skills[name]) {
    console.error(`unknown skill "${name}"; known: ${Object.keys(sources.skills).join(", ")}`);
    process.exit(2);
  }
}

const skillsDir = path.join(project, ".claude", "skills");
const lockPath = path.join(skillsDir, ".master-ui.lock.json");
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, "utf8")) : {};

function has(cmd, argv = ["--version"]) {
  try {
    return execFileSync(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function pythonCmd() {
  for (const [cmd, pre] of [["python3", []], ["python", []], ["py", ["-3"]]]) {
    const v = has(cmd, [...pre, "--version"]);
    if (v && /Python 3/.test(v)) return [cmd, ...pre].join(" ");
  }
  return null;
}

function where(name) {
  const local = path.join(skillsDir, name);
  if (fs.existsSync(path.join(local, "SKILL.md"))) return { dir: local, scope: "project" };
  const global = path.join(os.homedir(), ".claude", "skills", name);
  if (fs.existsSync(path.join(global, "SKILL.md"))) return { dir: global, scope: "global" };
  return null;
}

function install(name) {
  const src = sources.skills[name];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "master-ui-"));
  const repoDir = path.join(tmp, "repo");
  try {
    const url = `https://github.com/${src.repo}.git`;
    execFileSync("git", ["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--sparse", url, repoDir], { stdio: ["ignore", "ignore", "pipe"] });
    execFileSync("git", ["-C", repoDir, "sparse-checkout", "set", "--no-cone", `/${src.path}/`], { stdio: ["ignore", "ignore", "pipe"] });
    const from = path.join(repoDir, src.path);
    if (!fs.existsSync(path.join(from, "SKILL.md"))) throw new Error(`no SKILL.md at ${src.repo}/${src.path}; upstream layout changed, update scripts/sources.json`);
    const sha = execFileSync("git", ["-C", repoDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const to = path.join(skillsDir, name);
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.cpSync(from, to, { recursive: true });
    lock[name] = { repo: src.repo, path: src.path, sha, installedAt: new Date().toISOString() };
    return { dir: to, scope: "project", sha };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (!has("git") && !args.check) {
  console.error("git is required to install skills (https://git-scm.com).");
  process.exit(1);
}

const py = pythonCmd();
const node = process.versions.node;
const result = {};
const lines = [];
let failed = false;

for (const name of wanted) {
  const src = sources.skills[name];
  let found = where(name);
  let action = "present";
  if (args.check) {
    action = found ? "present" : "missing";
  } else if (!found || (args.update && found.scope === "project")) {
    try {
      found = install(name);
      action = args.update ? "updated" : "installed";
    } catch (e) {
      action = "FAILED";
      failed = true;
      lines.push(`  ${name}: FAILED: ${String(e.stderr || e.message).trim()}`);
    }
  }
  const warn = [];
  if (src.needs.includes("python3") && !py) warn.push("needs Python 3 (not found)");
  if (src.needs.includes("node>=18") && Number(node.split(".")[0]) < 18) warn.push(`needs Node 18+ (have ${node})`);
  if (found) result[name] = { dir: found.dir, scope: found.scope, sha: lock[name]?.sha ?? null, warn };
  if (action !== "FAILED") {
    lines.push(`  ${name}: ${action}${found ? ` (${found.scope}) ${found.dir}` : ""}${warn.length ? ` · ${warn.join("; ")}` : ""}`);
  }
}

if (!args.check && Object.keys(lock).length) {
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
}

console.log(`master-ui skills for ${project}`);
console.log(lines.join("\n"));
console.log(`  python: ${py ?? "not found"} · node: ${node} · impeccable launcher: ${process.platform === "win32" ? "scripts/impeccable.cmd" : "scripts/impeccable"}`);
console.log("MASTER_UI_SKILLS " + JSON.stringify({ project, python: py, skills: result }));
process.exit(failed ? 1 : 0);
