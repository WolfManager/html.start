from django.contrib import admin, messages

from .models import CrawlRun, SearchBlockRule, SearchDocument, SearchSource
from .services.search_crawler_service import crawl_source_by_id


@admin.register(SearchSource)
class SearchSourceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "is_active",
        "language_hint",
        "category_hint",
        "max_pages",
        "last_status",
        "last_crawled_at",
    )
    list_filter = ("is_active", "language_hint", "category_hint", "last_status")
    search_fields = ("name", "slug", "base_url")
    readonly_fields = ("created_at", "updated_at", "last_crawled_at")
    actions = ["crawl_selected_sources", "activate_selected_sources", "deactivate_selected_sources"]

    @admin.action(description="Crawl selected sources now")
    def crawl_selected_sources(self, request, queryset):
        crawled = 0
        for source in queryset:
            crawl_source_by_id(source.id, trigger="admin")
            crawled += 1
        self.message_user(request, f"Started crawl for {crawled} source(s).", level=messages.SUCCESS)

    @admin.action(description="Activate selected sources")
    def activate_selected_sources(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"Activated {updated} source(s).", level=messages.SUCCESS)

    @admin.action(description="Deactivate selected sources")
    def deactivate_selected_sources(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"Deactivated {updated} source(s).", level=messages.WARNING)


@admin.register(SearchDocument)
class SearchDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "source",
        "language",
        "category",
        "status",
        "quality_score",
        "indexed_at",
    )
    list_filter = ("status", "language", "category", "source")
    search_fields = ("title", "summary", "url", "canonical_url")
    readonly_fields = ("created_at", "updated_at", "indexed_at", "fetched_at", "content_hash")


@admin.register(SearchBlockRule)
class SearchBlockRuleAdmin(admin.ModelAdmin):
    list_display = ("pattern", "rule_type", "is_active", "reason", "created_at")
    list_filter = ("rule_type", "is_active")
    search_fields = ("pattern", "reason")


@admin.register(CrawlRun)
class CrawlRunAdmin(admin.ModelAdmin):
    list_display = (
        "source",
        "trigger",
        "status",
        "pages_seen",
        "pages_indexed",
        "pages_updated",
        "pages_failed",
        "started_at",
        "finished_at",
    )
    list_filter = ("status", "trigger", "source")
    search_fields = ("source__name", "notes")
    readonly_fields = (
        "started_at",
        "finished_at",
        "pages_seen",
        "pages_indexed",
        "pages_updated",
        "pages_failed",
        "pages_blocked",
    )
