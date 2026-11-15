import platform

class NotificationService:
    def __init__(self, backend: str | None = None):
        self.backend = backend or platform.system()

    def send(self, title: str, body: str) -> bool:
        if self.backend == "Windows":
            return self._send_windows(title, body)
        print(f"[{title}] {body}")
        return True

    def _send_windows(self, title: str, body: str) -> bool:
        print(f"(toast) {title}: {body}")
        return True
