#!/usr/bin/env python3
"""Make graph-memory available in every Claude Code chat on this machine.

  python install.py              link this skill into ~/.claude/skills and register the hook
  python install.py --uninstall  remove both (project folders are not touched)
  python install.py --status

The SessionStart hook runs `gm.py session-start` when a chat starts, is cleared
or is compacted. It prints nothing in folders without graph memory, so it costs
nothing there. settings.json is backed up before every change.
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
MATCHER = "startup|clear|compact"


def hook_command() -> str:
    """The hook command line, quoting only what needs it.

    cmd.exe strips the first and last quote of a command line that holds more
    than two quotes, so a fully quoted `"py" "script" arg` breaks there. Paths
    without spaces stay bare, which parses the same in sh, cmd.exe and PowerShell.
    """
    def arg(path: Path) -> str:
        text = path.as_posix()
        return f'"{text}"' if " " in text else text
    return f"{arg(Path(sys.executable))} {arg(LINK / 'scripts' / 'gm.py')} session-start"


def is_ours(entry) -> bool:
    if not isinstance(entry, dict):
        return False
    for hook in entry.get("hooks") or []:
        command = hook.get("command", "") if isinstance(hook, dict) else ""
        if "graph-memory" in command and "gm.py" in command and "session-start" in command:
            return True
    return False


def link_state() -> str:
    if not os.path.lexists(LINK):
        return "missing"
    try:
        if Path(os.path.realpath(LINK)) == SKILL_DIR:
            return "ok"
    except OSError:
        pass
    return "other"


def make_link() -> str:
    state = link_state()
    if state == "ok":
        return f"= skill already linked: {LINK} -> {SKILL_DIR}"
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
    if state == "other":
        return f"! {LINK} is not a link to this skill; left it alone"
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
    if SETTINGS.exists():
        shutil.copy2(SETTINGS, SETTINGS.with_name(SETTINGS.name + ".graph-memory.bak"))
    SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def add_hook() -> str:
    data = load_settings()
    hooks = data.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        raise SystemExit("settings.json `hooks` is not an object; nothing was changed.")
    session_start = hooks.setdefault("SessionStart", [])
    if not isinstance(session_start, list):
        raise SystemExit("settings.json `hooks.SessionStart` is not a list; nothing was changed.")
    entry = {"matcher": MATCHER,
             "hooks": [{"type": "command", "command": hook_command(), "timeout": 10}]}
    updated = [item for item in session_start if not is_ours(item)] + [entry]
    if updated == session_start:
        return "= SessionStart hook already registered"
    hooks["SessionStart"] = updated
    save_settings(data)
    return f"+ SessionStart hook registered in {SETTINGS} (backup: {SETTINGS.name}.graph-memory.bak)"


def remove_hook() -> str:
    data = load_settings()
    hooks = data.get("hooks")
    session_start = hooks.get("SessionStart") if isinstance(hooks, dict) else None
    if not isinstance(session_start, list):
        return "= no SessionStart hook to remove"
    kept = [item for item in session_start if not is_ours(item)]
    if len(kept) == len(session_start):
        return "= no graph-memory hook in settings.json"
    if kept:
        hooks["SessionStart"] = kept
    else:
        del hooks["SessionStart"]
        if not hooks:
            del data["hooks"]
    save_settings(data)
    return f"- SessionStart hook removed from {SETTINGS}"


def self_test() -> str:
    """Run the hook the way Claude Code will, in a folder without graph memory."""
    with tempfile.TemporaryDirectory() as folder:
        payload = json.dumps({"hook_event_name": "SessionStart", "source": "startup", "cwd": folder})
        result = subprocess.run([sys.executable, str(SKILL_DIR / "scripts" / "gm.py"), "session-start"],
                                input=payload, capture_output=True, text=True, timeout=30)
    if result.returncode == 0 and not result.stdout.strip():
        return "+ self-test passed: the hook runs and stays silent outside graph-memory folders"
    return f"! self-test: exit {result.returncode}, output {result.stdout[:200]!r} {result.stderr[:200]!r}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--uninstall", action="store_true")
    group.add_argument("--status", action="store_true")
    args = parser.parse_args()
    if args.status:
        print(f"skill link: {link_state()} ({LINK})")
        print("hook:       " + ("registered" if any(is_ours(item) for item in
                                (load_settings().get("hooks") or {}).get("SessionStart") or [])
                                else "not registered"))
        return 0
    if args.uninstall:
        print(remove_hook())
        print(remove_link())
        return 0
    print(make_link())
    print(add_hook())
    print(self_test())
    print("New chats pick this up automatically. Run /graph-memory init in a project folder to turn it on there.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
