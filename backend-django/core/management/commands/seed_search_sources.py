from django.core.management.base import BaseCommand

from core.services.search_index_service import seed_default_sources


class Command(BaseCommand):
    help = "Seed curated MAGNETO search sources for the crawler."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing source configuration fields.",
        )

    def handle(self, *args, **options):
        created, updated = seed_default_sources(force=bool(options.get("force")))
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded search sources. Created={created}, Updated={updated}"
            )
        )
