"""Notion Tool Lambda unit tests for Task 1: Foundation."""

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add parent directory to path so we can import index
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class TestHandler(unittest.TestCase):
    """Tests for the handler dispatch routing."""

    @patch("index._get_notion_client")
    def test_unknown_action_returns_error(self, mock_client):
        """Unknown action returns error message."""
        from index import handler

        result = handler({"action": "unknown_action"}, None)

        self.assertFalse(result["success"])
        self.assertIn("不明なアクション", result["message"])

    @patch("index._get_notion_client")
    def test_missing_action_returns_error(self, mock_client):
        """Missing action field returns error message."""
        from index import handler

        result = handler({}, None)

        self.assertFalse(result["success"])
        self.assertIn("action", result["message"])

    @patch("index._get_notion_client")
    def test_dispatches_search_pages(self, mock_get_client):
        """Handler routes search_pages action correctly."""
        from index import handler

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.search.return_value = {"results": [], "has_more": False}

        result = handler({"action": "search_pages", "query": "test"}, None)

        self.assertIn("pages", result)

    @patch("index._get_notion_client")
    def test_dispatches_get_database(self, mock_get_client):
        """Handler routes get_database action correctly."""
        from index import handler

        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.data_sources.retrieve.return_value = {
            "id": "db-123",
            "title": [{"plain_text": "Test DB"}],
            "properties": {
                "Name": {"type": "title", "title": {}},
            },
        }

        result = handler(
            {"action": "get_database", "database_id": "db-123"}, None
        )

        self.assertTrue(result["success"])


class TestGetNotionClient(unittest.TestCase):
    """Tests for SSM auth and Notion client initialization."""

    @patch("index.Client")
    @patch("index.boto3.client")
    def test_initializes_client_from_ssm(self, mock_boto, mock_notion_cls):
        """Fetches token from SSM and initializes Notion client."""
        import index

        index._notion_client = None

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "ntn_test_token"}
        }
        mock_boto.return_value = ssm

        mock_notion_instance = MagicMock()
        mock_notion_cls.return_value = mock_notion_instance

        result = index._get_notion_client()

        ssm.get_parameter.assert_called_once_with(
            Name="/tonari/notion/api_token", WithDecryption=True
        )
        mock_notion_cls.assert_called_once_with(auth="ntn_test_token")
        self.assertEqual(result, mock_notion_instance)

    @patch("index.Client")
    @patch("index.boto3.client")
    def test_caches_client_on_subsequent_calls(self, mock_boto, mock_notion_cls):
        """Returns cached client without re-initializing."""
        import index

        cached_client = MagicMock()
        index._notion_client = cached_client

        result = index._get_notion_client()

        self.assertEqual(result, cached_client)
        mock_boto.assert_not_called()

    @patch("index.boto3.client")
    def test_ssm_failure_raises_exception(self, mock_boto):
        """SSM failure propagates as error."""
        import index

        index._notion_client = None

        ssm = MagicMock()
        ssm.get_parameter.side_effect = Exception("SSM error")
        mock_boto.return_value = ssm

        with self.assertRaises(Exception):
            index._get_notion_client()


class TestClearClientCache(unittest.TestCase):
    """Tests for client cache clearing on auth errors."""

    def test_clear_cache_resets_global(self):
        """Clearing cache sets _notion_client to None."""
        import index

        index._notion_client = MagicMock()
        index._clear_client_cache()
        self.assertIsNone(index._notion_client)


class TestNotionErrorHandling(unittest.TestCase):
    """Tests for Notion API error handling."""

    @patch("index._clear_client_cache")
    def test_handles_401_auth_error(self, mock_clear):
        """401 error returns auth message and clears cache."""
        from index import _handle_notion_error

        error = MagicMock()
        error.status = 401
        error.code = "unauthorized"

        result = _handle_notion_error(error)

        self.assertFalse(result["success"])
        self.assertIn("認証", result["message"])
        mock_clear.assert_called_once()

    def test_handles_403_permission_error(self):
        """403 error returns permission message."""
        from index import _handle_notion_error

        error = MagicMock()
        error.status = 403
        error.code = "restricted_resource"

        result = _handle_notion_error(error)

        self.assertFalse(result["success"])
        self.assertIn("権限", result["message"])

    def test_handles_404_not_found(self):
        """404 error returns not found message."""
        from index import _handle_notion_error

        error = MagicMock()
        error.status = 404
        error.code = "object_not_found"

        result = _handle_notion_error(error)

        self.assertFalse(result["success"])
        self.assertIn("見つかりません", result["message"])

    def test_handles_429_rate_limit(self):
        """429 error returns rate limit message."""
        from index import _handle_notion_error

        error = MagicMock()
        error.status = 429
        error.code = "rate_limited"

        result = _handle_notion_error(error)

        self.assertFalse(result["success"])
        self.assertIn("制限", result["message"])

    def test_handles_500_server_error(self):
        """5xx error returns server error message."""
        from index import _handle_notion_error

        error = MagicMock()
        error.status = 500
        error.code = "internal_server_error"

        result = _handle_notion_error(error)

        self.assertFalse(result["success"])
        self.assertIn("サーバー", result["message"])


class TestHelpers(unittest.TestCase):
    """Tests for helper functions."""

    def test_extract_plain_text_from_rich_text(self):
        """Extracts concatenated plain text from rich_text array."""
        from index import _extract_plain_text

        rich_text = [
            {"plain_text": "Hello "},
            {"plain_text": "world"},
        ]

        result = _extract_plain_text(rich_text)

        self.assertEqual(result, "Hello world")

    def test_extract_plain_text_empty_array(self):
        """Returns empty string for empty rich_text array."""
        from index import _extract_plain_text

        self.assertEqual(_extract_plain_text([]), "")
        self.assertEqual(_extract_plain_text(None), "")

    def test_convert_title_property(self):
        """Converts title property to plain text."""
        from index import _convert_property_value

        prop = {"type": "title", "title": [{"plain_text": "My Page"}]}

        self.assertEqual(_convert_property_value(prop), "My Page")

    def test_convert_rich_text_property(self):
        """Converts rich_text property to plain text."""
        from index import _convert_property_value

        prop = {
            "type": "rich_text",
            "rich_text": [{"plain_text": "Some text"}],
        }

        self.assertEqual(_convert_property_value(prop), "Some text")

    def test_convert_number_property(self):
        """Converts number property to numeric value."""
        from index import _convert_property_value

        prop = {"type": "number", "number": 42}

        self.assertEqual(_convert_property_value(prop), 42)

    def test_convert_select_property(self):
        """Converts select property to option name."""
        from index import _convert_property_value

        prop = {"type": "select", "select": {"name": "Option A"}}

        self.assertEqual(_convert_property_value(prop), "Option A")

    def test_convert_select_none(self):
        """Converts empty select to None."""
        from index import _convert_property_value

        prop = {"type": "select", "select": None}

        self.assertIsNone(_convert_property_value(prop))

    def test_convert_multi_select_property(self):
        """Converts multi_select property to list of names."""
        from index import _convert_property_value

        prop = {
            "type": "multi_select",
            "multi_select": [{"name": "Tag1"}, {"name": "Tag2"}],
        }

        self.assertEqual(_convert_property_value(prop), ["Tag1", "Tag2"])

    def test_convert_date_property_single(self):
        """Converts date property with start only."""
        from index import _convert_property_value

        prop = {"type": "date", "date": {"start": "2026-03-01", "end": None}}

        self.assertEqual(_convert_property_value(prop), "2026-03-01")

    def test_convert_date_property_range(self):
        """Converts date property with start and end."""
        from index import _convert_property_value

        prop = {
            "type": "date",
            "date": {"start": "2026-03-01", "end": "2026-03-05"},
        }

        self.assertEqual(
            _convert_property_value(prop), "2026-03-01 → 2026-03-05"
        )

    def test_convert_date_none(self):
        """Converts empty date to None."""
        from index import _convert_property_value

        prop = {"type": "date", "date": None}

        self.assertIsNone(_convert_property_value(prop))

    def test_convert_checkbox_property(self):
        """Converts checkbox property to boolean."""
        from index import _convert_property_value

        self.assertTrue(
            _convert_property_value({"type": "checkbox", "checkbox": True})
        )
        self.assertFalse(
            _convert_property_value({"type": "checkbox", "checkbox": False})
        )

    def test_convert_url_property(self):
        """Converts url property to string."""
        from index import _convert_property_value

        prop = {"type": "url", "url": "https://example.com"}

        self.assertEqual(_convert_property_value(prop), "https://example.com")

    def test_convert_status_property(self):
        """Converts status property to name string."""
        from index import _convert_property_value

        prop = {"type": "status", "status": {"name": "In Progress"}}

        self.assertEqual(_convert_property_value(prop), "In Progress")

    def test_convert_people_property(self):
        """Converts people property to list of names."""
        from index import _convert_property_value

        prop = {
            "type": "people",
            "people": [{"name": "Alice"}, {"name": "Bob"}],
        }

        self.assertEqual(_convert_property_value(prop), ["Alice", "Bob"])

    def test_convert_relation_property(self):
        """Converts relation property to list of page IDs."""
        from index import _convert_property_value

        prop = {
            "type": "relation",
            "relation": [{"id": "page-1"}, {"id": "page-2"}],
        }

        self.assertEqual(_convert_property_value(prop), ["page-1", "page-2"])

    def test_convert_unknown_type(self):
        """Returns type name string for unknown property types."""
        from index import _convert_property_value

        prop = {"type": "formula", "formula": {"number": 100}}

        self.assertEqual(_convert_property_value(prop), "[formula]")


class TestInputValidation(unittest.TestCase):
    """Tests for input validation helpers."""

    def test_parse_json_string(self):
        """Parses JSON string to dict."""
        from index import _parse_json_param

        result = _parse_json_param('{"key": "value"}', "test")

        self.assertEqual(result, {"key": "value"})

    def test_parse_json_dict_passthrough(self):
        """Returns dict as-is without parsing."""
        from index import _parse_json_param

        original = {"key": "value"}
        result = _parse_json_param(original, "test")

        self.assertEqual(result, original)

    def test_parse_json_list_passthrough(self):
        """Returns list as-is without parsing."""
        from index import _parse_json_param

        original = [{"key": "value"}]
        result = _parse_json_param(original, "test")

        self.assertEqual(result, original)

    def test_parse_json_invalid_raises(self):
        """Invalid JSON string raises ValueError with param name."""
        from index import _parse_json_param

        with self.assertRaises(ValueError) as ctx:
            _parse_json_param("not valid json", "filter")

        self.assertIn("filter", str(ctx.exception))

    def test_parse_json_none_returns_none(self):
        """None input returns None."""
        from index import _parse_json_param

        result = _parse_json_param(None, "test")

        self.assertIsNone(result)


class TestHandlerErrorCatching(unittest.TestCase):
    """Tests for top-level error handling in handler."""

    @patch("index._get_notion_client")
    def test_catches_unexpected_exception(self, mock_get_client):
        """Unexpected exceptions are caught and returned as error response."""
        from index import handler

        mock_get_client.side_effect = Exception("Unexpected!")

        result = handler({"action": "search_pages", "query": "test"}, None)

        self.assertFalse(result["success"])
        self.assertIn("エラー", result["message"])


if __name__ == "__main__":
    unittest.main()
