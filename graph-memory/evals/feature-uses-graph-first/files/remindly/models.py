from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class Reminder:
    id: int
    text: str
    due_at: datetime
    done: bool = False
    tags: list[str] = field(default_factory=list)

    def is_due(self, now: datetime) -> bool:
        return not self.done and self.due_at <= now


def snooze(reminder, minutes: int = 10):
    from datetime import timedelta
    reminder.due_at = reminder.due_at + timedelta(minutes=minutes)
    return reminder
