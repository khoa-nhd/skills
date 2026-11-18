import argparse
import re
from datetime import datetime, timedelta
from pathlib import Path
from .models import Reminder
from .storage import ReminderStore
from .scheduler import ReminderScheduler
from .notify import NotificationService

DEFAULT_DB = Path.home() / ".remindly.json"

def parse_delay(text: str) -> timedelta:
    m = re.fullmatch(r"(\d+)([mhd])", text)
    if not m:
        raise ValueError(f"bad delay: {text}")
    n, unit = int(m.group(1)), m.group(2)
    return {"m": timedelta(minutes=n), "h": timedelta(hours=n), "d": timedelta(days=n)}[unit]

def add_reminder(store: ReminderStore, text: str, delay: str) -> Reminder:
    items = store.load()
    r = Reminder(store.next_id(), text, datetime.now() + parse_delay(delay))
    items.append(r)
    store.save(items)
    return r

def main(argv=None) -> None:
    p = argparse.ArgumentParser(prog="remindly")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add"); a.add_argument("text"); a.add_argument("--in", dest="delay", default="30m")
    sub.add_parser("run")
    args = p.parse_args(argv)
    store = ReminderStore(DEFAULT_DB)
    if args.cmd == "add":
        r = add_reminder(store, args.text, args.delay)
        print(f"added #{r.id} due {r.due_at:%H:%M}")
    else:
        ReminderScheduler(store, NotificationService()).run_forever()
