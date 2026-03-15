from django.core.management.base import BaseCommand, CommandError

from core.models import SearchSource
from core.services.search_crawler_service import crawl_due_sources


class Command(BaseCommand):
    help = "Crawl active MAGNETO search sources into the persistent search index."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            action="append",
            dest="sources",
            default=[],
            help="Crawl one or more source slugs.",
        )
        parser.add_argument(
            "--max-pages",
            type=int,
            default=None,
            help="Override max pages per source for this run.",
        )
        parser.add_argument(
            "--trigger",
            default="manual",
            help="Trigger label stored on crawl runs.",
        )

    def handle(self, *args, **options):
        source_slugs = [
            str(item).strip()
            for item in options.get("sources") or []
            if str(item).strip()
        ]
        source_ids = None
        if source_slugs:
            queryset = SearchSource.objects.filter(slug__in=source_slugs)
            found = set(queryset.values_list("slug", flat=True))
            missing = [slug for slug in source_slugs if slug not in found]
            if missing:
                raise CommandError(f"Unknown source slug(s): {', '.join(missing)}")
            source_ids = list(queryset.values_list("id", flat=True))

        runs = crawl_due_sources(
            trigger=str(options.get("trigger") or "manual"),
            source_ids=source_ids,
            max_pages=options.get("max_pages"),
        )
        self.stdout.write(self.style.SUCCESS(f"Completed {len(runs)} crawl run(s)."))
        for run in runs:
            source_name = run.source.slug if run.source else "all"
            self.stdout.write(
                f"- {source_name}: status={run.status}, seen={run.pages_seen}, indexed={run.pages_indexed}, updated={run.pages_updated}, failed={run.pages_failed}, blocked={run.pages_blocked}"
            )
