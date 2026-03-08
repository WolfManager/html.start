import json
import os
import urllib.error
import urllib.request
from typing import Any


ASSISTANT_MAX_CHARS = max(200, min(12000, int(os.getenv("ASSISTANT_MAX_CHARS", "4000"))))
ASSISTANT_TIMEOUT_SECONDS = max(5, min(60, int(os.getenv("ASSISTANT_HTTP_TIMEOUT_SECONDS", "20"))))


def _json_request(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    for key, value in headers.items():
        request.add_header(key, value)

    with urllib.request.urlopen(request, timeout=ASSISTANT_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def _build_prompt(message: str) -> str:
    return (
        "You are MAGNETO Assistant. Reply in clear English, concise but useful, "
        "practical, no markdown tables."
        "\nUser message: " + message.strip()
    )


def _openai_chat(message: str) -> tuple[str, str]:
    api_key = str(os.getenv("OPENAI_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("OpenAI key not configured")

    model = str(os.getenv("OPENAI_MODEL", "gpt-4o-mini")).strip() or "gpt-4o-mini"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are MAGNETO Assistant."},
            {"role": "user", "content": _build_prompt(message)},
        ],
        "temperature": 0.5,
        "max_tokens": 900,
    }
    response = _json_request(
        "https://api.openai.com/v1/chat/completions",
        payload,
        {"Authorization": f"Bearer {api_key}"},
    )
    content = (
        (((response.get("choices") or [{}])[0]).get("message") or {}).get("content")
        or ""
    )
    text = str(content).strip()
    if not text:
        raise RuntimeError("OpenAI returned empty response")
    return text, model


def _anthropic_chat(message: str) -> tuple[str, str]:
    api_key = str(os.getenv("ANTHROPIC_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("Anthropic key not configured")

    model = (
        str(os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")).strip()
        or "claude-3-5-sonnet-latest"
    )
    payload = {
        "model": model,
        "max_tokens": 900,
        "temperature": 0.5,
        "messages": [{"role": "user", "content": _build_prompt(message)}],
    }
    response = _json_request(
        "https://api.anthropic.com/v1/messages",
        payload,
        {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )

    parts = response.get("content") or []
    text = ""
    if isinstance(parts, list):
        for part in parts:
            if isinstance(part, dict) and part.get("type") == "text":
                text += str(part.get("text") or "")
    text = text.strip()
    if not text:
        raise RuntimeError("Anthropic returned empty response")
    return text, model


def _gemini_chat(message: str) -> tuple[str, str]:
    api_key = str(os.getenv("GEMINI_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("Gemini key not configured")

    model = str(os.getenv("GEMINI_MODEL", "gemini-1.5-flash")).strip() or "gemini-1.5-flash"
    payload = {
        "contents": [{"parts": [{"text": _build_prompt(message)}]}],
        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 900},
    }

    response = _json_request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        payload,
        {},
    )

    candidates = response.get("candidates") or []
    text = ""
    if isinstance(candidates, list) and candidates:
        content = (candidates[0] or {}).get("content") or {}
        parts = content.get("parts") or []
        if isinstance(parts, list):
            for part in parts:
                if isinstance(part, dict):
                    text += str(part.get("text") or "")

    text = text.strip()
    if not text:
        raise RuntimeError("Gemini returned empty response")
    return text, model


def _local_fallback(message: str) -> dict[str, Any]:
    msg = message.strip()
    return {
        "ok": True,
        "provider": "local-fallback",
        "model": "local-fallback",
        "helper": "general",
        "reply": f"I can help with '{msg}'. If you want higher-quality AI responses, configure a provider key.",
        "suggestions": [
            f"Explain {msg} simply",
            f"Give practical steps for {msg}",
            f"Pros and cons of {msg}",
        ],
    }


def generate_assistant_response(message: str) -> dict[str, Any]:
    msg = str(message or "").strip()
    if not msg:
        raise ValueError("Message is required.")
    if len(msg) > ASSISTANT_MAX_CHARS:
        raise ValueError(f"Message too long. Max {ASSISTANT_MAX_CHARS} characters.")

    primary = str(os.getenv("AI_PRIMARY_PROVIDER", "openai")).strip().lower() or "openai"
    fallback = str(os.getenv("AI_FALLBACK_PROVIDER", "anthropic")).strip().lower() or "anthropic"

    provider_order = [primary, fallback, "gemini", "openai", "anthropic"]
    seen: set[str] = set()
    ordered_unique = [p for p in provider_order if not (p in seen or seen.add(p))]

    last_error = ""
    for provider in ordered_unique:
        try:
            if provider == "openai":
                reply, model = _openai_chat(msg)
            elif provider == "anthropic":
                reply, model = _anthropic_chat(msg)
            elif provider == "gemini":
                reply, model = _gemini_chat(msg)
            else:
                continue

            return {
                "ok": True,
                "provider": provider,
                "model": model,
                "helper": "general",
                "reply": reply,
                "suggestions": [],
            }
        except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            last_error = str(exc)
            continue

    response = _local_fallback(msg)
    if last_error:
        response["reason"] = last_error
    return response
