---
type: llm
focus: trace
weight: 1
---

`python -m remindly snooze <id> --min 10` loads the reminders, calls snooze() on the matching one with 10 minutes, and saves the store; an unknown id gives a clear message instead of a traceback.
