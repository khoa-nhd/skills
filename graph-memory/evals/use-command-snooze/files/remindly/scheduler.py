import time
from datetime import datetime
from .storage import ReminderStore
from .notify import NotificationService

POLL_SECONDS = 30

class ReminderScheduler:
    def __init__(self, store: ReminderStore, notifier: NotificationService):
        self.store = store
        self.notifier = notifier

    def tick(self, now: datetime | None = None) -> int:
        now = now or datetime.now()
        reminders = self.store.load()
        fired = 0
        for r in reminders:
            if r.is_due(now):
                self.notifier.send("Reminder", r.text)
                r.done = True
                fired += 1
        if fired:
            self.store.save(reminders)
        return fired

    def run_forever(self) -> None:
        while True:
            self.tick()
            time.sleep(POLL_SECONDS)
