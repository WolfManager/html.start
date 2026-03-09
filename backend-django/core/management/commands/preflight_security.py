import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.services.security_config_service import collect_production_security_issues


class Command(BaseCommand):
    help = "Validate security-critical environment settings before deployment."

    def add_arguments(self, parser):
        parser.add_argument(
            "--mode",
            choices=["prod", "current"],
            default="prod",
            help=(
                "prod: enforce production checks regardless of DJANGO_DEBUG; "
                "current: enforce checks only when DJANGO_DEBUG=false"
            ),
        )

    def handle(self, *args, **options):
        mode = str(options.get("mode") or "prod")
        enforce_prod_rules = mode == "prod"
        debug = bool(getattr(settings, "DEBUG", True))

        issues = collect_production_security_issues(
            os.environ,
            debug=debug,
            enforce_prod_rules=enforce_prod_rules,
        )

        if issues:
            self.stderr.write(self.style.ERROR("Security preflight failed:"))
            for issue in issues:
                self.stderr.write(self.style.ERROR(f"- {issue}"))
            raise CommandError("Production security checks failed")

        self.stdout.write(self.style.SUCCESS("Security preflight passed."))
