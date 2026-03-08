import os
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent


def load_local_env(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_local_env(BASE_DIR / ".env")


def env_bool(name: str, default: bool) -> bool:
    value = str(os.getenv(name, str(default))).strip().lower()
    return value in {"1", "true", "yes", "on"}


def parse_database_url(database_url: str) -> dict[str, str] | None:
    raw = str(database_url or "").strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    scheme = (parsed.scheme or "").lower()
    if scheme not in {"postgres", "postgresql"}:
        return None

    db_name = parsed.path.lstrip("/")
    if not db_name:
        return None

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(db_name),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "localhost",
        "PORT": str(parsed.port or 5432),
        "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
    }

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-this-django-secret")
DEBUG = env_bool("DJANGO_DEBUG", True)

allowed_hosts_raw = os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_raw.split(",") if host.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "magneto_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "magneto_backend.wsgi.application"
ASGI_APPLICATION = "magneto_backend.asgi.application"

database_config = parse_database_url(os.getenv("DATABASE_URL", ""))
if database_config:
    DATABASES = {"default": database_config}
else:
    db_engine = str(os.getenv("DB_ENGINE", "sqlite3")).strip().lower()
    if db_engine == "postgres":
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": os.getenv("DB_NAME", "magneto"),
                "USER": os.getenv("DB_USER", "magneto"),
                "PASSWORD": os.getenv("DB_PASSWORD", "magneto"),
                "HOST": os.getenv("DB_HOST", "127.0.0.1"),
                "PORT": os.getenv("DB_PORT", "5432"),
                "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
            }
        }
    else:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3",
            }
        }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", True)
    CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", True)
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
else:
    SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
    CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", False)

cors_origins_raw = os.getenv(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://127.0.0.1:3000,http://localhost:3000",
)
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()
]

redis_url = str(os.getenv("REDIS_URL", "")).strip()
if redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": redis_url,
            "TIMEOUT": int(os.getenv("DEFAULT_CACHE_TIMEOUT", "300")),
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "magneto-django-local-cache",
            "TIMEOUT": int(os.getenv("DEFAULT_CACHE_TIMEOUT", "300")),
        }
    }

CELERY_BROKER_URL = redis_url or os.getenv("CELERY_BROKER_URL", "memory://")
CELERY_RESULT_BACKEND = redis_url or os.getenv("CELERY_RESULT_BACKEND", "cache+memory://")
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", DEBUG)
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "120"))
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = env_bool(
    "CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP",
    True,
)
