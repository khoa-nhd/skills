import json
from datetime import datetime
from pathlib import Path
from .models import Reminder

class ReminderStore:
    def __init__(self, path: Path):
        self.path = path

    def load(self) -> list[Reminder]:
        if not self.path.exists():
            return []
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        return [Reminder(r["id"], r["text"], datetime.fromisoformat(r["due_at"]), r.get("done", False), r.get("tags", [])) for r in raw]

    def save(self, reminders: list[Reminder]) -> None:
        data = [{"id": r.id, "text": r.text, "due_at": r.due_at.isoformat(), "done": r.done, "tags": r.tags} for r in reminders]
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def next_id(self) -> int:
        items = self.load()
        return max((r.id for r in items), default=0) + 1
