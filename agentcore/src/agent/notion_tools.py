"""Notion tools for Strands Agent.

Direct @tool functions that access Notion API
via AgentCore Identity for token management.
"""

import json
import logging

from notion_client import APIResponseError
from strands import tool

from .notion_auth import get_notion_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_plain_text(rich_text: list | None) -> str:
    """Extract concatenated plain text from Notion rich_text array."""
    if not rich_text:
        return ""
    return "".join(item.get("plain_text", "") for item in rich_text)


def _convert_property_value(prop: dict):
    """Convert a Notion property value to a simplified format."""
    prop_type = prop.get("type", "")

    if prop_type == "title":
        return _extract_plain_text(prop.get("title", []))
    if prop_type == "rich_text":
        return _extract_plain_text(prop.get("rich_text", []))
    if prop_type == "number":
        return prop.get("number")
    if prop_type == "select":
        sel = prop.get("select")
        return sel["name"] if sel else None
    if prop_type == "multi_select":
        return [item["name"] for item in prop.get("multi_select", [])]
    if prop_type == "date":
        date = prop.get("date")
        if not date:
            return None
        start = date.get("start", "")
        end = date.get("end")
        return f"{start} → {end}" if end else start
    if prop_type == "checkbox":
        return prop.get("checkbox", False)
    if prop_type == "url":
        return prop.get("url")
    if prop_type == "status":
        status = prop.get("status")
        return status["name"] if status else None
    if prop_type == "people":
        return [p.get("name", "") for p in prop.get("people", [])]
    if prop_type == "relation":
        return [r["id"] for r in prop.get("relation", [])]
    return f"[{prop_type}]"


def _convert_page_properties(properties: dict) -> dict:
    """Convert all Notion page properties to simplified format."""
    return {
        name: _convert_property_value(value)
        for name, value in properties.items()
    }


def _parse_json_param(value, param_name: str):
    """Parse a JSON string parameter, or return as-is if already parsed."""
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError) as e:
        raise ValueError(f"{param_name} のJSON形式が不正です: {e}") from e


def _extract_block_text(block: dict) -> dict:
    """Convert a Notion block to a readable text representation."""
    block_type = block.get("type", "")
    block_data = block.get(block_type, {})

    if block_type == "divider":
        return {"type": "divider", "text": "---"}

    rich_text = block_data.get("rich_text", [])
    text = _extract_plain_text(rich_text)

    if block_type in ("heading_1", "heading_2", "heading_3"):
        level = block_type[-1]
        prefix = "#" * int(level)
        return {"type": block_type, "text": f"{prefix} {text}"}
    if block_type == "bulleted_list_item":
        return {"type": block_type, "text": f"• {text}"}
    if block_type == "numbered_list_item":
        return {"type": block_type, "text": f"1. {text}"}
    if block_type == "to_do":
        checked = block_data.get("checked", False)
        mark = "[x]" if checked else "[ ]"
        return {"type": block_type, "text": f"{mark} {text}"}
    if block_type == "code":
        lang = block_data.get("language", "")
        return {"type": block_type, "text": f"```{lang}\n{text}\n```"}
    if block_type == "quote":
        return {"type": block_type, "text": f"> {text}"}
    if block_type == "callout":
        icon = block_data.get("icon", {})
        emoji = icon.get("emoji", "") if icon else ""
        return {"type": block_type, "text": f"{emoji} {text}".strip()}
    return {"type": block_type, "text": text}


def _handle_notion_error(e: APIResponseError) -> str:
    """Convert Notion API errors to user-friendly messages."""
    status = getattr(e, "status", 0)
    if status == 401:
        return json.dumps({"success": False, "message": "Notion認証が無効です。再認証が必要です。"})
    if status == 403:
        return json.dumps({"success": False, "message": "Notionへのアクセス権限がありません。"})
    if status == 404:
        return json.dumps({"success": False, "message": "指定されたNotionページまたはデータベースが見つかりません。"})
    if status == 429:
        return json.dumps({"success": False, "message": "Notion APIの制限に達しました。しばらく待ってからお試しください。"})
    if status >= 500:
        return json.dumps({"success": False, "message": "Notionサーバーでエラーが発生しました。"})
    return json.dumps({"success": False, "message": f"Notionでエラーが発生しました: {e}"})


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@tool
def notion_search_pages(query: str, max_results: int = 10) -> str:
    """Search Notion workspace pages by keyword. Returns matching pages with titles, URLs, and last edited times sorted by recency.

    Args:
        query: Search keyword (required).
        max_results: Maximum number of results to return. Default 10.

    Returns:
        JSON with pages list (id, title, url, last_edited), count, and has_more flag.
    """
    try:
        client = get_notion_client()

        if not query:
            return json.dumps({"success": False, "message": "query は必須です。"}, ensure_ascii=False)

        response = client.search(
            query=query,
            filter={"property": "object", "value": "page"},
            page_size=min(max_results, 100),
            sort={"direction": "descending", "timestamp": "last_edited_time"},
        )

        pages = []
        for page in response.get("results", [])[:max_results]:
            props = page.get("properties", {})
            title = ""
            for prop in props.values():
                if prop.get("type") == "title":
                    title = _extract_plain_text(prop.get("title", []))
                    break
            pages.append({
                "id": page["id"],
                "title": title,
                "url": page.get("url", ""),
                "last_edited": page.get("last_edited_time", ""),
            })

        return json.dumps({
            "pages": pages,
            "resultCount": len(pages),
            "has_more": response.get("has_more", False),
        }, ensure_ascii=False)
    except APIResponseError as e:
        return _handle_notion_error(e)
    except Exception as e:
        logger.exception("notion_search_pages error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def notion_get_page(page_id: str, include_blocks: bool = True) -> str:
    """Get a Notion page by ID. Returns page properties and optionally block content.

    Args:
        page_id: Notion page ID (required).
        include_blocks: Whether to include page block content. Default true.

    Returns:
        JSON with page details (id, url, properties, blocks).
    """
    try:
        client = get_notion_client()

        if not page_id:
            return json.dumps({"success": False, "message": "page_id は必須です。"}, ensure_ascii=False)

        page = client.pages.retrieve(page_id=page_id)
        properties = _convert_page_properties(page.get("properties", {}))

        result = {
            "success": True,
            "id": page["id"],
            "url": page.get("url", ""),
            "properties": properties,
        }

        if include_blocks:
            blocks_resp = client.blocks.children.list(block_id=page_id, page_size=100)
            result["blocks"] = [
                _extract_block_text(b) for b in blocks_resp.get("results", [])
            ]

        return json.dumps(result, ensure_ascii=False)
    except APIResponseError as e:
        return _handle_notion_error(e)
    except Exception as e:
        logger.exception("notion_get_page error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def notion_create_page(
    title: str = "",
    database_id: str = "",
    parent_page_id: str = "",
    properties: str = "",
    content: str = "",
) -> str:
    """Create a new Notion page under a database or parent page.

    Args:
        title: Page title (shorthand, sets Name/title property).
        database_id: Target database ID (either database_id or parent_page_id required).
        parent_page_id: Parent page ID (either database_id or parent_page_id required).
        properties: Full Notion properties object as JSON string (overrides title if both provided).
        content: Page body text (each line becomes a paragraph block).

    Returns:
        JSON with created page details (id, title, url) and success message.
    """
    try:
        client = get_notion_client()

        if not database_id and not parent_page_id:
            return json.dumps({
                "success": False,
                "message": "database_id または parent_page_id のいずれかは必須です。",
            }, ensure_ascii=False)

        if database_id:
            parent = {"data_source_id": database_id}
        else:
            parent = {"page_id": parent_page_id}

        # Resolve the title property name from DB schema if targeting a database
        title_key = "title"
        if database_id:
            try:
                db_schema = client.data_sources.retrieve(data_source_id=database_id)
                for prop_name, prop_def in db_schema.get("properties", {}).items():
                    if prop_def.get("type") == "title":
                        title_key = prop_name
                        break
            except Exception:
                title_key = "Name"  # fallback

        props = None
        if properties:
            props = _parse_json_param(properties, "properties")
            if title:
                has_title_prop = any(
                    isinstance(v, dict) and (v.get("type") == "title" or "title" in v)
                    for v in props.values()
                )
                if not has_title_prop:
                    props[title_key] = {"title": [{"text": {"content": title}}]}
        elif title:
            props = {title_key: {"title": [{"text": {"content": title}}]}}

        create_kwargs = {"parent": parent}
        if props:
            create_kwargs["properties"] = props

        if content:
            paragraphs = content.split("\n")
            create_kwargs["children"] = [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": line}}]
                    },
                }
                for line in paragraphs
                if line.strip()
            ]

        page = client.pages.create(**create_kwargs)

        page_title = ""
        for prop in page.get("properties", {}).values():
            if prop.get("type") == "title":
                page_title = _extract_plain_text(prop.get("title", []))
                break

        return json.dumps({
            "success": True,
            "id": page["id"],
            "title": page_title,
            "url": page.get("url", ""),
            "message": f"ページ「{page_title}」を作成しました。",
        }, ensure_ascii=False)
    except APIResponseError as e:
        return _handle_notion_error(e)
    except ValueError as e:
        return json.dumps({"success": False, "message": str(e)}, ensure_ascii=False)
    except Exception as e:
        logger.exception("notion_create_page error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def notion_update_page(
    page_id: str,
    properties: str = "",
    content: str = "",
    archived: bool = False,
) -> str:
    """Update a Notion page: modify properties, append content blocks, or archive.

    Args:
        page_id: Notion page ID to update (required).
        properties: Notion properties object as JSON string to update.
        content: Text to append as paragraph blocks at end of page.
        archived: Set true to archive (move to trash).

    Returns:
        JSON with success status and action summary message.
    """
    try:
        client = get_notion_client()

        if not page_id:
            return json.dumps({"success": False, "message": "page_id は必須です。"}, ensure_ascii=False)

        actions_done = []

        if archived:
            client.pages.update(page_id=page_id, archived=True)
            actions_done.append("アーカイブ")
        elif properties:
            parsed_props = _parse_json_param(properties, "properties")
            client.pages.update(page_id=page_id, properties=parsed_props)
            actions_done.append("プロパティを更新")

        if content:
            paragraphs = content.split("\n")
            children = [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": line}}]
                    },
                }
                for line in paragraphs
                if line.strip()
            ]
            client.blocks.children.append(block_id=page_id, children=children)
            actions_done.append("コンテンツを追記")

        summary = "、".join(actions_done) if actions_done else "更新"
        return json.dumps({
            "success": True,
            "message": f"ページを{summary}しました。",
        }, ensure_ascii=False)
    except APIResponseError as e:
        return _handle_notion_error(e)
    except ValueError as e:
        return json.dumps({"success": False, "message": str(e)}, ensure_ascii=False)
    except Exception as e:
        logger.exception("notion_update_page error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def notion_query_database(
    database_id: str,
    filter: str = "",
    sorts: str = "",
    max_results: int = 20,
) -> str:
    """Query a Notion database with optional filter and sort. Returns pages with property summaries.

    Args:
        database_id: Notion database ID to query (required).
        filter: Notion filter object as JSON string (optional).
        sorts: Notion sorts array as JSON string (optional).
        max_results: Maximum number of results to return. Default 20.

    Returns:
        JSON with pages list (id, url, properties), count, and has_more flag.
    """
    try:
        client = get_notion_client()

        if not database_id:
            return json.dumps({"success": False, "message": "database_id は必須です。"}, ensure_ascii=False)

        query_kwargs = {
            "data_source_id": database_id,
            "page_size": min(max_results, 100),
        }

        if filter:
            query_kwargs["filter"] = _parse_json_param(filter, "filter")
        if sorts:
            query_kwargs["sorts"] = _parse_json_param(sorts, "sorts")

        response = client.data_sources.query(**query_kwargs)

        pages = []
        for page in response.get("results", [])[:max_results]:
            pages.append({
                "id": page["id"],
                "url": page.get("url", ""),
                "properties": _convert_page_properties(page.get("properties", {})),
            })

        return json.dumps({
            "pages": pages,
            "resultCount": len(pages),
            "has_more": response.get("has_more", False),
        }, ensure_ascii=False)
    except APIResponseError as e:
        return _handle_notion_error(e)
    except ValueError as e:
        return json.dumps({"success": False, "message": str(e)}, ensure_ascii=False)
    except Exception as e:
        logger.exception("notion_query_database error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def notion_get_database(database_id: str) -> str:
    """Get database property schema. Returns property names, types, and select/multi_select options.

    Args:
        database_id: Notion database ID (required).

    Returns:
        JSON with database details (id, title, properties with types and options).
    """
    try:
        client = get_notion_client()

        if not database_id:
            return json.dumps({"success": False, "message": "database_id は必須です。"}, ensure_ascii=False)

        db = client.data_sources.retrieve(data_source_id=database_id)

        title_parts = db.get("title", [])
        title = _extract_plain_text(title_parts)

        properties = {}
        for name, prop_def in db.get("properties", {}).items():
            prop_info = {"type": prop_def["type"]}

            if prop_def["type"] == "select":
                options = prop_def.get("select", {}).get("options", [])
                prop_info["options"] = [o["name"] for o in options]
            elif prop_def["type"] == "multi_select":
                options = prop_def.get("multi_select", {}).get("options", [])
                prop_info["options"] = [o["name"] for o in options]
            elif prop_def["type"] == "status":
                groups = prop_def.get("status", {}).get("options", [])
                prop_info["options"] = [o["name"] for o in groups]

            properties[name] = prop_info

        return json.dumps({
            "success": True,
            "database": {
                "id": db["id"],
                "title": title,
                "properties": properties,
            },
        }, ensure_ascii=False)
    except APIResponseError as e:
        return _handle_notion_error(e)
    except Exception as e:
        logger.exception("notion_get_database error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


# All Notion tools for easy import
NOTION_TOOLS = [
    notion_search_pages,
    notion_get_page,
    notion_create_page,
    notion_update_page,
    notion_query_database,
    notion_get_database,
]
