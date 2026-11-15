#!/usr/bin/env python3
"""graph-memory helper: per-folder project memory on top of graphify.

Run it from inside a project. The project root is the nearest folder at or above
the current one that has graphify-out/graph.json or a graph-memory section in its
CLAUDE.md. `init` always works on the current folder.

  session-start [--plain]   context for a new chat: JSON for the SessionStart hook,
                            plain text with --plain (used by /graph-memory resume)
  status [--benchmark]      health of this folder's graph memory
  init [--no-git-hooks] [--guard]
                            set up graph memory in the current folder
  update [--force]          refresh the graph after code changes (parser only, no LLM)
  nodes WORD [WORD ...]     node labels that match the words: a cheap vocabulary lookup
  remove [--dry-run] [--git-hooks] [--guard] [--purge --yes]
                            undo init (keeps the graph and the notes unless --purge)

Standard library only, so it starts fast and needs nothing installed.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

OUT = "graphify-out"
NOTES_REL = ".claude/graph-memory.md"
MARK_START = "<!-- graph-memory:start -->"
MARK_END = "<!-- graph-memory:end -->"
SECTION_RE = re.compile(re.escape(MARK_START) + r".*?" + re.escape(MARK_END) + r"\n?", re.S)
RC_NAME = ".graphifyrc"
RC_BLOCK = "# added by graph-memory: keep graphify query answers small by default\nquery_budget=1000\n"
IGNORE_NAME = ".graphifyignore"
IGNORE_BLOCK = ("# added by graph-memory: Claude reads these directly, so keep them out of the graph\n"
                ".claude/\nCLAUDE.md\n")
HOT_SECTIONS = ("now", "rules", "overview")
HOT_SECTION_MAX = 10
HOT_TOTAL_MAX = 30
NOTES_SOFT_CAP = 80
DOCS_HEAVY = 15

SKILL_DIR = Path(__file__).resolve().parent.parent
TEMPLATE = SKILL_DIR / "assets" / "notes-template.md"
SECTION_TEXT = SKILL_DIR / "assets" / "claude-md-section.md"

CODE_EXTS = {
    ".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".go", ".rs", ".java", ".kt", ".kts",
    ".swift", ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".cs", ".rb", ".php", ".scala", ".lua",
    ".dart", ".vue", ".svelte", ".m", ".mm", ".ex", ".exs", ".jl", ".zig", ".sh", ".ps1", ".sql",
}
DOC_EXTS = {".md", ".mdx", ".rst", ".txt", ".adoc", ".pdf", ".docx"}
HUB_NOISE = re.compile(r"^(test_|Test|Fake|Mock|Stub)")


# ---------------------------------------------------------------- small helpers

def say(text: str = "") -> None:
    sys.stdout.write(text + "\n")


def posix(path: Path) -> str:
    return path.as_posix()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_keeping_newlines(path: Path, text: str) -> None:
    """Write text, keeping CRLF line endings if the existing file used them."""
    newline = "\n"
    try:
        if b"\r\n" in path.read_bytes():
            newline = "\r\n"
    except OSError:
        pass
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline=newline) as handle:
        handle.write(text)


def human_age(seconds: float) -> str:
    whole = max(0, int(seconds))
    for unit, size in (("d", 86400), ("h", 3600), ("min", 60)):
        if whole >= size:
            return f"{whole // size}{unit}"
    return f"{whole}s"


def md5_of(path: Path) -> str | None:
    digest = hashlib.md5()
    try:
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
    except OSError:
        return None
    return digest.hexdigest()


def read_stdin(timeout: float = 2.0) -> str:
    """Read the hook's stdin without ever hanging on a pipe that stays open."""
    chunks: list[bytes] = []

    def reader() -> None:
        try:
            chunks.append(sys.stdin.buffer.read())
        except (OSError, ValueError, AttributeError):
            pass

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()
    thread.join(timeout)
    return chunks[0].decode("utf-8-sig", "replace") if chunks else ""  # -sig: drop a BOM


# ---------------------------------------------------------------- project facts

def has_section(folder: Path) -> bool:
    return MARK_START in read_text(folder / "CLAUDE.md")


def find_root(start: Path) -> Path | None:
    """Nearest folder at or above `start` with a graph or a graph-memory section.

    Stops at the home folder: a graph there is almost never meant for every
    project below it.
    """
    try:
        start = start.resolve()
        home = Path.home().resolve()
    except OSError:
        return None
    for folder in (start, *start.parents):
        if (folder / OUT / "graph.json").is_file() or has_section(folder):
            return folder
        if folder == home:
            break
    return None


def report_info(root: Path) -> dict:
    """Counts, build commit and hub names from GRAPH_REPORT.md (cheaper than loading graph.json)."""
    text = read_text(root / OUT / "GRAPH_REPORT.md")
    info: dict = {}
    match = re.search(r"([\d,]+) nodes\W+([\d,]+) edges", text)
    if match:
        info["nodes"], info["edges"] = match.group(1), match.group(2)
    match = re.search(r"Built from commit: `([0-9a-f]+)`", text)
    if match:
        info["commit"] = match.group(1)
    match = re.search(r"^## God Nodes[^\n]*\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    if match:
        names = re.findall(r"^\d+\.\s+`([^`]+)`", match.group(1), re.M)
        info["hubs"] = [name for name in names if not HUB_NOISE.match(name)]
    return info


def git(root: Path, *args: str, timeout: float = 5) -> str | None:
    """stdout of a git command run in `root`, or None when git fails or is missing."""
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout if result.returncode == 0 else None


def is_git(root: Path) -> bool:
    return (git(root, "rev-parse", "--is-inside-work-tree") or "").strip() == "true"


def git_hooks_installed(root: Path) -> bool:
    hook_path = (git(root, "rev-parse", "--git-path", "hooks/post-commit") or "").strip()
    if not hook_path:
        return False
    hook = Path(hook_path)
    if not hook.is_absolute():
        hook = root / hook
    return "graphify" in read_text(hook)


def guard_installed(root: Path) -> bool:
    return any("hook-guard" in read_text(root / ".claude" / name)
               for name in ("settings.json", "settings.local.json"))


def global_hook_installed() -> bool:
    config = Path(os.environ.get("CLAUDE_CONFIG_DIR") or (Path.home() / ".claude"))
    text = read_text(config / "settings.json")
    return "gm.py" in text and "session-start" in text


def stale_files(root: Path) -> list[str]:
    """Files changed or deleted since the last build, plus new untracked code files.

    A file whose timestamp moved but whose content hash still matches the build
    (a checkout, a formatter that changed nothing) does not count.
    """
    manifest = load_json(root / OUT / "manifest.json")
    if not isinstance(manifest, dict):
        return []
    changed: list[str] = []
    for rel, meta in manifest.items():
        if not isinstance(meta, dict):
            continue
        path = root / rel
        try:
            mtime = path.stat().st_mtime
        except FileNotFoundError:
            changed.append(f"{rel} (deleted)")
            continue
        except OSError:
            continue
        recorded = meta.get("mtime")
        if isinstance(recorded, (int, float)) and abs(mtime - recorded) < 0.01:
            continue
        digest = meta.get("ast_hash")
        if digest and md5_of(path) == digest:
            continue
        changed.append(rel)
    untracked = git(root, "ls-files", "--others", "--exclude-standard")
    for rel in (untracked or "").splitlines():
        rel = rel.strip()
        if rel and rel not in manifest and not rel.startswith(OUT + "/") \
                and Path(rel).suffix.lower() in CODE_EXTS:
            changed.append(f"{rel} (new)")
    return changed


def corpus_counts(root: Path) -> tuple[int, int]:
    manifest = load_json(root / OUT / "manifest.json")
    if not isinstance(manifest, dict):
        return 0, 0
    suffixes = [Path(key).suffix.lower() for key in manifest]
    return (sum(1 for s in suffixes if s in CODE_EXTS), sum(1 for s in suffixes if s in DOC_EXTS))


def note_sections(path: Path) -> dict[str, list[str]]:
    """Non-empty lines of each `## Section` in the notes, HTML comments removed."""
    text = re.sub(r"<!--.*?-->", "", read_text(path), flags=re.S)
    sections: dict[str, list[str]] = {}
    current = None
    for line in text.splitlines():
        heading = re.match(r"^##\s+(\S+)", line)
        if heading:
            current = heading.group(1).strip(":").lower()
            sections.setdefault(current, [])
        elif current is not None and line.strip():
            sections[current].append(line.rstrip())
    return sections


def hot_lines(path: Path) -> list[str]:
    """The sections every new chat should see, capped so the note stays small."""
    sections = note_sections(path)
    lines: list[str] = []
    total = 0
    for name in HOT_SECTIONS:
        body = sections.get(name) or []
        if not body:
            continue
        room = min(HOT_SECTION_MAX, HOT_TOTAL_MAX - total)
        if room <= 0:
            lines.append(f"(more sections cut; read {NOTES_REL})")
            break
        shown = body[:room]
        lines.append(f"[{name.title()}]")
        lines.extend(shown)
        if len(body) > len(shown):
            lines.append(f"  (+{len(body) - len(shown)} more lines in {NOTES_REL})")
        total += len(shown)
    return lines


def session_note(root: Path, cwd: Path) -> str:
    lines: list[str] = []
    graph = root / OUT / "graph.json"
    where = posix(root)
    if graph.is_file():
        info = report_info(root)
        size = f", {info['nodes']} nodes" if info.get("nodes") else ""
        age = human_age(time.time() - graph.stat().st_mtime)
        lines.append(f"graph-memory: graph for {where} built {age} ago{size}.")
        try:
            in_root = cwd.resolve() == root
        except OSError:
            in_root = True
        if not in_root:
            lines.append(f"Run graphify commands from {where}.")
        stale = stale_files(root)
        if stale:
            shown = ", ".join(stale[:6]) + (f" and {len(stale) - 6} more" if len(stale) > 6 else "")
            lines.append(f"Changed since that build: {shown}. "
                         "Run `graphify update .` before trusting the graph for them.")
        if (root / OUT / "needs_update").exists():
            lines.append("Docs changed since the last semantic build; "
                         "`/graph-memory update --docs` refreshes them (costs tokens).")
        if info.get("hubs"):
            lines.append("Hub symbols: " + ", ".join(info["hubs"][:8]) + ".")
        if not has_section(root):
            lines.append("Graph memory is not set up here. For code questions, use the graph-memory "
                         "skill's lookup rules rather than loading the whole graphify skill; "
                         "`/graph-memory init` sets it up.")
    else:
        lines.append(f"graph-memory is set up for {where} but {OUT}/graph.json is missing; "
                     "run `/graph-memory update` to rebuild it.")
    notes = root / NOTES_REL
    if notes.is_file():
        hot = hot_lines(notes)
        if hot:
            lines.append(f"Project notes ({NOTES_REL}; Decisions and Log stay in the file):")
            lines.extend(hot)
        else:
            lines.append(f"Project notes ({NOTES_REL}) are still empty.")
    return "\n".join(lines)


# ---------------------------------------------------------------- graphify calls

def graphify_exe() -> str | None:
    found = shutil.which("graphify")
    if found:
        return found
    base = Path(sys.executable).parent
    for candidate in (base / "Scripts" / "graphify.exe", base / "Scripts" / "graphify", base / "graphify"):
        if candidate.is_file():
            return str(candidate)
    return None


def run_graphify(exe: str, args: list[str], root: Path, timeout: int = 1800) -> tuple[int, str]:
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    try:
        result = subprocess.run(
            [exe, *args], cwd=str(root), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout, env=env,
        )
    except subprocess.TimeoutExpired:
        return 124, f"graphify {' '.join(args)} timed out after {timeout}s"
    except OSError as error:
        return 127, str(error)
    return result.returncode, (result.stdout or "") + (result.stderr or "")


def tail(log: str, count: int) -> str:
    keep = [line for line in log.splitlines() if line.strip() and not line.startswith("Tip:")]
    return "\n".join("    " + line for line in keep[-count:])


# ---------------------------------------------------------------- setup files

def write_section(root: Path) -> str:
    body = read_text(SECTION_TEXT).strip()
    if not body:
        return f"! CLAUDE.md section text missing at {posix(SECTION_TEXT)}"
    path = root / "CLAUDE.md"
    block = f"{MARK_START}\n{body}\n{MARK_END}\n"
    text = read_text(path)
    if SECTION_RE.search(text):
        new = SECTION_RE.sub(lambda _match: block, text, count=1)
        if new == text:
            return "= CLAUDE.md: graph-memory section already current"
        write_keeping_newlines(path, new)
        return "+ CLAUDE.md: graph-memory section updated"
    write_keeping_newlines(path, (text.rstrip() + "\n\n" if text.strip() else "") + block)
    return "+ CLAUDE.md: graph-memory section " + ("added" if text.strip() else "written (new file)")


def remove_section(root: Path, dry: bool) -> str | None:
    path = root / "CLAUDE.md"
    text = read_text(path)
    match = SECTION_RE.search(text)
    if not match:
        return None
    before, after = text[:match.start()].rstrip("\n"), text[match.end():].lstrip("\n")
    new = f"{before}\n\n{after}" if before and after else (f"{before}\n" if before else after)
    if dry:
        return "would remove the graph-memory section from CLAUDE.md" + (
            "" if new.strip() else " (and delete CLAUDE.md, which holds nothing else)")
    if new.strip():
        write_keeping_newlines(path, new)
        return "- removed the graph-memory section from CLAUDE.md"
    path.unlink()
    return "- deleted CLAUDE.md (it held only the graph-memory section)"


def ensure_notes(root: Path) -> str:
    path = root / NOTES_REL
    if path.exists():
        return f"= notes already exist: {NOTES_REL} ({len(read_text(path).splitlines())} lines)"
    template = read_text(TEMPLATE)
    if not template:
        return f"! notes template missing at {posix(TEMPLATE)}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(template.replace("{project}", root.name), encoding="utf-8")
    return f"+ notes created: {NOTES_REL}"


def ensure_rc(root: Path) -> str:
    path = root / RC_NAME
    text = read_text(path)
    if re.search(r"^\s*query_budget\s*=", text, re.M):
        return "= .graphifyrc already sets query_budget"
    write_keeping_newlines(path, (text.rstrip("\n") + "\n" if text.strip() else "") + RC_BLOCK)
    return "+ .graphifyrc: query_budget=1000, so graphify query answers stay small"


def ensure_ignore(root: Path) -> tuple[bool, str]:
    """Keep the notes and CLAUDE.md out of the graph: they reach Claude directly."""
    path = root / IGNORE_NAME
    text = read_text(path)
    if IGNORE_BLOCK in text:
        return False, "= .graphifyignore already excludes .claude/ and CLAUDE.md"
    write_keeping_newlines(path, (text.rstrip("\n") + "\n" if text.strip() else "") + IGNORE_BLOCK)
    return True, "+ .graphifyignore: .claude/ and CLAUDE.md kept out of the graph (Claude reads them directly)"


def remove_block(root: Path, name: str, block: str, what: str, dry: bool) -> str | None:
    path = root / name
    text = read_text(path)
    if block not in text:
        return None
    if dry:
        return f"would remove graph-memory's {what} lines from {name}"
    new = text.replace(block, "", 1)
    if new.strip():
        write_keeping_newlines(path, new)
    else:
        path.unlink()
    return f"- removed graph-memory's {what} lines from {name}"


# ---------------------------------------------------------------- commands

def cmd_session_start(args) -> int:
    if args.plain:
        cwd = Path.cwd()
    else:
        cwd = Path(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
        raw = read_stdin()
        try:
            data = json.loads(raw) if raw.strip() else {}
        except ValueError:
            data = {}
        if isinstance(data, dict) and data.get("cwd"):
            cwd = Path(data["cwd"])
    root = find_root(cwd)
    if args.plain:
        say(session_note(root, cwd) if root else
            "No graph memory for this folder or its parents. `/graph-memory init` sets it up.")
        return 0
    if root:
        payload = {"hookSpecificOutput": {"hookEventName": "SessionStart",
                                          "additionalContext": session_note(root, cwd)}}
        sys.stdout.buffer.write((json.dumps(payload, ensure_ascii=True) + "\n").encode("ascii"))
    return 0


def cmd_status(args) -> int:
    cwd = Path.cwd()
    root = find_root(cwd)
    hook_state = "installed" if global_hook_installed() else "not installed"
    if not root:
        say(f"No graph memory in {posix(cwd.resolve())} or its parents. `/graph-memory init` sets it up.")
        say(f"global SessionStart hook: {hook_state}")
        return 0
    say(f"graph-memory status: {posix(root)}")
    graph = root / OUT / "graph.json"
    if graph.is_file():
        info = report_info(root)
        age = human_age(time.time() - graph.stat().st_mtime)
        say(f"  graph:     built {age} ago, {info.get('nodes', '?')} nodes, {info.get('edges', '?')} edges")
        stale = stale_files(root)
        if stale:
            more = " ..." if len(stale) > 10 else ""
            say(f"  changed:   {len(stale)} since build: " + ", ".join(stale[:10]) + more)
        else:
            say("  changed:   nothing since build")
        if (root / OUT / "needs_update").exists():
            say("  docs:      semantic re-extraction pending (`/graph-memory update --docs`, costs tokens)")
    else:
        say(f"  graph:     missing ({OUT}/graph.json); run `/graph-memory update`")
    notes = root / NOTES_REL
    if notes.is_file():
        count = len(read_text(notes).splitlines())
        over = f" (over ~{NOTES_SOFT_CAP}: prune with /graph-memory save)" if count > NOTES_SOFT_CAP else ""
        say(f"  notes:     {NOTES_REL}, {count} lines{over}")
    else:
        say(f"  notes:     none ({NOTES_REL})")
    say("  CLAUDE.md: graph-memory section " + ("present" if has_section(root) else "missing (run init)"))
    say("  guard:     graphify PreToolUse guard " + ("on" if guard_installed(root) else "off"))
    if is_git(root):
        say("  git hooks: " + ("installed" if git_hooks_installed(root) else "not installed"))
    else:
        say("  git hooks: n/a (not a git repo)")
    budget = re.search(r"^\s*query_budget\s*=\s*(\d+)", read_text(root / RC_NAME), re.M)
    say("  query cap: " + (f"{budget.group(1)} tokens (.graphifyrc)" if budget else "graphify default (2000 tokens)"))
    say(f"  global:    SessionStart hook {hook_state}")
    if args.benchmark and graph.is_file():
        exe = graphify_exe()
        if exe:
            _code, log = run_graphify(exe, ["benchmark"], root, timeout=300)
            for line in log.splitlines():
                if any(key in line for key in ("Corpus:", "Avg query cost", "Reduction")):
                    say("  benchmark: " + line.strip())
    return 0


def cmd_init(args) -> int:
    root = Path.cwd().resolve()
    say(f"graph-memory init in {posix(root)}")
    if root.parent != root:
        parent = find_root(root.parent)
        if parent:
            say(f"! a parent folder already has graph memory: {posix(parent)}. "
                "This sets up a separate one for this folder.")
    exe = graphify_exe()
    if not exe:
        say("x graphify CLI not found. Install it with `pip install graphifyy`, then run init again.")
        return 2
    ignore_added, ignore_message = ensure_ignore(root)
    say(ignore_message)
    say(ensure_rc(root))
    had_graph = (root / OUT / "graph.json").is_file()
    # Newly ignored files make the graph smaller on purpose; graphify refuses that without --force.
    build = ["update", "."] + (["--force"] if had_graph and ignore_added else [])
    started = time.time()
    code, log = run_graphify(exe, build, root)
    if code != 0:
        say(f"x `graphify update .` failed (exit {code}):")
        say(tail(log, 15))
        return code
    info = report_info(root)
    say(f"+ graph {'refreshed' if had_graph else 'built'} in {time.time() - started:.0f}s: "
        f"{info.get('nodes', '?')} nodes, {info.get('edges', '?')} edges (parser only, no tokens)")
    if is_git(root):
        if args.no_git_hooks:
            say("- git hooks skipped (--no-git-hooks)")
        elif git_hooks_installed(root):
            say("= graphify git hooks already installed")
        else:
            code, log = run_graphify(exe, ["hook", "install"], root, timeout=120)
            say("+ git hooks installed: the graph rebuilds in the background after commit, checkout, "
                "merge and rebase" if code == 0 else "! git hook install failed:\n" + tail(log, 4))
        if git(root, "check-ignore", "-q", OUT) is None:
            say(f"i {OUT}/ is not git-ignored; add it to .gitignore unless you want the graph committed")
    else:
        say("- not a git repo: no auto-rebuild hooks; run /graph-memory update after code changes")
    if args.guard:
        code, log = run_graphify(exe, ["claude", "install"], root, timeout=120)
        say("+ graphify guard installed (PreToolUse hooks in .claude/settings.json and graphify's "
            "CLAUDE.md section)" if code == 0 else "! graphify claude install failed:\n" + tail(log, 4))
    say(write_section(root))
    say(ensure_notes(root))
    code_files, doc_files = corpus_counts(root)
    say(f"i indexed: {code_files} code files, {doc_files} doc files")
    if doc_files >= DOCS_HEAVY:
        say("i docs-heavy folder: `/graph-memory update --docs` adds semantic doc extraction (costs tokens)")
    if not global_hook_installed():
        say("! the global SessionStart hook is not installed; run `python "
            + posix(SKILL_DIR / "scripts" / "install.py") + "`")
    if not note_sections(root / NOTES_REL).get("overview"):
        say(f"next: fill the Overview section of {NOTES_REL} (about 5 lines, from the README, "
            "the package manifest and GRAPH_REPORT.md)")
    return 0


def cmd_update(args) -> int:
    root = find_root(Path.cwd()) or Path.cwd().resolve()
    exe = graphify_exe()
    if not exe:
        say("x graphify CLI not found. Install it with `pip install graphifyy`.")
        return 2
    before = report_info(root).get("nodes", "0")
    started = time.time()
    code, log = run_graphify(exe, ["update", "."] + (["--force"] if args.force else []), root)
    if code != 0:
        say(f"x `graphify update .` failed (exit {code}):")
        say(tail(log, 12))
        if "--force" in log and not args.force:
            say("i if code was deleted or moved on purpose, run `gm.py update --force`")
        return code
    after = report_info(root).get("nodes", "?")
    say(f"+ graph updated in {time.time() - started:.0f}s for {posix(root)}: {before} -> {after} nodes")
    if "--force" in log and not args.force:
        say(tail(log, 4))
        say("i graphify may have kept the old graph; if code was deleted or moved on purpose, "
            "run `gm.py update --force`")
    stale = stale_files(root)
    if stale:
        say("! still differs from the graph: " + ", ".join(stale[:8]))
    if (root / OUT / "needs_update").exists():
        say("i docs changed since the last semantic build: `/graph-memory update --docs` refreshes them "
            "(costs tokens)")
    if not has_section(root):
        say("i graph memory is not set up here; `/graph-memory init` adds the notes and CLAUDE.md rules")
    return 0


def split_identifier(label: str) -> list[str]:
    parts = re.findall(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+", label)
    return [part.lower() for part in parts if len(part) >= 3]


def cmd_nodes(args) -> int:
    root = find_root(Path.cwd())
    data = load_json(root / OUT / "graph.json") if root else None
    if not isinstance(data, dict):
        say("No graph found here or in parent folders.")
        return 1
    nodes = []
    for node in data.get("nodes", []):
        if not isinstance(node, dict):
            continue
        label = str(node.get("label") or node.get("id") or "")
        source = str(node.get("source_file") or "")
        if label and source:  # nodes without a source are external modules (json, datetime, ...)
            nodes.append((label, source, str(node.get("source_location") or "")))
    terms = [word.lower() for word in args.words if word.strip()]
    scored: dict[tuple[str, str, str], int] = {}
    for entry in nodes:
        label, source = entry[0].lower(), entry[1].lower()
        score = sum(2 for term in terms if term in label) + sum(1 for term in terms if term in source)
        if score:
            scored[entry] = score
    if not scored:
        vocab: dict[str, list[tuple[str, str, str]]] = {}
        for entry in nodes:
            for token in split_identifier(entry[0]):
                vocab.setdefault(token, []).append(entry)
        for term in terms:
            for match in difflib.get_close_matches(term, list(vocab), n=3, cutoff=0.75):
                for entry in vocab[match]:
                    scored.setdefault(entry, 1)
    if not scored:
        say("No node labels resemble those words. The code may use other names: grep for a literal string.")
        return 4

    def is_test(source: str) -> bool:
        return bool(re.search(r"(^|[/\\_.-])(tests?|spec|__tests__)([/\\_.-]|$)", source.lower()))

    # Best score first, then real code before tests, then shorter (more specific) labels.
    ranked = sorted(scored.items(), key=lambda item: (-item[1], is_test(item[0][1]), len(item[0][0])))
    for (label, source, location), _score in ranked[: args.limit]:
        say(f"{label}  {source}" + (f":{location}" if location else ""))
    if len(ranked) > args.limit:
        say(f"(+{len(ranked) - args.limit} more; add words to narrow it down)")
    return 0


def cmd_remove(args) -> int:
    root = find_root(Path.cwd()) or Path.cwd().resolve()
    dry = args.dry_run
    say(f"graph-memory remove in {posix(root)}" + (" (dry run, nothing changed)" if dry else ""))
    changes = [remove_section(root, dry),
               remove_block(root, RC_NAME, RC_BLOCK, "query_budget", dry),
               remove_block(root, IGNORE_NAME, IGNORE_BLOCK, "ignore", dry)]
    exe = graphify_exe()
    if is_git(root) and git_hooks_installed(root):
        if not args.git_hooks:
            changes.append("= kept graphify's git hooks (add --git-hooks to remove them)")
        elif dry:
            changes.append("would uninstall graphify's git hooks")
        elif exe:
            code, log = run_graphify(exe, ["hook", "uninstall"], root, timeout=120)
            changes.append("- graphify git hooks uninstalled" if code == 0
                           else "! git hook uninstall failed:\n" + tail(log, 4))
    if guard_installed(root):
        if not args.guard:
            changes.append("= kept graphify's guard and CLAUDE.md section (add --guard to remove them)")
        elif dry:
            changes.append("would run `graphify claude uninstall`")
        elif exe:
            code, log = run_graphify(exe, ["claude", "uninstall"], root, timeout=120)
            changes.append("- graphify guard removed" if code == 0
                           else "! graphify claude uninstall failed:\n" + tail(log, 4))
    if args.purge:
        targets = [path for path in (root / OUT, root / NOTES_REL) if path.exists()]
        if dry or not args.yes:
            names = ", ".join(posix(path) for path in targets) or "nothing"
            changes.append(f"would delete {names}" + ("" if dry else " (add --yes to confirm)"))
        else:
            for path in targets:
                if path.is_dir():
                    shutil.rmtree(path)
                else:
                    path.unlink()
                changes.append(f"- deleted {posix(path)}")
            claude_dir = root / ".claude"
            if claude_dir.is_dir() and not any(claude_dir.iterdir()):
                claude_dir.rmdir()  # only when the notes were all it held
    else:
        changes.append(f"= kept {OUT}/ and {NOTES_REL}")
    for change in changes:
        if change:
            say(change)
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError, ValueError):
        pass
    parser = argparse.ArgumentParser(prog="gm.py", description="graph-memory helper")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("session-start").add_argument("--plain", action="store_true")
    sub.add_parser("status").add_argument("--benchmark", action="store_true")
    init = sub.add_parser("init")
    init.add_argument("--no-git-hooks", action="store_true")
    init.add_argument("--guard", action="store_true")
    sub.add_parser("update").add_argument("--force", action="store_true")
    nodes = sub.add_parser("nodes")
    nodes.add_argument("words", nargs="+")
    nodes.add_argument("--limit", type=int, default=15)
    remove = sub.add_parser("remove")
    for flag in ("--dry-run", "--git-hooks", "--guard", "--purge", "--yes"):
        remove.add_argument(flag, action="store_true")
    args = parser.parse_args(argv)
    if args.cmd == "session-start":
        try:
            return cmd_session_start(args)
        except Exception:
            if args.plain:
                raise
            return 0  # a chat must never fail to start because of this hook
    handlers = {"status": cmd_status, "init": cmd_init, "update": cmd_update,
                "nodes": cmd_nodes, "remove": cmd_remove}
    return handlers[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
