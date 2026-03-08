import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "magneto_backend.settings")

app = Celery("magneto_backend")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    return {
        "task": "debug_task",
        "request": str(self.request),
    }
