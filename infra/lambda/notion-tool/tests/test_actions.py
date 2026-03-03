"""Notion Tool Lambda unit tests for Task 2: Action implementations."""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch, call

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class TestSearchPages(unittest.TestCase):
    """Tests for search_pages action (Task 2.1)."""

    @patch("index._get_notion_client")
    def test_search_returns_page_list(self, mock_get_client):
        """Returns list of pages with title, URL, and last edited time."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client
        client.search.return_value = {
            "results": [
                {
                    "id": "page-1",
                    "url": "https://notion.so/page-1",
                    "last_edited_time": "2026-03-01T10:00:00Z",
                    "properties": {
                        "Name": {
                            "type": "title",
                            "title": [{"plain_text": "First Page"}],
                        }
                    },
                },
                {
                    "id": "page-2",
                    "url": "https://notion.so/page-2",
                    "last_edited_time": "2026-02-28T09:00:00Z",
                    "properties": {
                        "Title": {
                            "type": "title",
                            "title": [{"plain_text": "Second Page"}],
                        }
                    },
                },
            ],
            "has_more": False,
        }

        result = handler({"action": "search_pages", "query": "test"}, None)

        self.assertEqual(result["resultCount"], 2)
        self.assertEqual(result["pages"][0]["title"], "First Page")
        self.assertEqual(result["pages"][0]["url"], "https://notion.so/page-1")
        self.assertEqual(result["pages"][1]["title"], "Second Page")

    @patch("index._get_notion_client")
    def test_search_missing_query_returns_error(self, mock_get_client):
        """Missing query parameter returns error."""
        from index import handler

        result = handler({"action": "search_pages"}, None)

        self.assertFalse(result["success"])
        self.assertIn("query", result["message"])

    @patch("index._get_notion_client")
    def test_search_respects_max_results(self, mock_get_client):
        """Limits results to max_results parameter."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client
        client.search.return_value = {
            "results": [
                {
                    "id": f"page-{i}",
                    "url": f"https://notion.so/page-{i}",
                    "last_edited_time": "2026-03-01T10:00:00Z",
                    "properties": {
                        "Name": {
                            "type": "title",
                            "title": [{"plain_text": f"Page {i}"}],
                        }
                    },
                }
                for i in range(5)
            ],
            "has_more": False,
        }

        result = handler(
            {"action": "search_pages", "query": "test", "max_results": 2},
            None,
        )

        self.assertEqual(result["resultCount"], 2)

    @patch("index._get_notion_client")
    def test_search_empty_results(self, mock_get_client):
        """Returns empty list when no pages match."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client
        client.search.return_value = {"results": [], "has_more": False}

        result = handler({"action": "search_pages", "query": "nonexistent"}, None)

        self.assertEqual(result["resultCount"], 0)
        self.assertEqual(result["pages"], [])


class TestGetPage(unittest.TestCase):
    """Tests for get_page action (Task 2.2)."""

    @patch("index._get_notion_client")
    def test_get_page_returns_properties_and_blocks(self, mock_get_client):
        """Returns page properties and block content."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.retrieve.return_value = {
            "id": "page-1",
            "url": "https://notion.so/page-1",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "Test Page"}],
                },
                "Status": {
                    "type": "status",
                    "status": {"name": "In Progress"},
                },
            },
        }
        client.blocks.children.list.return_value = {
            "results": [
                {
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"plain_text": "Hello world"}]
                    },
                },
                {
                    "type": "heading_2",
                    "heading_2": {
                        "rich_text": [{"plain_text": "Section Title"}]
                    },
                },
            ],
            "has_more": False,
        }

        result = handler({"action": "get_page", "page_id": "page-1"}, None)

        self.assertTrue(result["success"])
        self.assertEqual(result["properties"]["Name"], "Test Page")
        self.assertEqual(result["properties"]["Status"], "In Progress")
        self.assertIn("blocks", result)
        self.assertEqual(len(result["blocks"]), 2)

    @patch("index._get_notion_client")
    def test_get_page_without_blocks(self, mock_get_client):
        """Returns only properties when include_blocks is False."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.retrieve.return_value = {
            "id": "page-1",
            "url": "https://notion.so/page-1",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "Test"}],
                },
            },
        }

        result = handler(
            {"action": "get_page", "page_id": "page-1", "include_blocks": False},
            None,
        )

        self.assertTrue(result["success"])
        client.blocks.children.list.assert_not_called()
        self.assertNotIn("blocks", result)

    @patch("index._get_notion_client")
    def test_get_page_missing_page_id(self, mock_get_client):
        """Missing page_id returns error."""
        from index import handler

        result = handler({"action": "get_page"}, None)

        self.assertFalse(result["success"])
        self.assertIn("page_id", result["message"])

    @patch("index._get_notion_client")
    def test_get_page_converts_block_types(self, mock_get_client):
        """Converts various block types to readable text."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.retrieve.return_value = {
            "id": "page-1",
            "url": "https://notion.so/page-1",
            "properties": {
                "Name": {"type": "title", "title": [{"plain_text": "Test"}]},
            },
        }
        client.blocks.children.list.return_value = {
            "results": [
                {
                    "type": "heading_1",
                    "heading_1": {"rich_text": [{"plain_text": "H1"}]},
                },
                {
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{"plain_text": "Item 1"}]
                    },
                },
                {
                    "type": "numbered_list_item",
                    "numbered_list_item": {
                        "rich_text": [{"plain_text": "Step 1"}]
                    },
                },
                {
                    "type": "to_do",
                    "to_do": {
                        "rich_text": [{"plain_text": "Task"}],
                        "checked": True,
                    },
                },
                {
                    "type": "code",
                    "code": {
                        "rich_text": [{"plain_text": "print('hi')"}],
                        "language": "python",
                    },
                },
                {
                    "type": "divider",
                    "divider": {},
                },
            ],
            "has_more": False,
        }

        result = handler({"action": "get_page", "page_id": "page-1"}, None)

        blocks = result["blocks"]
        self.assertIn("# H1", blocks[0]["text"])
        self.assertIn("•", blocks[1]["text"])
        self.assertIn("1.", blocks[2]["text"])
        self.assertIn("[x]", blocks[3]["text"])
        self.assertIn("print('hi')", blocks[4]["text"])
        self.assertEqual(blocks[5]["type"], "divider")


class TestCreatePage(unittest.TestCase):
    """Tests for create_page action (Task 2.3)."""

    @patch("index._get_notion_client")
    def test_create_page_in_database(self, mock_get_client):
        """Creates page under a database with title."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.create.return_value = {
            "id": "new-page",
            "url": "https://notion.so/new-page",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "My Note"}],
                },
            },
        }

        result = handler(
            {
                "action": "create_page",
                "database_id": "db-123",
                "title": "My Note",
            },
            None,
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["url"], "https://notion.so/new-page")
        self.assertIn("My Note", result["title"])

    @patch("index._get_notion_client")
    def test_create_page_under_parent(self, mock_get_client):
        """Creates page under a parent page."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.create.return_value = {
            "id": "new-sub",
            "url": "https://notion.so/new-sub",
            "properties": {
                "title": {
                    "type": "title",
                    "title": [{"plain_text": "Sub Page"}],
                },
            },
        }

        result = handler(
            {
                "action": "create_page",
                "parent_page_id": "parent-1",
                "title": "Sub Page",
            },
            None,
        )

        self.assertTrue(result["success"])
        client.pages.create.assert_called_once()
        call_kwargs = client.pages.create.call_args[1]
        self.assertIn("page_id", call_kwargs["parent"])

    @patch("index._get_notion_client")
    def test_create_page_with_content(self, mock_get_client):
        """Creates page with text content as paragraph blocks."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.create.return_value = {
            "id": "new-page",
            "url": "https://notion.so/new-page",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "With Content"}],
                },
            },
        }

        result = handler(
            {
                "action": "create_page",
                "database_id": "db-123",
                "title": "With Content",
                "content": "Hello\nWorld",
            },
            None,
        )

        self.assertTrue(result["success"])
        call_kwargs = client.pages.create.call_args[1]
        self.assertIn("children", call_kwargs)

    @patch("index._get_notion_client")
    def test_create_page_with_properties(self, mock_get_client):
        """Creates page with custom properties dict."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.create.return_value = {
            "id": "new-page",
            "url": "https://notion.so/new-page",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "Custom"}],
                },
            },
        }

        result = handler(
            {
                "action": "create_page",
                "database_id": "db-123",
                "properties": {
                    "Name": {
                        "title": [
                            {"text": {"content": "Custom"}}
                        ]
                    },
                    "Tags": {
                        "multi_select": [{"name": "メモ"}]
                    },
                },
            },
            None,
        )

        self.assertTrue(result["success"])

    @patch("index._get_notion_client")
    def test_create_page_missing_parent_returns_error(self, mock_get_client):
        """Missing both database_id and parent_page_id returns error."""
        from index import handler

        result = handler(
            {"action": "create_page", "title": "Orphan"}, None
        )

        self.assertFalse(result["success"])
        self.assertIn("database_id", result["message"])


class TestUpdatePage(unittest.TestCase):
    """Tests for update_page action (Task 2.4)."""

    @patch("index._get_notion_client")
    def test_update_properties(self, mock_get_client):
        """Updates page properties."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.update.return_value = {
            "id": "page-1",
            "url": "https://notion.so/page-1",
        }

        result = handler(
            {
                "action": "update_page",
                "page_id": "page-1",
                "properties": {"Status": {"status": {"name": "完了"}}},
            },
            None,
        )

        self.assertTrue(result["success"])
        self.assertIn("プロパティ", result["message"])

    @patch("index._get_notion_client")
    def test_append_content(self, mock_get_client):
        """Appends text blocks to page."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.blocks.children.append.return_value = {"results": []}

        result = handler(
            {
                "action": "update_page",
                "page_id": "page-1",
                "content": "New paragraph",
            },
            None,
        )

        self.assertTrue(result["success"])
        client.blocks.children.append.assert_called_once()
        self.assertIn("コンテンツ", result["message"])

    @patch("index._get_notion_client")
    def test_archive_page(self, mock_get_client):
        """Archives page by setting archived=True."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.pages.update.return_value = {
            "id": "page-1",
            "url": "https://notion.so/page-1",
        }

        result = handler(
            {
                "action": "update_page",
                "page_id": "page-1",
                "archived": True,
            },
            None,
        )

        self.assertTrue(result["success"])
        self.assertIn("アーカイブ", result["message"])
        client.pages.update.assert_called_once_with(
            page_id="page-1", archived=True
        )

    @patch("index._get_notion_client")
    def test_update_missing_page_id(self, mock_get_client):
        """Missing page_id returns error."""
        from index import handler

        result = handler(
            {"action": "update_page", "properties": {}}, None
        )

        self.assertFalse(result["success"])
        self.assertIn("page_id", result["message"])


class TestQueryDatabase(unittest.TestCase):
    """Tests for query_database action (Task 2.5)."""

    @patch("index._get_notion_client")
    def test_query_returns_pages(self, mock_get_client):
        """Returns page list from database query."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.data_sources.query.return_value = {
            "results": [
                {
                    "id": "page-1",
                    "url": "https://notion.so/page-1",
                    "properties": {
                        "Name": {
                            "type": "title",
                            "title": [{"plain_text": "Entry 1"}],
                        },
                        "Status": {
                            "type": "status",
                            "status": {"name": "進行中"},
                        },
                    },
                },
            ],
            "has_more": False,
        }

        result = handler(
            {"action": "query_database", "database_id": "db-1"}, None
        )

        self.assertEqual(result["resultCount"], 1)
        self.assertEqual(result["pages"][0]["properties"]["Name"], "Entry 1")
        self.assertEqual(result["pages"][0]["properties"]["Status"], "進行中")

    @patch("index._get_notion_client")
    def test_query_with_filter(self, mock_get_client):
        """Passes filter parameter to Notion API."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client
        client.data_sources.query.return_value = {
            "results": [],
            "has_more": False,
        }

        filter_obj = {
            "property": "Status",
            "status": {"equals": "完了"},
        }

        handler(
            {
                "action": "query_database",
                "database_id": "db-1",
                "filter": filter_obj,
            },
            None,
        )

        call_kwargs = client.data_sources.query.call_args[1]
        self.assertEqual(call_kwargs["filter"], filter_obj)

    @patch("index._get_notion_client")
    def test_query_with_sorts(self, mock_get_client):
        """Passes sorts parameter to Notion API."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client
        client.data_sources.query.return_value = {
            "results": [],
            "has_more": False,
        }

        sorts = [{"property": "Name", "direction": "ascending"}]

        handler(
            {
                "action": "query_database",
                "database_id": "db-1",
                "sorts": sorts,
            },
            None,
        )

        call_kwargs = client.data_sources.query.call_args[1]
        self.assertEqual(call_kwargs["sorts"], sorts)

    @patch("index._get_notion_client")
    def test_query_missing_database_id(self, mock_get_client):
        """Missing database_id returns error."""
        from index import handler

        result = handler({"action": "query_database"}, None)

        self.assertFalse(result["success"])
        self.assertIn("database_id", result["message"])

    @patch("index._get_notion_client")
    def test_query_with_json_string_filter(self, mock_get_client):
        """Parses JSON string filter parameter."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client
        client.data_sources.query.return_value = {
            "results": [],
            "has_more": False,
        }

        handler(
            {
                "action": "query_database",
                "database_id": "db-1",
                "filter": '{"property": "Status", "status": {"equals": "完了"}}',
            },
            None,
        )

        call_kwargs = client.data_sources.query.call_args[1]
        self.assertEqual(call_kwargs["filter"]["property"], "Status")


class TestGetDatabase(unittest.TestCase):
    """Tests for get_database action (Task 2.6)."""

    @patch("index._get_notion_client")
    def test_returns_schema_with_select_options(self, mock_get_client):
        """Returns database schema with select/status options."""
        from index import handler

        client = MagicMock()
        mock_get_client.return_value = client

        client.data_sources.retrieve.return_value = {
            "id": "db-1",
            "title": [{"plain_text": "My Database"}],
            "properties": {
                "Name": {"type": "title", "title": {}},
                "Category": {
                    "type": "select",
                    "select": {
                        "options": [
                            {"name": "Tech"},
                            {"name": "Design"},
                        ]
                    },
                },
                "Status": {
                    "type": "status",
                    "status": {
                        "options": [
                            {"name": "未着手"},
                            {"name": "進行中"},
                            {"name": "完了"},
                        ]
                    },
                },
                "Tags": {
                    "type": "multi_select",
                    "multi_select": {
                        "options": [
                            {"name": "Tag1"},
                            {"name": "Tag2"},
                        ]
                    },
                },
            },
        }

        result = handler(
            {"action": "get_database", "database_id": "db-1"}, None
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["database"]["title"], "My Database")
        props = result["database"]["properties"]
        self.assertEqual(props["Category"]["options"], ["Tech", "Design"])
        self.assertEqual(
            props["Status"]["options"], ["未着手", "進行中", "完了"]
        )
        self.assertEqual(props["Tags"]["options"], ["Tag1", "Tag2"])

    @patch("index._get_notion_client")
    def test_missing_database_id(self, mock_get_client):
        """Missing database_id returns error."""
        from index import handler

        result = handler({"action": "get_database"}, None)

        self.assertFalse(result["success"])
        self.assertIn("database_id", result["message"])


if __name__ == "__main__":
    unittest.main()
