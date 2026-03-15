from django.db import models


class SearchSource(models.Model):
    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    base_url = models.URLField(unique=True)
    start_urls = models.JSONField(default=list, blank=True)
    allowed_domains = models.JSONField(default=list, blank=True)
    include_patterns = models.JSONField(default=list, blank=True)
    exclude_patterns = models.JSONField(default=list, blank=True)
    language_hint = models.CharField(max_length=16, blank=True)
    category_hint = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    crawl_depth = models.PositiveSmallIntegerField(default=1)
    max_pages = models.PositiveIntegerField(default=25)
    recrawl_interval_hours = models.PositiveIntegerField(default=24)
    quality_score = models.FloatField(default=0)
    last_crawled_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=32, blank=True)
    last_error = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class SearchBlockRule(models.Model):
    RULE_DOMAIN = "domain"
    RULE_URL_CONTAINS = "url_contains"
    RULE_REGEX = "regex"
    RULE_TYPES = [
        (RULE_DOMAIN, "Domain"),
        (RULE_URL_CONTAINS, "URL contains"),
        (RULE_REGEX, "Regex"),
    ]

    pattern = models.CharField(max_length=255, unique=True)
    rule_type = models.CharField(max_length=32, choices=RULE_TYPES, default=RULE_DOMAIN)
    is_active = models.BooleanField(default=True)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["pattern"]

    def __str__(self) -> str:
        return f"{self.rule_type}: {self.pattern}"


class CrawlRun(models.Model):
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_PARTIAL = "partial"
    STATUS_CHOICES = [
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_PARTIAL, "Partial"),
    ]

    source = models.ForeignKey(
        SearchSource,
        on_delete=models.CASCADE,
        related_name="crawl_runs",
        null=True,
        blank=True,
    )
    trigger = models.CharField(max_length=32, default="manual")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_RUNNING)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    pages_seen = models.PositiveIntegerField(default=0)
    pages_indexed = models.PositiveIntegerField(default=0)
    pages_updated = models.PositiveIntegerField(default=0)
    pages_failed = models.PositiveIntegerField(default=0)
    pages_blocked = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        source_name = self.source.name if self.source else "all-sources"
        return f"{source_name} [{self.status}]"


class SearchDocument(models.Model):
    STATUS_INDEXED = "indexed"
    STATUS_BLOCKED = "blocked"
    STATUS_ERROR = "error"
    STATUS_CHOICES = [
        (STATUS_INDEXED, "Indexed"),
        (STATUS_BLOCKED, "Blocked"),
        (STATUS_ERROR, "Error"),
    ]

    source = models.ForeignKey(
        SearchSource,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    url = models.URLField(unique=True)
    canonical_url = models.URLField(blank=True)
    title = models.CharField(max_length=300, blank=True)
    summary = models.TextField(blank=True)
    content = models.TextField(blank=True)
    language = models.CharField(max_length=16, blank=True)
    category = models.CharField(max_length=64, blank=True)
    tags = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_INDEXED)
    quality_score = models.FloatField(default=0)
    crawl_depth = models.PositiveSmallIntegerField(default=0)
    content_hash = models.CharField(max_length=64, blank=True)
    fetched_at = models.DateTimeField(null=True, blank=True)
    indexed_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-quality_score", "title"]
        indexes = [
            models.Index(fields=["status", "language"]),
            models.Index(fields=["source", "status"]),
        ]

    def __str__(self) -> str:
        return self.title or self.url
