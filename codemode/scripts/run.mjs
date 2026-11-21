#!/usr/bin/env node
// Code Mode runner: executes one JavaScript batch with file, search and shell
// helpers, then prints a single compact JSON report.
//
// The guards below keep honest scripts inside the user's permission rules.
// They are NOT a security boundary: script code runs with full Node access.

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import util from 'node:util';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';

const WIN = process.platform === 'win32';
const RUNS_DIR = path.join(os.tmpdir(), 'claude-codemode');
const RUN_RETENTION_MS = 14 * 24 * 3600 * 1000;
const MAX_CAPTURE = 20 * 1024 * 1024;
const MAX_GREP_FILE = 2 * 1024 * 1024;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', 'target', '__pycache__', '.venv', 'venv', '.cache', 'coverage']);
const PROTECTED_DIRS = new Set(['.git', '.claude', '.husky']);

const HELP = `Usage: node run.mjs [options] [script.js]   (script from stdin when omitted)

Options:
  --dry-run            Preview file changes; skip shell commands unless {readonly:true}
  --timeout=<ms>       Stop the script after this long (default 110000)
  --max-output=<n>     Cap the printed report in characters (default 6000)
  --undo[=<run-id>]    Restore files changed by a run (default: latest in this repo)
  --force              With --undo, overwrite files changed since that run

Script globals (top-level await; finish with return):
  sh(cmd, {cwd, timeout, readonly})  run a command, throw on failure
  sh.try(cmd, opts)                  same, but return {ok, code, stdout, stderr}
  read(file)  write(file, text)  exists(file)
  edit(file, find, replace, {all})   exact string or RegExp; must match
  move(from, to)  remove(file)
  glob(pattern)                      respects .gitignore
  grep(stringOrRegExp, {glob, max})  [{file, line, text}]
  pmap(items, fn, {limit, settle})   parallel map
  head(text, n)  tail(text, n)  path  cwd  root  dryRun
`;

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = { dryRun: false, timeout: 110000, maxOutput: 6000, undo: null, force: false, file: null, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--undo') opts.undo = 'last';
    else if (arg.startsWith('--undo=')) opts.undo = arg.slice(7) || 'last';
    else if (arg.startsWith('--timeout=')) opts.timeout = positiveInt(arg, arg.slice(10));
    else if (arg.startsWith('--max-output=')) opts.maxOutput = positiveInt(arg, arg.slice(13));
    else if (arg.startsWith('--')) usageError(`unknown option ${arg}`);
    else if (opts.file) usageError('only one script file is allowed');
    else opts.file = arg;
  }
  return opts;
}

function positiveInt(arg, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) usageError(`${arg} needs a positive whole number`);
  return n;
}

function usageError(message) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(2);
}

const OPTS = parseArgs(process.argv.slice(2));
if (OPTS.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const CWD = fs.realpathSync(process.cwd());
const ROOT = findRoot(CWD);
const DRY = OPTS.dryRun;

function findRoot(cwd) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status === 0 && r.stdout.trim()) {
    try { return fs.realpathSync(path.resolve(r.stdout.trim())); } catch { /* fall through */ }
  }
  return cwd;
}

// ---------------------------------------------------------------- run state

const startedAt = Date.now();
const runId = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${crypto.randomBytes(2).toString('hex')}`;
const runDir = path.join(RUNS_DIR, runId);
const state = { changed: new Map(), overlay: new Map(), refused: [], notes: [], logs: [], shells: new Set(), createdDirs: new Set() };
let runDirReady = false;
let backupCount = 0;
let listCache = null;
let finished = false;

class RefusedError extends Error {}

function note(text) {
  if (!state.notes.includes(text)) state.notes.push(text);
}

function ensureRunDir() {
  if (runDirReady) return;
  fs.mkdirSync(path.join(runDir, 'backups'), { recursive: true });
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ id: runId, root: ROOT, time: startedAt }));
  runDirReady = true;
}

function journal(entry) {
  ensureRunDir();
  fs.appendFileSync(path.join(runDir, 'journal.jsonl'), `${JSON.stringify(entry)}\n`);
}

function pruneOldRuns() {
  try {
    for (const name of fs.readdirSync(RUNS_DIR)) {
      const dir = path.join(RUNS_DIR, name);
      if (Date.now() - fs.statSync(dir).mtimeMs > RUN_RETENTION_MS) fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch { /* nothing to prune */ }
}

// ---------------------------------------------------------------- glob

function globToRegExp(pattern) {
  let g = String(pattern).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!g.includes('/')) g = `**/${g}`;
  let re = '';
  let depth = 0;
  for (let i = 0; i < g.length;) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 3; } else { re += '.*'; i += 2; }
      } else { re += '[^/]*'; i += 1; }
    } else if (c === '?') { re += '[^/]'; i += 1; }
    else if (c === '{') { depth += 1; re += '(?:'; i += 1; }
    else if (c === '}' && depth) { depth -= 1; re += ')'; i += 1; }
    else if (c === ',' && depth) { re += '|'; i += 1; }
    else { re += c.replace(/[.+^$()|[\]{}\\]/g, '\\$&'); i += 1; }
  }
  return new RegExp(`^${re}$`, WIN ? 'i' : '');
}

// ---------------------------------------------------------------- permission rules

function managedSettingsPath() {
  if (WIN) return 'C:\\Program Files\\ClaudeCode\\managed-settings.json';
  if (process.platform === 'darwin') return '/Library/Application Support/ClaudeCode/managed-settings.json';
  return '/etc/claude-code/managed-settings.json';
}

function loadRules() {
  const files = [
    managedSettingsPath(),
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(ROOT, '.claude', 'settings.json'),
    path.join(ROOT, '.claude', 'settings.local.json'),
  ];
  const rules = { bash: [], read: [], write: [] };
  for (const file of files) {
    let perms;
    try { perms = JSON.parse(fs.readFileSync(file, 'utf8')).permissions; } catch { continue; }
    for (const kind of ['deny', 'ask']) {
      for (const raw of perms?.[kind] ?? []) addRule(rules, kind, String(raw));
    }
  }
  return rules;
}

function addRule(rules, kind, raw) {
  const m = raw.match(/^(\w+)(?:\((.*)\))?$/s);
  if (!m) return;
  const [, tool, spec] = m;
  const entry = { kind, raw };
  if (tool === 'Bash') rules.bash.push({ ...entry, test: spec === undefined ? () => true : bashRuleMatcher(spec) });
  else if (tool === 'Read') rules.read.push({ ...entry, test: spec === undefined ? () => true : pathRuleMatcher(spec) });
  else if (tool === 'Edit' || tool === 'Write') rules.write.push({ ...entry, test: spec === undefined ? () => true : pathRuleMatcher(spec) });
}

function bashRuleMatcher(spec) {
  let s = spec.trim();
  let suffix = '(?:\\s.*)?';
  if (s.endsWith(':*')) { s = s.slice(0, -2); suffix = '.*'; }
  else if (s.endsWith(' *')) s = s.slice(0, -2);
  const body = s.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  const re = new RegExp(`^${body}${suffix}$`, 's');
  return (segment) => re.test(segment);
}

function pathRuleMatcher(spec) {
  const s = spec.trim().replace(/\\/g, '/');
  let full;
  if (s.startsWith('//')) full = s.slice(1).replace(/^\/([a-zA-Z])\//, '$1:/');
  else if (s.startsWith('~/')) full = `${os.homedir().replace(/\\/g, '/')}/${s.slice(2)}`;
  else if (s.startsWith('/')) full = `${ROOT.replace(/\\/g, '/')}${s}`;
  else {
    const rel = s.replace(/^\.\//, '');
    full = `${ROOT.replace(/\\/g, '/')}/${rel.includes('/') ? rel : `**/${rel}`}`;
  }
  const re = globToRegExp(full);
  return (abs) => re.test(abs.replace(/\\/g, '/'));
}

const RULES = loadRules();

const DEFAULT_GUARDS = [
  [/^(sudo|doas)\b/, 'privilege escalation'],
  [/^git\s+(push|commit|reset|clean|rebase|merge|cherry-pick|revert|am|filter-branch|checkout|restore|switch)\b/, 'changes git history, a remote, or the working tree'],
  [/^git\s+stash\s+(drop|clear|pop)\b/, 'changes git stash'],
  [/^git\s+branch\s+.*-[dD]\b/, 'deletes a branch'],
  [/^rm\s+(?:.*\s)?-\w*[rRf]/, 'recursive or forced delete (use remove() so it can be undone)'],
  [/^(rmdir|del|rd|format|mkfs|dd|shutdown|reboot)\b/, 'destructive system command'],
  [/^find\b.*\s-(?:delete|exec(?:dir)?\s+rm)\b/, 'bulk delete'],
  [/^(npm|pnpm|yarn|bun)\s+(publish|unpublish|deprecate|login|adduser|install|i|add|ci|remove|uninstall|update|up)\b/, 'installs or publishes packages'],
  [/^(pip3?|uv\s+pip|poetry|cargo|gem|go|brew|apt|apt-get|choco|winget|scoop)\s+(install|add|publish|upload|get|remove|uninstall)\b/, 'installs or publishes packages'],
  [/^twine\s+upload\b/, 'publishes packages'],
  [/^docker\s+(push|rm|rmi|system\s+prune|compose\s+down)\b/, 'changes containers or a registry'],
  [/^kubectl\s+(apply|delete|patch|replace|scale|rollout)\b/, 'changes a cluster'],
  [/^terraform\s+(apply|destroy|import)\b/, 'changes infrastructure'],
  [/^gh\s+\S+\s+(create|merge|close|delete|edit|comment|review|reopen)\b/, 'changes GitHub state'],
  [/^gh\s+api\b.*(?:-X|--method)\s*(POST|PUT|PATCH|DELETE)\b/i, 'changes GitHub state'],
  [/^(curl|wget)\b.*(\s-X\s*(POST|PUT|PATCH|DELETE)\b|\s--data|\s-d\s|\s-F\s|\s--upload-file|\s-T\s)/i, 'sends data over the network'],
  [/^(scp|rsync|ssh)\b/, 'remote access'],
  [/^(chmod|chown)\b.*\s-R\b/, 'recursive permission change'],
];

function splitCommand(cmd) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < cmd.length; i += 1) {
    const c = cmd[i];
    const next = cmd[i + 1];
    if (quote) {
      cur += c;
      if (c === '\\' && quote === '"') { cur += next ?? ''; i += 1; } else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') { quote = c; cur += c; }
    else if (c === '\\') { cur += c + (next ?? ''); i += 1; }
    else if (c === ';' || c === '\n' || c === '|' || c === '&') {
      if ((c === '&' && (cmd[i - 1] === '>' || next === '>')) || (c === '|' && cmd[i - 1] === '>')) { cur += c; continue; }
      parts.push(cur);
      cur = '';
      if (next === c) i += 1;
    } else cur += c;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function normalizeSegment(segment) {
  let s = segment.replace(/^[({\s]+/, '');
  for (;;) {
    const t = s
      .replace(/^[A-Za-z_]\w*=(?:'[^']*'|"[^"]*"|\S*)\s+/, '')
      .replace(/^(?:command|builtin|exec|nohup|time|env|nice)\s+/, '')
      .replace(/^xargs(?:\s+-\S+)*\s+/, '');
    if (t === s) break;
    s = t;
  }
  s = s.replace(/^(?:\S*[/\\])?([^\s/\\]+?)(?:\.exe)?(?=\s|$)/i, '$1');
  for (;;) {
    const t = s.replace(/^git\s+(?:-C\s+\S+|-c\s+\S+|--\S+)\s+/, 'git ');
    if (t === s) break;
    s = t;
  }
  return s;
}

function commandSegments(cmd, depth = 0) {
  const out = [];
  for (const seg of splitCommand(cmd)) {
    out.push(normalizeSegment(seg));
    if (depth >= 3) continue;
    for (const re of [/\$\(([^()]*)\)/g, /`([^`]*)`/g]) {
      for (const m of seg.matchAll(re)) out.push(...commandSegments(m[1], depth + 1));
    }
    for (const m of seg.matchAll(/\b(?:ba|z|da|k)?sh\s+(?:-\w+\s+)*-\w*c\s+(?:'([^']*)'|"([^"]*)")/g)) {
      out.push(...commandSegments(m[1] ?? m[2], depth + 1));
    }
    const ev = seg.match(/^\s*eval\s+(.*)$/s);
    if (ev) out.push(...commandSegments(ev[1].replace(/^['"]|['"]$/g, ''), depth + 1));
  }
  return out;
}

function commandBlock(cmd) {
  if (/(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(cmd)) return 'pipes a download into a shell';
  for (const seg of commandSegments(cmd)) {
    for (const rule of RULES.bash) if (rule.test(seg)) return `matches your "${rule.kind}" rule ${rule.raw}`;
    for (const [re, why] of DEFAULT_GUARDS) if (re.test(seg)) return why;
  }
  return null;
}

function refuse(target, why) {
  state.refused.push({ target, why });
  throw new RefusedError(`refused: ${target} (${why}). Run it as a normal tool call so the usual permission check applies.`);
}

// ---------------------------------------------------------------- paths

function samePrefix(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function realish(abs) {
  const rest = [];
  let cur = abs;
  for (;;) {
    try { return path.join(fs.realpathSync(cur), ...rest); } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      rest.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

function isSecretName(base) {
  const b = base.toLowerCase();
  if (/\.(example|sample|template|dist)$/.test(b)) return false;
  return /^\.env(\..+)?$/.test(b)
    || /\.(pem|key|p12|pfx|keystore)$/.test(b)
    || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(b)
    || ['.npmrc', '.pypirc', '.netrc', 'credentials', 'credentials.json'].includes(b);
}

function readBlock(abs) {
  if (isSecretName(path.basename(abs))) return 'looks like a secrets file';
  for (const rule of RULES.read) if (rule.test(abs)) return `matches your "${rule.kind}" rule ${rule.raw}`;
  return null;
}

function writeBlock(abs) {
  if (isSecretName(path.basename(abs))) return 'looks like a secrets file';
  const first = path.relative(ROOT, abs).split(path.sep)[0];
  if (PROTECTED_DIRS.has(first)) return `${first}/ is protected`;
  for (const rule of RULES.write) if (rule.test(abs)) return `matches your "${rule.kind}" rule ${rule.raw}`;
  return null;
}

function resolvePath(file, mode) {
  const abs = realish(path.resolve(CWD, String(file)));
  if (!samePrefix(ROOT, abs)) refuse(String(file), 'outside the project');
  const why = mode === 'write' ? writeBlock(abs) : readBlock(abs);
  if (why) refuse(String(file), why);
  return abs;
}

function displayPath(abs) {
  return path.relative(CWD, abs).split(path.sep).join('/');
}

// ---------------------------------------------------------------- file store

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function hasFile(abs) {
  if (state.overlay.has(abs)) return state.overlay.get(abs) !== null;
  try { return fs.statSync(abs).isFile(); } catch { return false; }
}

function getBytes(abs) {
  if (state.overlay.has(abs)) {
    const value = state.overlay.get(abs);
    if (value === null) throw new Error(`${displayPath(abs)}: no such file`);
    return value;
  }
  try { return fs.readFileSync(abs); } catch (e) {
    throw new Error(`${displayPath(abs)}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`);
  }
}

function decodeText(buf, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf);
  } catch {
    throw new Error(`${label}: not valid UTF-8, so it was left alone`);
  }
}

function makeParents(abs) {
  const missing = [];
  let dir = path.dirname(abs);
  while (!fs.existsSync(dir)) {
    missing.unshift(dir);
    dir = path.dirname(dir);
  }
  for (const d of missing) {
    fs.mkdirSync(d);
    if (!state.createdDirs.has(d)) {
      state.createdDirs.add(d);
      journal({ t: 'dir', path: d });
    }
  }
}

function atomicWrite(abs, buf) {
  makeParents(abs);
  const tmp = `${abs}.codemode-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  let mode;
  try { mode = fs.statSync(abs).mode; } catch { /* new file */ }
  try {
    fs.writeFileSync(tmp, buf);
    if (mode !== undefined) fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, abs);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

function putBytes(abs, buf) {
  const before = hasFile(abs) ? getBytes(abs) : null;
  if ((before === null && buf === null) || (before && buf && before.equals(buf))) return false;
  const firstTouch = !state.changed.has(abs);
  if (firstTouch) state.changed.set(abs, { orig: before, cur: before });
  listCache = null;
  if (DRY) {
    state.overlay.set(abs, buf);
  } else {
    if (firstTouch) {
      let backup = null;
      let mode = null;
      if (before) {
        ensureRunDir();
        backup = `${backupCount += 1}.bak`;
        fs.writeFileSync(path.join(runDir, 'backups', backup), before);
        mode = fs.statSync(abs).mode;
      }
      journal({ t: 'file', path: abs, backup, mode });
    }
    if (buf === null) fs.rmSync(abs);
    else atomicWrite(abs, buf);
    journal({ t: 'hash', path: abs, hash: buf ? sha(buf) : null });
  }
  state.changed.get(abs).cur = buf;
  return true;
}

// ---------------------------------------------------------------- listing

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.isFile()) out.push(full);
  }
}

function listFiles() {
  if (listCache) return listCache;
  let abs;
  const r = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: CWD, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  if (r.status === 0) {
    abs = r.stdout.split('\0').filter(Boolean).map((f) => path.resolve(CWD, f));
  } else {
    abs = [];
    walk(CWD, abs);
  }
  const set = new Set(abs);
  for (const [file, value] of state.overlay) {
    if (value === null) set.delete(file);
    else if (samePrefix(CWD, file)) set.add(file);
  }
  let hidden = 0;
  const visible = [];
  for (const file of set) {
    if (!state.overlay.has(file) && !fs.existsSync(file)) continue;
    if (readBlock(file)) { hidden += 1; continue; }
    visible.push(displayPath(file));
  }
  if (hidden) note(`${hidden} secret or denied file(s) were hidden from glob and grep`);
  visible.sort();
  listCache = visible;
  return visible;
}

// ---------------------------------------------------------------- shell

function findShell() {
  if (!WIN) return { file: fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh', args: ['-c'] };
  const candidates = [process.env.CLAUDE_CODE_GIT_BASH_PATH];
  const where = spawnSync('where', ['git'], { encoding: 'utf8', windowsHide: true });
  for (const line of (where.stdout || '').split(/\r?\n/)) {
    if (line.trim()) candidates.push(path.join(path.dirname(path.dirname(line.trim())), 'bin', 'bash.exe'));
  }
  candidates.push('C:\\Program Files\\Git\\bin\\bash.exe');
  for (const c of candidates) if (c && fs.existsSync(c)) return { file: c, args: ['-c'] };
  return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c'] };
}

let shellInfo = null;

function killTree(child) {
  if (WIN) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}

function remainingMs() {
  return Math.max(1, OPTS.timeout - (Date.now() - startedAt));
}

function runShell(cmd, opts = {}) {
  const command = String(cmd);
  const why = commandBlock(command);
  if (why) refuse(command, why);
  if (DRY && !opts.readonly) {
    note('dry run: shell commands without {readonly:true} were skipped');
    return Promise.resolve({ ok: true, skipped: true, code: 0, stdout: '', stderr: '', ms: 0 });
  }
  shellInfo ??= findShell();
  const cwd = opts.cwd ? path.resolve(CWD, String(opts.cwd)) : CWD;
  const limit = Math.min(opts.timeout ?? remainingMs(), remainingMs());
  const began = Date.now();
  listCache = null;
  return new Promise((resolve) => {
    const child = spawn(shellInfo.file, [...shellInfo.args, command], {
      cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: !WIN, windowsVerbatimArguments: shellInfo.file.toLowerCase().endsWith('cmd.exe'),
    });
    state.shells.add(child);
    const chunks = { stdout: [], stderr: [] };
    const sizes = { stdout: 0, stderr: 0 };
    let clipped = false;
    let timedOut = false;
    for (const key of ['stdout', 'stderr']) {
      child[key].on('data', (d) => {
        if (sizes[key] >= MAX_CAPTURE) { clipped = true; return; }
        chunks[key].push(d);
        sizes[key] += d.length;
      });
    }
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, limit);
    const done = (code, spawnError) => {
      clearTimeout(timer);
      state.shells.delete(child);
      const stdout = Buffer.concat(chunks.stdout).toString('utf8');
      const stderr = Buffer.concat(chunks.stderr).toString('utf8') + (spawnError ? `\n${spawnError.message}` : '');
      if (clipped) note('a command printed more than 20 MB; its output was clipped');
      resolve({ ok: code === 0 && !timedOut, code: code ?? -1, stdout, stderr, timedOut, ms: Date.now() - began });
    };
    child.on('error', (e) => done(-1, e));
    child.on('close', (code) => done(code));
  });
}

async function sh(cmd, opts) {
  const r = await runShell(cmd, opts);
  if (!r.ok) {
    const e = new Error(`command ${r.timedOut ? 'timed out' : `failed (exit ${r.code})`}: ${cmd}\n${tail(r.stderr.trim() || r.stdout.trim(), 25)}`);
    e.result = r;
    throw e;
  }
  return r;
}
sh.try = async (cmd, opts) => runShell(cmd, opts);

// ---------------------------------------------------------------- script API

function read(file) {
  const abs = resolvePath(file, 'read');
  return decodeText(getBytes(abs), String(file));
}

function write(file, text) {
  if (typeof text !== 'string') throw new TypeError(`write(${file}): text must be a string`);
  const abs = resolvePath(file, 'write');
  putBytes(abs, Buffer.from(text, 'utf8'));
  return displayPath(abs);
}

function exists(file) {
  const abs = realish(path.resolve(CWD, String(file)));
  return hasFile(abs);
}

function countOf(text, needle) {
  let n = 0;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) n += 1;
  return n;
}

function edit(file, find, replace, { all = false } = {}) {
  const abs = resolvePath(file, 'write');
  resolvePath(file, 'read');
  const text = decodeText(getBytes(abs), String(file));
  let next;
  let n;
  if (find instanceof RegExp) {
    const flags = find.flags.includes('g') ? find.flags : `${find.flags}g`;
    const re = new RegExp(find.source, flags);
    n = [...text.matchAll(re)].length;
    if (n > 1 && !all && !find.flags.includes('g')) throw new Error(`${file}: ${find} matches ${n} times; pass {all:true} or narrow it`);
    next = text.replace(re, replace);
  } else {
    let f = String(find);
    let r = String(replace);
    if (!f) throw new Error(`${file}: find text is empty`);
    n = countOf(text, f);
    if (n === 0 && text.includes('\r\n') && f.includes('\n')) {
      f = f.replace(/\r?\n/g, '\r\n');
      r = r.replace(/\r?\n/g, '\r\n');
      n = countOf(text, f);
    }
    if (n > 1 && !all) throw new Error(`${file}: text matches ${n} times; pass {all:true} or add context`);
    next = text.split(f).join(r);
  }
  if (n === 0) throw new Error(`${file}: text to replace was not found`);
  putBytes(abs, Buffer.from(next, 'utf8'));
  return n;
}

function move(from, to) {
  const src = resolvePath(from, 'write');
  resolvePath(from, 'read');
  const dst = resolvePath(to, 'write');
  if (hasFile(dst)) throw new Error(`move: ${to} already exists`);
  const buf = getBytes(src);
  putBytes(dst, buf);
  putBytes(src, null);
  return displayPath(dst);
}

function remove(file) {
  const abs = resolvePath(file, 'write');
  if (!hasFile(abs)) throw new Error(`${file}: no such file`);
  putBytes(abs, null);
  return displayPath(abs);
}

function glob(pattern = '**/*') {
  const re = globToRegExp(pattern);
  return listFiles().filter((f) => re.test(f));
}

function grep(pattern, { glob: fileGlob = '**/*', max = 200 } = {}) {
  const re = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, '')) : null;
  const needle = re ? null : String(pattern);
  const hits = [];
  for (const file of glob(fileGlob)) {
    const abs = path.resolve(CWD, file);
    let buf;
    try {
      if (!state.overlay.has(abs) && fs.statSync(abs).size > MAX_GREP_FILE) continue;
      buf = getBytes(abs);
    } catch { continue; }
    if (buf.subarray(0, 8000).includes(0)) continue;
    const lines = buf.toString('utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (re ? re.test(lines[i]) : lines[i].includes(needle)) {
        if (hits.length >= max) {
          note(`grep stopped at max=${max}; results are incomplete`);
          return hits;
        }
        hits.push({ file, line: i + 1, text: lines[i].trim().slice(0, 200) });
      }
    }
  }
  return hits;
}

async function pmap(items, fn, { limit = 8, settle = false } = {}) {
  const list = [...items];
  const out = new Array(list.length);
  let next = 0;
  let firstError = null;
  const worker = async () => {
    while (next < list.length) {
      const i = next;
      next += 1;
      try {
        const value = await fn(list[i], i);
        out[i] = settle ? { ok: true, value } : value;
      } catch (e) {
        if (settle) out[i] = { ok: false, item: list[i], error: errorText(e) };
        else {
          firstError ??= e;
          next = list.length;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  if (firstError) throw firstError;
  return out;
}

function head(text, n = 20) {
  const lines = String(text).split(/\r?\n/);
  return lines.length <= n ? lines.join('\n') : `${lines.slice(0, n).join('\n')}\n... ${lines.length - n} more lines`;
}

function tail(text, n = 20) {
  const lines = String(text).split(/\r?\n/);
  return lines.length <= n ? lines.join('\n') : `... ${lines.length - n} earlier lines\n${lines.slice(-n).join('\n')}`;
}

// ---------------------------------------------------------------- report

function lineDiff(beforeText, afterText) {
  const a = beforeText.split('\n');
  const b = afterText.split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end += 1;
  const x = a.slice(start, a.length - end);
  const y = b.slice(start, b.length - end);
  const ops = [];
  if (x.length * y.length > 4_000_000) {
    for (const l of x) ops.push(`-${l}`);
    for (const l of y) ops.push(`+${l}`);
  } else {
    const w = y.length + 1;
    const dp = new Uint16Array((x.length + 1) * w);
    for (let i = x.length - 1; i >= 0; i -= 1) {
      for (let j = y.length - 1; j >= 0; j -= 1) {
        dp[i * w + j] = x[i] === y[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) { i += 1; j += 1; }
      else if (j < y.length && (i >= x.length || dp[i * w + j + 1] >= dp[(i + 1) * w + j])) { ops.push(`+${y[j]}`); j += 1; }
      else { ops.push(`-${x[i]}`); i += 1; }
    }
  }
  return { added: ops.filter((l) => l[0] === '+').length, removed: ops.filter((l) => l[0] === '-').length, ops };
}

function textOrNull(buf) {
  if (!buf) return '';
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return null; }
}

function changeSummary() {
  const lines = [];
  const preview = [];
  for (const [abs, { orig, cur }] of state.changed) {
    if ((orig === null && cur === null) || (orig && cur && orig.equals(cur))) continue;
    const action = orig === null ? 'A' : cur === null ? 'D' : 'M';
    const oldText = textOrNull(orig);
    const newText = textOrNull(cur);
    const file = displayPath(abs);
    if (oldText === null || newText === null) {
      lines.push(`${action} ${file} (binary)`);
      continue;
    }
    const d = lineDiff(oldText, newText);
    lines.push(`${action} ${file} +${d.added} -${d.removed}`);
    if (DRY && preview.length < 60) {
      preview.push(`@@ ${file}`);
      preview.push(...d.ops.slice(0, 8).map((l) => l.slice(0, 160)));
      if (d.ops.length > 8) preview.push(`... ${d.ops.length - 8} more changed lines`);
    }
  }
  return { lines, preview: preview.slice(0, 60) };
}

function toJson(value) {
  const replacer = (_key, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Map) return Object.fromEntries(v);
    if (v instanceof Set) return [...v];
    if (v instanceof Error) return errorText(v);
    return v;
  };
  try {
    return JSON.stringify(value, replacer);
  } catch {
    return JSON.stringify(util.inspect(value, { depth: 4, breakLength: Infinity }));
  }
}

function errorText(e) {
  if (!(e instanceof Error)) return String(e);
  const where = String(e.stack || '').match(/codemode-script\.js:(\d+)/);
  return where ? `${e.message} (script line ${where[1]})` : e.message;
}

function finish(ok, result, error) {
  if (finished) return;
  finished = true;
  for (const child of state.shells) killTree(child);
  const { lines, preview } = changeSummary();
  const report = { ok, run: runId };
  if (DRY) report.dryRun = true;
  if (error) report.error = error;
  if (result !== undefined) report.result = result;
  if (lines.length) {
    report.changedCount = lines.length;
    report.changed = lines.slice(0, 40);
    if (lines.length > 40) report.changed.push(`... ${lines.length - 40} more`);
    if (!DRY) report.undo = `--undo=${runId}`;
  }
  if (preview.length) report.preview = preview;
  if (state.refused.length) report.refused = state.refused;
  if (state.notes.length) report.notes = state.notes;
  if (state.logs.length) report.logs = state.logs.join('\n');
  report.ms = Date.now() - startedAt;

  let text = toJson(report);
  if (text.length > OPTS.maxOutput) {
    ensureRunDir();
    const full = path.join(runDir, 'output.json');
    fs.writeFileSync(full, text);
    const room = Math.max(400, OPTS.maxOutput - 900);
    const short = { ...report, truncated: true, full };
    if (short.logs) short.logs = tail(short.logs, 8).slice(-Math.floor(room / 4));
    if (short.preview) short.preview = short.preview.slice(0, 12);
    if (short.changed && short.changed.length > 15) short.changed = [...short.changed.slice(0, 15), `... ${lines.length - 15} more, see full`];
    if (short.result !== undefined) {
      const body = toJson(short.result) ?? '';
      if (body.length > room / 2) short.result = `${body.slice(0, Math.floor(room / 2))} ... [cut, see full]`;
    }
    text = toJson(short);
    if (text.length > OPTS.maxOutput) {
      text = toJson({ ok, run: runId, error: error?.slice(0, 500), changedCount: lines.length || undefined, undo: short.undo, truncated: true, full, ms: report.ms });
    }
  }
  process.stdout.write(`${text}\n`, () => process.exit(ok ? 0 : 1));
}

// ---------------------------------------------------------------- undo

function findRunForUndo(id) {
  if (id !== 'last') {
    if (!/^[\w-]+$/.test(id)) usageError('invalid run id');
    const dir = path.join(RUNS_DIR, id);
    return fs.existsSync(path.join(dir, 'journal.jsonl')) ? dir : null;
  }
  let best = null;
  let names = [];
  try { names = fs.readdirSync(RUNS_DIR); } catch { return null; }
  for (const name of names) {
    const dir = path.join(RUNS_DIR, name);
    try {
      if (!fs.existsSync(path.join(dir, 'journal.jsonl')) || fs.existsSync(path.join(dir, 'undone'))) continue;
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
      if (path.relative(meta.root, ROOT) === '' && (!best || meta.time > best.time)) best = { dir, time: meta.time };
    } catch { /* skip damaged run */ }
  }
  return best?.dir ?? null;
}

function undoRun(id, force) {
  const dir = findRunForUndo(id);
  if (!dir) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: `no undoable run found for ${id}` })}\n`);
    process.exit(1);
  }
  if (fs.existsSync(path.join(dir, 'undone')) && !force) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: 'that run was already undone' })}\n`);
    process.exit(1);
  }
  const files = new Map();
  const dirs = [];
  for (const line of fs.readFileSync(path.join(dir, 'journal.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.t === 'dir') dirs.push(e.path);
    else if (e.t === 'file') files.set(e.path, { backup: e.backup, mode: e.mode, hash: undefined });
    else if (e.t === 'hash' && files.has(e.path)) files.get(e.path).hash = e.hash;
  }
  const restored = [];
  const removed = [];
  const conflicts = [];
  for (const [file, info] of files) {
    let current = null;
    try { current = sha(fs.readFileSync(file)); } catch { /* file is gone */ }
    if (info.hash !== undefined && current !== info.hash && !force) {
      conflicts.push(path.relative(CWD, file).split(path.sep).join('/'));
      continue;
    }
    const label = path.relative(CWD, file).split(path.sep).join('/');
    if (info.backup) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, fs.readFileSync(path.join(dir, 'backups', info.backup)));
      if (info.mode !== null && info.mode !== undefined) fs.chmodSync(file, info.mode);
      restored.push(label);
    } else {
      fs.rmSync(file, { force: true });
      removed.push(label);
    }
  }
  for (const d of dirs.reverse()) {
    try { fs.rmdirSync(d); } catch { /* not empty, keep it */ }
  }
  if (!conflicts.length) fs.writeFileSync(path.join(dir, 'undone'), String(Date.now()));
  const report = { ok: conflicts.length === 0, run: path.basename(dir), restored, removed };
  if (conflicts.length) {
    report.conflicts = conflicts;
    report.error = 'these files changed after the run and were left alone; rerun with --force to overwrite them';
  }
  process.stdout.write(`${JSON.stringify(report)}\n`, () => process.exit(report.ok ? 0 : 1));
}

// ---------------------------------------------------------------- main

function readScript() {
  if (OPTS.file && OPTS.file !== '-') {
    try { return fs.readFileSync(path.resolve(CWD, OPTS.file), 'utf8'); } catch (e) { usageError(`cannot read script: ${e.message}`); }
  }
  if (process.stdin.isTTY) usageError('no script given; pass a file or pipe one to stdin');
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function startWatchdog() {
  const message = `${JSON.stringify({ ok: false, run: runId, error: `script blocked past the ${OPTS.timeout} ms limit and was killed`, undo: `--undo=${runId}` })}\n`;
  const source = `
    const { workerData: { pid, ms, message } } = require('node:worker_threads');
    const fs = require('node:fs');
    setTimeout(() => { try { fs.writeSync(1, message); } catch {} process.kill(pid, 'SIGKILL'); }, ms);
  `;
  const worker = new Worker(source, { eval: true, workerData: { pid: process.pid, ms: OPTS.timeout + 2000, message } });
  worker.unref();
}

async function main() {
  if (OPTS.undo) {
    undoRun(OPTS.undo, OPTS.force);
    return;
  }
  const code = readScript();
  if (!code.trim()) usageError('script is empty');
  pruneOldRuns();

  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    console[level] = (...args) => { state.logs.push(util.format(...args)); };
  }
  process.on('uncaughtException', (e) => finish(false, undefined, errorText(e)));
  process.on('unhandledRejection', (e) => finish(false, undefined, errorText(e)));

  startWatchdog();
  const deadline = setTimeout(() => finish(false, undefined, `script timed out after ${OPTS.timeout} ms; use --timeout to allow longer`), OPTS.timeout);
  deadline.unref();

  const api = { sh, read, write, exists, edit, move, remove, glob, grep, pmap, head, tail, path, cwd: CWD, root: ROOT, dryRun: DRY };
  const names = Object.keys(api);
  let fn;
  try {
    const script = new vm.Script(`(async (${names.join(',')}) => {\n${code}\n})`, {
      filename: 'codemode-script.js',
      lineOffset: -1,
      importModuleDynamically: vm.constants?.USE_MAIN_CONTEXT_DEFAULT_LOADER,
    });
    fn = script.runInThisContext();
  } catch (e) {
    const hint = /import statement/.test(e.message) ? ' Use: const x = await import("node:x")' : '';
    finish(false, undefined, `syntax error: ${errorText(e)}${hint}`);
    return;
  }
  try {
    const result = await fn(...names.map((n) => api[n]));
    finish(true, result);
  } catch (e) {
    finish(false, undefined, errorText(e));
  }
}

main();
