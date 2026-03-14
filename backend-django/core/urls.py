from django.urls import path

from .views import (
    admin_backups,
    admin_backups_create,
    admin_backups_download,
    admin_backups_restore,
    admin_export_csv,
    admin_assistant_status,
    admin_runtime_metrics,
    admin_overview,
    admin_routing,
    admin_routing_verify,
    assistant_chat,
    auth_login,
    health,
    location_auto,
    page_view,
    search,
)

urlpatterns = [
    path("auth/login", auth_login, name="auth-login"),
    path("health", health, name="health"),
    path("location/auto", location_auto, name="location-auto"),
    path("search", search, name="search"),
    path("events/page-view", page_view, name="page-view"),
    path("assistant/chat", assistant_chat, name="assistant-chat"),
    path("admin/overview", admin_overview, name="admin-overview"),
    path("admin/assistant-status", admin_assistant_status, name="admin-assistant-status"),
    path("admin/runtime-metrics", admin_runtime_metrics, name="admin-runtime-metrics"),
    path("admin/routing", admin_routing, name="admin-routing"),
    path("admin/routing/verify", admin_routing_verify, name="admin-routing-verify"),
    path("admin/backups", admin_backups, name="admin-backups"),
    path("admin/backups/download", admin_backups_download, name="admin-backups-download"),
    path("admin/backups/create", admin_backups_create, name="admin-backups-create"),
    path("admin/backups/restore", admin_backups_restore, name="admin-backups-restore"),
    path("admin/export.csv", admin_export_csv, name="admin-export-csv"),
]
