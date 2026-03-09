from collections.abc import Mapping


DEFAULT_DJANGO_SECRET = "change-this-django-secret"
DEFAULT_ADMIN_PASSWORD = "change-this-password"
DEFAULT_JWT_SECRET = "change-this-secret"


def _env_bool(raw: str | None, default: bool) -> bool:
    value = str(raw if raw is not None else str(default)).strip().lower()
    return value in {"1", "true", "yes", "on"}


def collect_production_security_issues(
    env: Mapping[str, str | None],
    *,
    debug: bool,
    enforce_prod_rules: bool,
) -> list[str]:
    if debug and not enforce_prod_rules:
        return []

    problems: list[str] = []
    django_secret = str(env.get("DJANGO_SECRET_KEY") or "").strip()
    admin_password = str(env.get("ADMIN_PASSWORD") or "").strip()
    jwt_secret = str(env.get("JWT_SECRET") or "").strip()

    if not django_secret or django_secret == DEFAULT_DJANGO_SECRET:
        problems.append("DJANGO_SECRET_KEY must be set to a non-default value")
    elif len(django_secret) < 32:
        problems.append("DJANGO_SECRET_KEY should have at least 32 characters")

    if not admin_password or admin_password == DEFAULT_ADMIN_PASSWORD:
        problems.append("ADMIN_PASSWORD must be set to a non-default value")
    elif len(admin_password) < 12:
        problems.append("ADMIN_PASSWORD should have at least 12 characters")

    if not jwt_secret or jwt_secret == DEFAULT_JWT_SECRET:
        problems.append("JWT_SECRET must be set to a non-default value")
    elif len(jwt_secret) < 32:
        problems.append("JWT_SECRET should have at least 32 characters")

    if _env_bool(env.get("SESSION_COOKIE_SECURE"), True) is False:
        problems.append("SESSION_COOKIE_SECURE must be true for production checks")

    if _env_bool(env.get("CSRF_COOKIE_SECURE"), True) is False:
        problems.append("CSRF_COOKIE_SECURE must be true for production checks")

    return problems
