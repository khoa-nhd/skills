# Design notes
Reminders are stored in a JSON file (storage.py). The scheduler polls every 30s.
Notifications go through NotificationService, which wraps the OS backend.
