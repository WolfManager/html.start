from django.test import TestCase

from core.models import SearchDocument, SearchSource
from core.services.cross_reference import compute_cross_domain_signal_bonus
from core.services.doc_structure import (
    STRUCTURE_API_REFERENCE,
    STRUCTURE_DOCUMENTATION,
    STRUCTURE_TUTORIAL,
    analyze_document_structure,
)
from core.services.entity_recognition import compute_entity_overlap, extract_entities


class EntityRecognitionTests(TestCase):
    def test_extract_entities_groups_known_terms(self) -> None:
        entities = extract_entities("Python Django tutorial with GitHub Actions and PostgreSQL")

        self.assertIn("python", entities["programming_languages"])
        self.assertIn("django", entities["frameworks"])
        self.assertIn("github", entities["organizations"])
        self.assertIn("postgresql", entities["tools"])

    def test_compute_entity_overlap_returns_coverage(self) -> None:
        overlap = compute_entity_overlap(
            "python django fastapi",
            "A Django and FastAPI comparison guide for Python services.",
        )

        self.assertEqual(set(overlap["matchedEntities"]), {"python", "django", "fastapi"})
        self.assertEqual(overlap["coverage"], 1.0)


class DocumentStructureTests(TestCase):
    def test_analyze_document_structure_detects_tutorial(self) -> None:
        structure = analyze_document_structure(
            {
                "title": "Python Tutorial for Beginners",
                "summary": "Step by step guide",
                "content": "How to build your first API.",
                "url": "https://example.com/tutorial/python",
            }
        )
        self.assertEqual(structure, STRUCTURE_TUTORIAL)

    def test_analyze_document_structure_detects_documentation(self) -> None:
        structure = analyze_document_structure(
            {
                "title": "Django Documentation Overview",
                "summary": "Core concepts and docs",
                "content": "Official manual for core concepts.",
                "url": "https://docs.example.com/django",
            }
        )
        self.assertEqual(structure, STRUCTURE_DOCUMENTATION)

    def test_analyze_document_structure_detects_api_reference(self) -> None:
        structure = analyze_document_structure(
            {
                "title": "Users API Reference",
                "summary": "Endpoints and parameters",
                "content": "GET /users endpoint, request schema, response schema.",
                "url": "https://api.example.com/reference/users",
            }
        )
        self.assertEqual(structure, STRUCTURE_API_REFERENCE)


class CrossDomainSignalTests(TestCase):
    def setUp(self) -> None:
        self.source = SearchSource.objects.create(
            slug="cross-signal",
            name="Cross Signal",
            base_url="https://example.com",
            start_urls=["https://example.com"],
            allowed_domains=["example.com"],
            language_hint="en",
            category_hint="Development",
        )

    def test_compute_cross_domain_signal_bonus_rewards_entity_overlap(self) -> None:
        document = SearchDocument.objects.create(
            source=self.source,
            url="https://example.com/python-django-fastapi-guide",
            title="Python Django FastAPI Guide",
            summary="Comparison tutorial for backend frameworks.",
            content="Learn Python, Django, and FastAPI with links to https://github.com/example/repo",
            language="en",
            category="Development",
            tags=["python", "django", "fastapi", "tutorial"],
            quality_score=70,
        )

        bonus = compute_cross_domain_signal_bonus(
            document,
            "python django fastapi tutorial",
            query_intent={"intent": "informational"},
        )

        self.assertGreater(bonus["entityBonus"], 0.0)
        self.assertGreater(bonus["structureBonus"], 0.0)
        self.assertGreater(bonus["totalBonus"], 1.0)
        self.assertIn("python", bonus["matchedEntities"])
