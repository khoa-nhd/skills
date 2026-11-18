#!/usr/bin/env python3
"""Make graph-memory available in every Claude Code chat on this machine.

  python install.py              link this skill into ~/.claude/skills and register the hooks
  python install.py --uninstall  remove both (project folders are not touched)
  python install.py --status

Two hooks go into settings.json, which is backed up before every change:
  SessionStart  `gm.py session-start` when a chat starts, is cleared or compacted:
                the session note (graph freshness, changed files, hot notes)
  Stop          `gm.py stop-hook` after each reply: if code changed, refresh the
                graph in the background (parser only, no tokens)
Both do nothing in folders without graph memory, so they cost nothing there.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
CONFIG = Path(os.environ.get("CLAUDE_CONFIG_DIR") or (Path.home() / ".claude"))
LINK = CONFIG / "skills" / "graph-memory"
SETTINGS = CONFIG / "settings.json"
# event -> (matcher or None, gm.py subcommand)
HOOKS = {
    "SessionStart": ("startup|clear|compact", "session-start"),
    "Stop": (None, "stop-hook"),
}


def hook_command(subcommand: str) -> str:
    """The hook command line, quoting only what needs it.

    cmd.exe strips the first and last quote of a command line that holds more
    than two quotes, so a fully quoted `"py" "script" arg` breaks there. Paths
    without spaces stay bare, which parses the same in sh, cmd.exe and PowerShell.
    """
    def arg(path: Path) -> str:
        text = str(path)
        if os.name == "nt" and " " in text:
            # The 8.3 short name has no spaces, so it needs no quotes in any shell.
            import ctypes
            buffer = ctypes.create_unicode_buffer(1024)
            if ctypes.windll.kernel32.GetShortPathNameW(text, buffer, 1024):
                text = buffer.value
        text = Path(text).as_posix()
        return f'"{text}"' if " " in text else text  # last resort: short names are disabled
    return f"{arg(Path(sys.executable))} {arg(LINK / 'scripts' / 'gm.py')} {subcommand}"


def hook_entry(event: str) -> dict:
    matcher, subcommand = HOOKS[event]
    entry: dict = {"hooks": [{"type": "command", "command": hook_command(subcommand), "timeout": 10}]}
    if matcher:
        entry = {"matcher": matcher, **entry}
    return entry


def is_our_hook(hook) -> bool:
    # Match on the script and subcommand, not the folder name: an 8.3 short path
    # turns "graph-memory" into something like GRAPH-~1.
    command = hook.get("command", "") if isinstance(hook, dict) else ""
    return "gm.py" in command and any(sub in command for _matcher, sub in HOOKS.values())


def is_ours(entry) -> bool:
    return isinstance(entry, dict) and any(is_our_hook(hook) for hook in entry.get("hooks") or [])


def without_ours(entries: list) -> list:
    """The entries with only our hook commands taken out; other commands in a shared entry stay."""
    kept = []
    for entry in entries:
        if not is_ours(entry):
            kept.append(entry)
            continue
        others = [hook for hook in entry.get("hooks") or [] if not is_our_hook(hook)]
        if others:
            kept.append({**entry, "hooks": others})
    return kept


def is_link(path: Path) -> bool:
    try:
        if path.is_symlink() or (hasattr(os.path, "isjunction") and os.path.isjunction(path)):
            return True
        return bool(getattr(os.lstat(path), "st_file_attributes", 0) & 0x400)  # reparse point
    except OSError:
        return False


def link_state() -> str:
    if not os.path.lexists(LINK):
        return "missing"
    try:
        same = Path(os.path.realpath(LINK)) == SKILL_DIR
    except OSError:
        same = False
    if not is_link(LINK):
        return "in-place" if same else "copy"  # a real folder: never removed by uninstall
    return "ok" if same else "other"


def make_link() -> str:
    state = link_state()
    if state == "ok":
        return f"= skill already linked: {LINK} -> {SKILL_DIR}"
    if state == "in-place":
        return f"= skill lives directly in {LINK}; no link needed"
    if state == "copy":
        raise SystemExit(f"{LINK} is a real folder (a copy of the skill?), not a link; "
                         "move it away and rerun, so edits here reach every chat.")
    if state == "other":
        raise SystemExit(f"{LINK} exists and is not a link to {SKILL_DIR}; move it away and rerun.")
    LINK.parent.mkdir(parents=True, exist_ok=True)
    if os.name == "nt":
        # A junction needs no admin rights or developer mode, unlike a symlink.
        result = subprocess.run(["cmd", "/c", "mklink", "/J", str(LINK), str(SKILL_DIR)],
                                capture_output=True, text=True)
        if result.returncode != 0:
            raise SystemExit(f"could not create the junction: {result.stdout}{result.stderr}")
    else:
        os.symlink(SKILL_DIR, LINK, target_is_directory=True)
    return f"+ skill linked: {LINK} -> {SKILL_DIR}"


def remove_link() -> str:
    state = link_state()
    if state == "missing":
        return "= no skill link to remove"
    if state in ("other", "copy", "in-place"):
        return f"= {LINK} is not a link made by install.py; left it alone"
    if os.name == "nt":
        os.rmdir(LINK)  # removes the junction itself, never the files it points to
    else:
        os.unlink(LINK)
    return f"- skill link removed: {LINK}"


def load_settings() -> dict:
    if not SETTINGS.exists():
        return {}
    text = SETTINGS.read_text(encoding="utf-8")
    try:
        data = json.loads(text) if text.strip() else {}
    except ValueError:
        raise SystemExit(f"{SETTINGS} is not valid JSON; fix it first, nothing was changed.")
    if not isinstance(data, dict):
        raise SystemExit(f"{SETTINGS} does not hold a JSON object; nothing was changed.")
    return data


def save_settings(data: dict) -> None:
    backup = SETTINGS.with_name(SETTINGS.name + ".graph-memory.bak")
    if SETTINGS.exists() and not backup.exists():
        shutil.copy2(SETTINGS, backup)  # keep the first one: the settings from before graph-memory
    SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def add_hooks() -> str:
    data = load_settings()
    hooks = data.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        raise SystemExit("settings.json `hooks` is not an object; nothing was changed.")
    changed = []
    for event in HOOKS:
        current = hooks.setdefault(event, [])
        if not isinstance(current, list):
            raise SystemExit(f"settings.json `hooks.{event}` is not a list; nothing was changed.")
        updated = without_ours(current) + [hook_entry(event)]
        if updated != current:
            hooks[event] = updated
            changed.append(event)
    if not changed:
        return "= hooks already registered (" + ", ".join(HOOKS) + ")"
    save_settings(data)
    return (f"+ hooks registered in {SETTINGS}: " + ", ".join(changed)
            + f" (backup: {SETTINGS.name}.graph-memory.bak)")


def remove_hooks() -> str:
    data = load_settings()
    hooks = data.get("hooks")
    if not isinstance(hooks, dict):
        return "= no graph-memory hooks in settings.json"
    removed = []
    for event in HOOKS:
        current = hooks.get(event)
        if not isinstance(current, list):
            continue
        if not any(is_ours(item) for item in current):
            continue
        kept = without_ours(current)
        removed.append(event)
        if kept:
            hooks[event] = kept
        else:
            del hooks[event]
    if not removed:
        return "= no graph-memory hooks in settings.json"
    if not hooks:
        del data["hooks"]
    save_settings(data)
    return f"- hooks removed from {SETTINGS}: " + ", ".join(removed)


def registered_hooks() -> list[str]:
    hooks = load_settings().get("hooks") or {}
    return [event for event in HOOKS
            if isinstance(hooks.get(event), list) and any(is_ours(item) for item in hooks[event])]


def self_test() -> str:
    """Run both hooks the way Claude Code will, in a folder without graph memory."""
    failures = []
    with tempfile.TemporaryDirectory() as folder:
        for event, (_matcher, subcommand) in HOOKS.items():
            payload = json.dumps({"hook_event_name": event, "source": "startup", "cwd": folder})
            result = subprocess.run([sys.executable, str(SKILL_DIR / "scripts" / "gm.py"), subcommand],
                                    input=payload, capture_output=True, text=True, timeout=30)
            if result.returncode != 0 or result.stdout.strip():
                failures.append(f"{subcommand}: exit {result.returncode}, "
                                f"output {result.stdout[:200]!r} {result.stderr[:200]!r}")
    if failures:
        return "! self-test: " + "; ".join(failures)
    return "+ self-test passed: both hooks run and stay silent outside graph-memory folders"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--uninstall", action="store_true")
    group.add_argument("--status", action="store_true")
    args = parser.parse_args()
    if args.status:
        print(f"skill link: {link_state()} ({LINK})")
        registered = registered_hooks()
        print("hooks:      " + ", ".join(f"{event} {'on' if event in registered else 'off'}" for event in HOOKS))
        return 0
    if args.uninstall:
        print(remove_hooks())
        print(remove_link())
        return 0
    print(make_link())
    print(add_hooks())
    print(self_test())
    print("New chats pick this up automatically. Run /graph-memory init in a project folder to turn it on there.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
