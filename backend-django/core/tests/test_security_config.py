from django.test import SimpleTestCase

from core.services.security_config_service import collect_production_security_issues


class SecurityConfigServiceTests(SimpleTestCase):
    def test_debug_current_mode_skips_production_checks(self) -> None:
        issues = collect_production_security_issues(
            env={},
            debug=True,
            enforce_prod_rules=False,
        )
        self.assertEqual(issues, [])

    def test_prod_mode_reports_default_and_missing_values(self) -> None:
        issues = collect_production_security_issues(
            env={
                "DJANGO_SECRET_KEY": "change-this-django-secret",
                "ADMIN_PASSWORD": "change-this-password",
                "JWT_SECRET": "change-this-secret",
                "SESSION_COOKIE_SECURE": "false",
                "CSRF_COOKIE_SECURE": "false",
            },
            debug=True,
            enforce_prod_rules=True,
        )

        self.assertGreaterEqual(len(issues), 5)
        self.assertTrue(
            any("DJANGO_SECRET_KEY must be set" in issue for issue in issues)
        )
        self.assertTrue(any("ADMIN_PASSWORD must be set" in issue for issue in issues))
        self.assertTrue(any("JWT_SECRET must be set" in issue for issue in issues))
        self.assertTrue(
            any("SESSION_COOKIE_SECURE must be true" in issue for issue in issues)
        )
        self.assertTrue(any("CSRF_COOKIE_SECURE must be true" in issue for issue in issues))

    def test_prod_mode_accepts_strong_values(self) -> None:
        issues = collect_production_security_issues(
            env={
                "DJANGO_SECRET_KEY": "x" * 40,
                "ADMIN_PASSWORD": "y" * 14,
                "JWT_SECRET": "z" * 40,
                "SESSION_COOKIE_SECURE": "true",
                "CSRF_COOKIE_SECURE": "true",
            },
            debug=False,
            enforce_prod_rules=False,
        )

        self.assertEqual(issues, [])
