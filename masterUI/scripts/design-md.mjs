#!/usr/bin/env node
// Fetch a brand DESIGN.md from VoltAgent/awesome-design-md (MIT).
//
//   node design-md.mjs list                         # every available brand slug
//   node design-md.mjs find <words>                 # slugs matching e.g. "linear", "stripe"
//   node design-md.mjs get <slug> --out <file> [--force]
//
// Uses process.exitCode, not process.exit(): exiting with fetch sockets open trips a libuv assert on Windows.
// `get` refuses to overwrite an existing file unless --force is given.

import fs from "node:fs";
import path from "node:path";

const REPO = "VoltAgent/awesome-design-md";
const API = `https://api.github.com/repos/${REPO}/contents/design-md`;
const RAW = (slug) => `https://raw.githubusercontent.com/${REPO}/main/design-md/${encodeURIComponent(slug)}/DESIGN.md`;
const headers = { "User-Agent": "master-ui-skill", Accept: "application/vnd.github+json" };

async function slugs() {
  const res = await fetch(API, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} listing ${REPO}`);
  return (await res.json()).filter((e) => e.type === "dir").map((e) => e.name).sort();
}

const norm = (s) => s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[^a-z0-9.]+/g, "");

function match(all, query) {
  const q = norm(query);
  const exact = all.filter((s) => norm(s) === q || norm(s).replace(/\..*$/, "") === q.replace(/\..*$/, ""));
  if (exact.length) return exact;
  return all.filter((s) => norm(s).includes(q) || q.includes(norm(s).replace(/\..*$/, "")));
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "list") {
    console.log((await slugs()).join("\n"));
  } else if (cmd === "find") {
    const hits = match(await slugs(), rest.join(" "));
    console.log(hits.length ? hits.join("\n") : "no match");
    process.exitCode = hits.length ? 0 : 1;
  } else if (cmd === "get") {
    const slug = rest[0];
    const outIdx = rest.indexOf("--out");
    const force = rest.includes("--force");
    if (!slug || outIdx < 0 || !rest[outIdx + 1]) throw new Error("usage: get <slug> --out <file> [--force]");
    const out = path.resolve(rest[outIdx + 1]);
    if (fs.existsSync(out) && !force) throw new Error(`${out} exists; pass --force to replace it`);
    const res = await fetch(RAW(slug), { headers: { "User-Agent": headers["User-Agent"] } });
    if (!res.ok) throw new Error(`no DESIGN.md for "${slug}" (HTTP ${res.status}); try: design-md.mjs find ${slug}`);
    const body = await res.text();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `<!-- Source: ${REPO} design-md/${slug}/DESIGN.md (MIT). A style reference, not the brand's own assets. -->\n\n${body}`);
    console.log(`wrote ${out} (${body.length} chars) from ${slug}`);
  } else {
    console.log("usage: design-md.mjs list | find <words> | get <slug> --out <file> [--force]");
    process.exitCode = cmd ? 2 : 0;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
