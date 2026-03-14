import json
import os
import time
import urllib.error
import urllib.request
from threading import Lock
from typing import Any


ASSISTANT_MAX_CHARS = max(200, min(12000, int(os.getenv("ASSISTANT_MAX_CHARS", "4000"))))
ASSISTANT_TIMEOUT_SECONDS = max(5, min(60, int(os.getenv("ASSISTANT_HTTP_TIMEOUT_SECONDS", "20"))))
ASSISTANT_MODEL_DISCOVERY_TTL_SECONDS = max(
    60,
    min(86400, int(os.getenv("ASSISTANT_MODEL_DISCOVERY_TTL_SECONDS", "21600"))),
)

_discovery_lock = Lock()
_model_discovery_cache: dict[str, dict[str, Any]] = {
    "openai": {"fetched_at": 0.0, "models": []},
    "anthropic": {"fetched_at": 0.0, "models": []},
    "gemini": {"fetched_at": 0.0, "models": []},
}


def _parse_model_candidates(raw: str, defaults: list[str]) -> list[str]:
    items = [str(item).strip() for item in str(raw or "").split(",") if str(item).strip()]
    ordered: list[str] = []
    seen: set[str] = set()

    for model in [*items, *defaults]:
        key = model.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        ordered.append(model)

    return ordered


def _provider_order() -> list[str]:
    configured = [
        str(os.getenv("AI_PRIMARY_PROVIDER", "openai")).strip().lower() or "openai",
        str(os.getenv("AI_FALLBACK_PROVIDER", "anthropic")).strip().lower() or "anthropic",
    ]
    env_order = [
        str(item).strip().lower()
        for item in str(os.getenv("AI_PROVIDER_ORDER", "")).split(",")
        if str(item).strip()
    ]

    candidates = [*configured, *env_order, "openai", "anthropic", "gemini"]
    valid = {"openai", "anthropic", "gemini"}
    ordered: list[str] = []
    seen: set[str] = set()
    for provider in candidates:
        if provider not in valid or provider in seen:
            continue
        seen.add(provider)
        ordered.append(provider)
    return ordered


def _word_count(text: str) -> int:
    return len([chunk for chunk in str(text or "").strip().split() if chunk])


def _smart_provider_hint(message: str) -> str:
    text = str(message or "").strip()
    normalized = text.lower()
    words = _word_count(text)

    simple_words = max(2, min(25, int(os.getenv("ASSISTANT_SIMPLE_QUERY_WORDS", "5"))))
    complex_words = max(15, min(120, int(os.getenv("ASSISTANT_COMPLEX_QUERY_WORDS", "35"))))
    complex_chars = max(120, min(2000, int(os.getenv("ASSISTANT_COMPLEX_QUERY_CHARS", "220"))))

    complex_signals = [
        "analyze",
        "analysis",
        "reason",
        "architecture",
        "tradeoff",
        "root cause",
        "debug",
        "optimize",
        "algorithm",
        "proof",
        "complex",
        "compare",
        "strategy",
        "design",
        "step by step",
    ]
    code_signals = [
        "python",
        "javascript",
        "typescript",
        "django",
        "node",
        "api",
        "error",
        "exception",
        "stack trace",
        "refactor",
        "server",
        "blockchain",
        "hardware",
        "infrastructure",
        "xeon",
        "epyc",
        "gpu",
        "cuda",
        "cluster",
        "throughput",
        "latency",
    ]

    small_talk_signals = [
        "ce faci",
        "salut",
        "buna",
        "bună",
        "hello",
        "hi",
        "how are you",
        "what are you doing",
        "who are you",
    ]

    # Keep short conversational prompts on a model that tends to answer naturally.
    if words <= 10 and any(signal in normalized for signal in small_talk_signals):
        return "openai"

    if (
        words >= complex_words
        or len(text) >= complex_chars
        or any(signal in normalized for signal in complex_signals)
        or any(signal in normalized for signal in code_signals)
    ):
        return "anthropic"

    if words <= simple_words:
        return "gemini"

    return "openai"


def _provider_order_for_message(message: str) -> tuple[list[str], str, str]:
    base = _provider_order()
    mode = str(os.getenv("AI_ROUTING_MODE", "smart")).strip().lower() or "smart"

    if mode not in {"smart", "priority"}:
        mode = "smart"

    if mode == "priority":
        return base, mode, ""

    hint = _smart_provider_hint(message)
    preferred = [hint] + [provider for provider in base if provider != hint]
    return _merge_unique(preferred), mode, hint


def _merge_unique(items: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = str(item or "").strip()
        key = value.lower()
        if not key or key in seen:
            continue
        seen.add(key)
        ordered.append(value)
    return ordered


def _is_model_not_found_error(message: str) -> bool:
    text = str(message or "").lower()
    return ("model" in text) and ("not_found" in text or "not found" in text)


def _json_request(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method="POST")
    request.add_header("Content-Type", "application/json")
    for key, value in headers.items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, timeout=ASSISTANT_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            body = exc.read().decode("utf-8", errors="ignore")
            detail = body[:400]
        except Exception:
            detail = ""
        suffix = f" - {detail}" if detail else ""
        raise RuntimeError(f"HTTP {exc.code} calling {url}{suffix}") from exc


def _json_get(url: str, headers: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(url, method="GET")
    for key, value in headers.items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, timeout=ASSISTANT_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            body = exc.read().decode("utf-8", errors="ignore")
            detail = body[:400]
        except Exception:
            detail = ""
        suffix = f" - {detail}" if detail else ""
        raise RuntimeError(f"HTTP {exc.code} calling {url}{suffix}") from exc


def _discover_openai_models(force_refresh: bool = False) -> list[str]:
    api_key = str(os.getenv("OPENAI_API_KEY", "")).strip()
    if not api_key:
        return []

    now = time.time()
    with _discovery_lock:
        cache = _model_discovery_cache.get("openai") or {"fetched_at": 0.0, "models": []}
        if not force_refresh and (now - float(cache.get("fetched_at") or 0.0)) <= ASSISTANT_MODEL_DISCOVERY_TTL_SECONDS:
            return list(cache.get("models") or [])

    payload = _json_get(
        "https://api.openai.com/v1/models",
        {"Authorization": f"Bearer {api_key}"},
    )
    data = payload.get("data") or []
    discovered = []
    if isinstance(data, list):
        for item in data:
            model_id = str((item or {}).get("id") or "").strip()
            if model_id.startswith(("gpt", "o1", "o3", "o4")):
                discovered.append(model_id)

    discovered = _merge_unique(discovered)
    with _discovery_lock:
        _model_discovery_cache["openai"] = {"fetched_at": now, "models": discovered}
    return discovered


def _discover_anthropic_models(force_refresh: bool = False) -> list[str]:
    api_key = str(os.getenv("ANTHROPIC_API_KEY", "")).strip()
    if not api_key:
        return []

    now = time.time()
    with _discovery_lock:
        cache = _model_discovery_cache.get("anthropic") or {"fetched_at": 0.0, "models": []}
        if not force_refresh and (now - float(cache.get("fetched_at") or 0.0)) <= ASSISTANT_MODEL_DISCOVERY_TTL_SECONDS:
            return list(cache.get("models") or [])

    payload = _json_get(
        "https://api.anthropic.com/v1/models",
        {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    data = payload.get("data") or []
    discovered = []
    if isinstance(data, list):
        for item in data:
            model_id = str((item or {}).get("id") or "").strip()
            if model_id:
                discovered.append(model_id)

    discovered = _merge_unique(discovered)
    with _discovery_lock:
        _model_discovery_cache["anthropic"] = {"fetched_at": now, "models": discovered}
    return discovered


def _discover_gemini_models(force_refresh: bool = False) -> list[str]:
    api_key = str(os.getenv("GEMINI_API_KEY", "")).strip()
    if not api_key:
        return []

    now = time.time()
    with _discovery_lock:
        cache = _model_discovery_cache.get("gemini") or {"fetched_at": 0.0, "models": []}
        if not force_refresh and (now - float(cache.get("fetched_at") or 0.0)) <= ASSISTANT_MODEL_DISCOVERY_TTL_SECONDS:
            return list(cache.get("models") or [])

    payload = _json_get(
        f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
        {},
    )

    discovered = []
    models = payload.get("models") or []
    if isinstance(models, list):
        for item in models:
            name = str((item or {}).get("name") or "").strip()
            # API returns names like "models/gemini-1.5-flash" -> keep only model id part.
            model_id = name.split("/", 1)[-1] if name else ""
            if model_id.startswith("gemini"):
                discovered.append(model_id)

    discovered = _merge_unique(discovered)
    with _discovery_lock:
        _model_discovery_cache["gemini"] = {"fetched_at": now, "models": discovered}
    return discovered


def _system_instruction() -> str:
    return (
        "You are MAGNETO Assistant. Reply in the same language as the user's latest message. "
        "Be natural, direct, accurate, and professionally helpful. Use recent conversation context "
        "when it is provided. Do not ignore follow-up questions. For technical or infrastructure "
        "requests, give serious server-grade recommendations when appropriate, not consumer-grade "
        "parts by default. If requirements are missing, state reasonable assumptions and still give "
        "a solid baseline answer. Keep answers concise but useful, and do not use markdown tables."
    )


def _normalize_history(history: Any) -> list[dict[str, str]]:
    if not isinstance(history, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in history[-8:]:
        if not isinstance(item, dict):
            continue

        role = str(item.get("role") or "").strip().lower()
        if role not in {"user", "assistant"}:
            continue

        content = " ".join(str(item.get("content") or "").strip().split())
        if not content or content == "Thinking...":
            continue

        normalized.append(
            {
                "role": role,
                "content": content[:2000],
            }
        )

    return normalized


def _openai_messages(message: str, history: list[dict[str, str]]) -> list[dict[str, str]]:
    messages = [{"role": "system", "content": _system_instruction()}]
    messages.extend(history)

    current_message = message.strip()
    if not history or history[-1].get("role") != "user" or history[-1].get("content") != current_message:
        messages.append({"role": "user", "content": current_message})

    return messages


def _anthropic_messages(message: str, history: list[dict[str, str]]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for item in history:
        messages.append({"role": item["role"], "content": item["content"]})

    current_message = message.strip()
    if not history or history[-1].get("role") != "user" or history[-1].get("content") != current_message:
        messages.append({"role": "user", "content": current_message})

    return messages


def _gemini_contents(message: str, history: list[dict[str, str]]) -> list[dict[str, Any]]:
    contents: list[dict[str, Any]] = []
    for item in history:
        contents.append(
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
        )

    current_message = message.strip()
    if not history or history[-1].get("role") != "user" or history[-1].get("content") != current_message:
        contents.append({"role": "user", "parts": [{"text": current_message}]})

    return contents


def _openai_chat(message: str, history: list[dict[str, str]] | None = None, *, max_tokens: int = 900) -> tuple[str, str]:
    api_key = str(os.getenv("OPENAI_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("OpenAI key not configured")

    normalized_history = _normalize_history(history)

    configured_models = _parse_model_candidates(
        os.getenv("OPENAI_MODEL_CANDIDATES", ""),
        [
            str(os.getenv("OPENAI_MODEL", "gpt-4o-mini")).strip() or "gpt-4o-mini",
            "gpt-4o-mini",
        ],
    )
    discovered_models = []
    try:
        discovered_models = _discover_openai_models()
    except Exception:
        discovered_models = []

    model_candidates = _merge_unique([*configured_models, *discovered_models])

    last_error = ""

    def _try_models(models: list[str]) -> tuple[str, str] | None:
        nonlocal last_error
        for model in models:
            try:
                payload = {
                    "model": model,
                    "messages": _openai_messages(message, normalized_history),
                    "temperature": 0.5,
                    "max_tokens": int(max_tokens),
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
                if text:
                    return text, model
                last_error = f"OpenAI model {model} returned empty response"
            except RuntimeError as exc:
                last_error = str(exc)
                continue
        return None

    first_try = _try_models(model_candidates)
    if first_try is not None:
        return first_try

    if _is_model_not_found_error(last_error):
        try:
            refreshed = _discover_openai_models(force_refresh=True)
        except Exception:
            refreshed = []
        second_try = _try_models(_merge_unique([*refreshed, *model_candidates]))
        if second_try is not None:
            return second_try

    raise RuntimeError(last_error or "OpenAI failed for all candidate models")


def _anthropic_chat(message: str, history: list[dict[str, str]] | None = None, *, max_tokens: int = 900) -> tuple[str, str]:
    api_key = str(os.getenv("ANTHROPIC_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("Anthropic key not configured")

    normalized_history = _normalize_history(history)

    configured_models = _parse_model_candidates(
        os.getenv("ANTHROPIC_MODEL_CANDIDATES", ""),
        [
            str(os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")).strip()
            or "claude-3-5-sonnet-latest",
            "claude-3-5-sonnet-latest",
            "claude-3-5-haiku-latest",
        ],
    )
    discovered_models = []
    try:
        discovered_models = _discover_anthropic_models()
    except Exception:
        discovered_models = []

    model_candidates = _merge_unique([*configured_models, *discovered_models])

    last_error = ""

    def _try_models(models: list[str]) -> tuple[str, str] | None:
        nonlocal last_error
        for model in models:
            try:
                payload = {
                    "model": model,
                    "system": _system_instruction(),
                    "max_tokens": int(max_tokens),
                    "temperature": 0.5,
                    "messages": _anthropic_messages(message, normalized_history),
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
                if text:
                    return text, model
                last_error = f"Anthropic model {model} returned empty response"
            except RuntimeError as exc:
                last_error = str(exc)
                continue
        return None

    first_try = _try_models(model_candidates)
    if first_try is not None:
        return first_try

    if _is_model_not_found_error(last_error):
        try:
            refreshed = _discover_anthropic_models(force_refresh=True)
        except Exception:
            refreshed = []
        second_try = _try_models(_merge_unique([*refreshed, *model_candidates]))
        if second_try is not None:
            return second_try

    raise RuntimeError(last_error or "Anthropic failed for all candidate models")


def _gemini_chat(message: str, history: list[dict[str, str]] | None = None, *, max_tokens: int = 900) -> tuple[str, str]:
    api_key = str(os.getenv("GEMINI_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("Gemini key not configured")

    normalized_history = _normalize_history(history)

    configured_models = _parse_model_candidates(
        os.getenv("GEMINI_MODEL_CANDIDATES", ""),
        [
            str(os.getenv("GEMINI_MODEL", "gemini-1.5-flash")).strip() or "gemini-1.5-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
        ],
    )

    discovered_models = []
    try:
        discovered_models = _discover_gemini_models()
    except Exception:
        discovered_models = []

    model_candidates = _merge_unique([*configured_models, *discovered_models])

    payload = {
        "systemInstruction": {"parts": [{"text": _system_instruction()}]},
        "contents": _gemini_contents(message, normalized_history),
        "generationConfig": {"temperature": 0.5, "maxOutputTokens": int(max_tokens)},
    }

    last_error = ""

    def _try_models(models: list[str]) -> tuple[str, str] | None:
        nonlocal last_error
        for model in models:
            try:
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
                if text:
                    return text, model
                last_error = f"Gemini model {model} returned empty response"
            except RuntimeError as exc:
                last_error = str(exc)
                continue
        return None

    first_try = _try_models(model_candidates)
    if first_try is not None:
        return first_try

    if _is_model_not_found_error(last_error):
        try:
            refreshed = _discover_gemini_models(force_refresh=True)
        except Exception:
            refreshed = []
        second_try = _try_models(_merge_unique([*refreshed, *model_candidates]))
        if second_try is not None:
            return second_try

    raise RuntimeError(last_error or "Gemini failed for all candidate models")


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


def probe_providers_health() -> dict[str, dict[str, Any]]:
    checks: dict[str, dict[str, Any]] = {
        "openai": {
            "configured": bool(str(os.getenv("OPENAI_API_KEY", "")).strip()),
            "ok": False,
            "model": "",
            "error": "",
        },
        "anthropic": {
            "configured": bool(str(os.getenv("ANTHROPIC_API_KEY", "")).strip()),
            "ok": False,
            "model": "",
            "error": "",
        },
        "gemini": {
            "configured": bool(str(os.getenv("GEMINI_API_KEY", "")).strip()),
            "ok": False,
            "model": "",
            "error": "",
        },
    }

    if checks["openai"]["configured"]:
        try:
            _reply, used_model = _openai_chat("health ping", max_tokens=16)
            checks["openai"]["ok"] = True
            checks["openai"]["model"] = used_model
        except Exception as exc:
            checks["openai"]["error"] = str(exc)
    else:
        checks["openai"]["error"] = "API key missing"

    if checks["anthropic"]["configured"]:
        try:
            _reply, used_model = _anthropic_chat("health ping", max_tokens=16)
            checks["anthropic"]["ok"] = True
            checks["anthropic"]["model"] = used_model
        except Exception as exc:
            checks["anthropic"]["error"] = str(exc)
    else:
        checks["anthropic"]["error"] = "API key missing"

    if checks["gemini"]["configured"]:
        try:
            _reply, used_model = _gemini_chat("health ping", max_tokens=16)
            checks["gemini"]["ok"] = True
            checks["gemini"]["model"] = used_model
        except Exception as exc:
            checks["gemini"]["error"] = str(exc)
    else:
        checks["gemini"]["error"] = "API key missing"

    return checks


def generate_assistant_response(message: str, history: Any = None) -> dict[str, Any]:
    msg = str(message or "").strip()
    if not msg:
        raise ValueError("Message is required.")
    if len(msg) > ASSISTANT_MAX_CHARS:
        raise ValueError(f"Message too long. Max {ASSISTANT_MAX_CHARS} characters.")

    normalized_history = _normalize_history(history)
    ordered_unique, routing_mode, routing_hint = _provider_order_for_message(msg)

    last_error = ""
    for provider in ordered_unique:
        try:
            if provider == "openai":
                reply, model = _openai_chat(msg, normalized_history)
            elif provider == "anthropic":
                reply, model = _anthropic_chat(msg, normalized_history)
            elif provider == "gemini":
                reply, model = _gemini_chat(msg, normalized_history)
            else:
                continue

            return {
                "ok": True,
                "provider": provider,
                "model": model,
                "helper": "general",
                "reply": reply,
                "suggestions": [],
                "routing": {
                    "mode": routing_mode,
                    "hint": routing_hint,
                },
            }
        except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            last_error = str(exc)
            continue

    response = _local_fallback(msg)
    if last_error:
        response["reason"] = last_error
    return response
