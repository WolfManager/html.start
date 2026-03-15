from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SearchBlockRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("pattern", models.CharField(max_length=255, unique=True)),
                ("rule_type", models.CharField(choices=[("domain", "Domain"), ("url_contains", "URL contains"), ("regex", "Regex")], default="domain", max_length=32)),
                ("is_active", models.BooleanField(default=True)),
                ("reason", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["pattern"]},
        ),
        migrations.CreateModel(
            name="SearchSource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("name", models.CharField(max_length=160)),
                ("base_url", models.URLField(unique=True)),
                ("start_urls", models.JSONField(blank=True, default=list)),
                ("allowed_domains", models.JSONField(blank=True, default=list)),
                ("include_patterns", models.JSONField(blank=True, default=list)),
                ("exclude_patterns", models.JSONField(blank=True, default=list)),
                ("language_hint", models.CharField(blank=True, max_length=16)),
                ("category_hint", models.CharField(blank=True, max_length=64)),
                ("is_active", models.BooleanField(default=True)),
                ("crawl_depth", models.PositiveSmallIntegerField(default=1)),
                ("max_pages", models.PositiveIntegerField(default=25)),
                ("recrawl_interval_hours", models.PositiveIntegerField(default=24)),
                ("quality_score", models.FloatField(default=0)),
                ("last_crawled_at", models.DateTimeField(blank=True, null=True)),
                ("last_status", models.CharField(blank=True, max_length=32)),
                ("last_error", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="CrawlRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("trigger", models.CharField(default="manual", max_length=32)),
                ("status", models.CharField(choices=[("running", "Running"), ("completed", "Completed"), ("failed", "Failed"), ("partial", "Partial")], default="running", max_length=32)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("pages_seen", models.PositiveIntegerField(default=0)),
                ("pages_indexed", models.PositiveIntegerField(default=0)),
                ("pages_updated", models.PositiveIntegerField(default=0)),
                ("pages_failed", models.PositiveIntegerField(default=0)),
                ("pages_blocked", models.PositiveIntegerField(default=0)),
                ("notes", models.TextField(blank=True)),
                ("source", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="crawl_runs", to="core.searchsource")),
            ],
            options={"ordering": ["-started_at"]},
        ),
        migrations.CreateModel(
            name="SearchDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("url", models.URLField(unique=True)),
                ("canonical_url", models.URLField(blank=True)),
                ("title", models.CharField(blank=True, max_length=300)),
                ("summary", models.TextField(blank=True)),
                ("content", models.TextField(blank=True)),
                ("language", models.CharField(blank=True, max_length=16)),
                ("category", models.CharField(blank=True, max_length=64)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("status", models.CharField(choices=[("indexed", "Indexed"), ("blocked", "Blocked"), ("error", "Error")], default="indexed", max_length=32)),
                ("quality_score", models.FloatField(default=0)),
                ("crawl_depth", models.PositiveSmallIntegerField(default=0)),
                ("content_hash", models.CharField(blank=True, max_length=64)),
                ("fetched_at", models.DateTimeField(blank=True, null=True)),
                ("indexed_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("source", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="documents", to="core.searchsource")),
            ],
            options={"ordering": ["-quality_score", "title"]},
        ),
        migrations.AddIndex(
            model_name="searchdocument",
            index=models.Index(fields=["status", "language"], name="core_search_status_4f572f_idx"),
        ),
        migrations.AddIndex(
            model_name="searchdocument",
            index=models.Index(fields=["source", "status"], name="core_search_source__2e55ba_idx"),
        ),
    ]
