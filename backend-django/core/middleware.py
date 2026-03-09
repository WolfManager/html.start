import logging
import time
import uuid

from .services.runtime_metrics_service import record_api_request


logger = logging.getLogger("magneto.observability")


class RequestObservabilityMiddleware:
    """Attach request diagnostics headers and emit lightweight API timing logs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = str(request.META.get("HTTP_X_REQUEST_ID") or "").strip() or str(
            uuid.uuid4()
        )
        request.request_id = request_id

        start = time.perf_counter()
        response = self.get_response(request)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        response["X-Request-ID"] = request_id
        response["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"

        path = str(getattr(request, "path", "") or "")
        if path.startswith("/api/"):
            record_api_request(
                path=path,
                status_code=int(getattr(response, "status_code", 0)),
                duration_ms=elapsed_ms,
            )
            logger.info(
                "api_request method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
                str(getattr(request, "method", "GET")),
                path,
                int(getattr(response, "status_code", 0)),
                elapsed_ms,
                request_id,
            )

        return response
