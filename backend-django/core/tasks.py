from celery import shared_task


@shared_task
def warmup_task() -> dict[str, str]:
    """Simple baseline task to validate Celery worker wiring."""
    return {"status": "ok", "task": "warmup"}
