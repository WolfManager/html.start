import base64
import hashlib
import hmac
import json
import os
import time
from threading import Lock
from typing import Any

LOGIN_WINDOW_SECONDS = max(60, min(7200, int(os.getenv("LOGIN_WINDOW_MINUTES", "15")) * 60))
LOGIN_RATE_LIMIT_COUNT = max(1, min(500, int(os.getenv("LOGIN_RATE_LIMIT_COUNT", "20"))))
LOCKOUT_THRESHOLD = max(1, min(20, int(os.getenv("LOCKOUT_THRESHOLD", "5"))))
LOCKOUT_SECONDS = max(60, min(10800, int(os.getenv("LOCKOUT_MINUTES", "15")) * 60))
ADMIN_WINDOW_SECONDS = max(5, min(600, int(os.getenv("ADMIN_WINDOW_SECONDS", "60"))))
ADMIN_RATE_LIMIT_COUNT = max(5, min(2000, int(os.getenv("ADMIN_RATE_LIMIT_COUNT", "120"))))

JWT_SECRET = str(os.getenv("JWT_SECRET", "change-this-secret"))
JWT_EXPIRES_SECONDS = 12 * 60 * 60

ADMIN_USER = str(os.getenv("ADMIN_USER", "admin"))
ADMIN_PASSWORD = str(os.getenv("ADMIN_PASSWORD", "change-this-password"))

_lock = Lock()
_login_state: dict[str, dict[str, Any]] = {}
_admin_rate_state: dict[str, list[float]] = {}


def get_client_ip(meta: dict[str, Any]) -> str:
    forwarded = str(meta.get("HTTP_X_FORWARDED_FOR") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return str(meta.get("REMOTE_ADDR") or "unknown")


def _get_login_key(ip: str, username: str) -> str:
    return f"{ip}|{username.strip().lower()}"


def _prune_login_attempts(state: dict[str, Any], now: float) -> None:
    attempts = [ts for ts in list(state.get("attempts") or []) if now - ts <= LOGIN_WINDOW_SECONDS]
    state["attempts"] = attempts
    if float(state.get("lockUntil", 0)) <= now:
        state["lockUntil"] = 0


def process_login_attempt(*, ip: str, username: str, password: str) -> tuple[int, dict[str, Any], dict[str, str]]:
    now = time.time()
    key = _get_login_key(ip, username)
    headers: dict[str, str] = {}

    with _lock:
        state = _login_state.get(key) or {"attempts": [], "failedCount": 0, "lockUntil": 0}
        _prune_login_attempts(state, now)

        if float(state.get("lockUntil", 0)) > now:
            retry_after = max(1, int(float(state.get("lockUntil", 0)) - now))
            headers["Retry-After"] = str(retry_after)
            _login_state[key] = state
            return 429, {"error": f"Account temporarily locked. Retry in {retry_after} seconds."}, headers

        if len(state.get("attempts") or []) >= LOGIN_RATE_LIMIT_COUNT:
            oldest = float((state.get("attempts") or [now])[0])
            retry_after = max(1, int(LOGIN_WINDOW_SECONDS - (now - oldest)))
            headers["Retry-After"] = str(retry_after)
            _login_state[key] = state
            return 429, {"error": f"Too many login attempts. Retry in {retry_after} seconds."}, headers

        if username != ADMIN_USER or not hmac.compare_digest(
            password.encode("utf-8"), ADMIN_PASSWORD.encode("utf-8")
        ):
            attempts = list(state.get("attempts") or [])
            attempts.append(now)
            state["attempts"] = attempts
            state["failedCount"] = int(state.get("failedCount", 0)) + 1
            if int(state.get("failedCount", 0)) >= LOCKOUT_THRESHOLD:
                state["lockUntil"] = now + LOCKOUT_SECONDS
                state["failedCount"] = 0
            _login_state[key] = state
            return 401, {"error": "Invalid username or password."}, headers

        if key in _login_state:
            _login_state.pop(key, None)

    payload = {
        "username": ADMIN_USER,
        "role": "admin",
        "iat": int(now),
        "exp": int(now + JWT_EXPIRES_SECONDS),
    }
    token = _encode_token(payload)

    return 200, {"token": token}, headers


def check_admin_rate_limit(ip: str) -> tuple[bool, int]:
    now = time.time()
    window_start = now - ADMIN_WINDOW_SECONDS

    with _lock:
        hits = [ts for ts in _admin_rate_state.get(ip, []) if ts >= window_start]
        if len(hits) >= ADMIN_RATE_LIMIT_COUNT:
            retry_after = max(1, int(ADMIN_WINDOW_SECONDS - (now - hits[0])))
            _admin_rate_state[ip] = hits
            return False, retry_after

        hits.append(now)
        _admin_rate_state[ip] = hits

    return True, 0


def validate_admin_token(auth_header: str) -> tuple[bool, str]:
    token = ""
    header = str(auth_header or "")
    if header.startswith("Bearer "):
        token = header[7:].strip()

    if not token:
        return False, "Missing auth token."

    try:
        payload = _decode_token(token)
        exp = int(payload.get("exp") or 0)
        if exp <= int(time.time()):
            return False, "Invalid or expired token."
        return True, ""
    except Exception:
        return False, "Invalid or expired token."


def _encode_token(payload: dict[str, Any]) -> str:
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    body = base64.urlsafe_b64encode(payload_bytes).decode("ascii").rstrip("=")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{body}.{sig}"


def _decode_token(token: str) -> dict[str, Any]:
    parts = str(token).split(".")
    if len(parts) != 2:
        raise ValueError("Invalid token format")

    body, sig = parts
    expected_sig = hmac.new(
        JWT_SECRET.encode("utf-8"),
        body.encode("ascii"),
        hashlib.sha256,
    ).digest()
    expected = base64.urlsafe_b64encode(expected_sig).decode("ascii").rstrip("=")
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Invalid token signature")

    padded_body = body + "=" * (-len(body) % 4)
    payload_raw = base64.urlsafe_b64decode(padded_body.encode("ascii"))
    payload = json.loads(payload_raw.decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Invalid token payload")
    return payload
