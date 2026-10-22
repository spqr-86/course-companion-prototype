"""Offline checks using a recorded, truncated OpenRouter response."""

# ANCHOR: Verify source selection and refusal to accept paid truncated output; no network.
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from string import Formatter
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "gen_demo_ai", ROOT / "tools/gen_demo_ai.py"
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class GeneratorTests(unittest.TestCase):
    def test_complete_correct_source_section(self):
        notes = (ROOT / "data/notes.md").read_text()
        text = generator.chapter_text(11, notes)
        self.assertIn("### Демо: airline agent с инструментами", text)
        self.assertNotIn("## 12.", text)
        self.assertGreater(len(text), 4500)
        with self.assertRaises(ValueError):
            generator.chapter_text(99, notes)

    def test_prompt_variables_match_template(self):
        fields = {
            name
            for _, name, _, _ in Formatter().parse(generator.CONFIG["template"])
            if name
        }
        self.assertEqual(fields, set(generator.PromptVariables.model_fields))

    def test_truncated_answer_is_preserved_but_not_accepted(self):
        recorded = json.loads((ROOT / "tests/fixtures/demo-truncated.json").read_text())
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(generator, "delegate_client") as client,
        ):
            client.return_value.post.return_value = recorded
            raw = Path(directory) / "raw.json"
            with self.assertRaisesRegex(RuntimeError, "обрезан|пустой"):
                generator.request_one("dummy-test-key", "test prompt", raw)
            self.assertEqual(
                json.loads(raw.read_text())["usage"]["cost"], recorded["usage"]["cost"]
            )
            client.return_value.post.assert_called_once()


if __name__ == "__main__":
    unittest.main()
