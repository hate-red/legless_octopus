import unittest

from app.services.scoring.ai_service import _parse_ai_response


class AiResponseParsingTests(unittest.TestCase):
    def test_parses_plain_json(self) -> None:
        result = _parse_ai_response(
            '{"is_valid": true, "comment": "Цель соответствует ОКВЭД"}'
        )

        self.assertTrue(result.is_valid)
        self.assertEqual(result.comment, "Цель соответствует ОКВЭД")

    def test_parses_json_wrapped_in_markdown(self) -> None:
        result = _parse_ai_response(
            '```json\n{"is_valid": false, "comment": "Не соответствует"}\n```'
        )

        self.assertFalse(result.is_valid)
        self.assertEqual(result.comment, "Не соответствует")

    def test_rejects_missing_fields(self) -> None:
        with self.assertRaises(ValueError):
            _parse_ai_response('{"is_valid": true}')

    def test_rejects_non_json(self) -> None:
        with self.assertRaises(ValueError):
            _parse_ai_response("Да, цель подходит")


if __name__ == "__main__":
    unittest.main()
