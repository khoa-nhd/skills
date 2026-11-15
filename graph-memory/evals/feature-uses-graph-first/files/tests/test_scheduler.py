from datetime import datetime, timedelta
from remindly.models import Reminder
from remindly.scheduler import ReminderScheduler

class FakeStore:
    def __init__(self, items): self.items = items; self.saved = None
    def load(self): return self.items
    def save(self, items): self.saved = items

class FakeNotifier:
    def __init__(self): self.sent = []
    def send(self, title, body): self.sent.append(body); return True

def test_tick_fires_due():
    now = datetime(2026, 1, 1, 12, 0)
    store = FakeStore([Reminder(1, "a", now - timedelta(minutes=1)), Reminder(2, "b", now + timedelta(hours=1))])
    n = FakeNotifier()
    assert ReminderScheduler(store, n).tick(now) == 1
    assert n.sent == ["a"]
