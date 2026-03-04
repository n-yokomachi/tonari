"""Notion Tool Lambda: Notion API operations via action-based dispatch."""

import json
import logging

import boto3
from notion_client import APIResponseError, Client

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SSM_PARAM_NAME = "/tonari/notion/api_token"
_notion_client = None


def _get_notion_client() -> Client:
    """Get or initialize Notion client using SSM-stored API token.

    Returns cached client on subsequent calls. Cache is cleared on auth errors.
    """
    global _notion_client
    if _notion_client:
        return _notion_client

    ssm = boto3.client("ssm")
    resp = ssm.get_parameter(Name=SSM_PARAM_NAME, WithDecryption=True)
    token = resp["Parameter"]["Value"]

    _notion_client = Client(auth=token)
    logger.info("Notion client initialized")
    return _notion_client


def _clear_client_cache() -> None:
    """Clear cached Notion client (called on auth errors)."""
    global _notion_client
    _notion_client = None


def _extract_plain_text(rich_text: list | None) -> str:
    """Extract concatenated plain text from Notion rich_text array."""
    if not rich_text:
        return ""
    return "".join(item.get("plain_text", "") for item in rich_text)


def _convert_property_value(prop: dict):
    """Convert a Notion property value to a simplified format.

    Supports: title, rich_text, number, select, multi_select, date,
    checkbox, url, status, people, relation. Unknown types return "[type]".
    """
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


def _parse_json_param(value, param_name: str):
    """Parse a JSON string parameter, or return as-is if already parsed.

    Returns None if value is None.
    Raises ValueError with param_name context if JSON parsing fails.
    """
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError) as e:
        raise ValueError(
            f"{param_name} のJSON形式が不正です: {e}"
        ) from e


def _handle_notion_error(error) -> dict:
    """Convert Notion API errors to user-friendly error responses."""
    status = getattr(error, "status", 0)

    if status == 401:
        _clear_client_cache()
        return {
            "success": False,
            "message": "Notion認証が無効です。APIトークンを確認してください。",
        }
    if status == 403:
        return {
            "success": False,
            "message": "Notionへのアクセス権限がありません。Integrationの接続を確認してください。",
        }
    if status == 404:
        return {
            "success": False,
            "message": "指定されたNotionページまたはデータベースが見つかりません。",
        }
    if status == 429:
        return {
            "success": False,
            "message": "Notion APIの制限に達しました。しばらく待ってからお試しください。",
        }
    if status >= 500:
        return {
            "success": False,
            "message": "Notionサーバーでエラーが発生しました。",
        }
    return {
        "success": False,
        "message": f"Notionでエラーが発生しました: {error}",
    }


def _convert_page_properties(properties: dict) -> dict:
    """Convert all Notion page properties to simplified format."""
    return {
        name: _convert_property_value(value)
        for name, value in properties.items()
    }


# --- Action functions (stubs for Task 2) ---


def _search_pages(client: Client, event: dict) -> dict:
    """Search pages in workspace by keyword."""
    query = event.get("query", "")
    if not query:
        return {"success": False, "message": "query は必須です。"}

    max_results = int(event.get("max_results", 10))

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

    return {
        "pages": pages,
        "resultCount": len(pages),
        "has_more": response.get("has_more", False),
    }


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


def _get_page(client: Client, event: dict) -> dict:
    """Get page properties and optionally block content."""
    page_id = event.get("page_id", "")
    if not page_id:
        return {"success": False, "message": "page_id は必須です。"}

    include_blocks = event.get("include_blocks", True)

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

    return result


def _create_page(client: Client, event: dict) -> dict:
    """Create a page under a database or parent page."""
    database_id = event.get("database_id", "")
    parent_page_id = event.get("parent_page_id", "")

    if not database_id and not parent_page_id:
        return {
            "success": False,
            "message": "database_id または parent_page_id のいずれかは必須です。",
        }

    if database_id:
        parent = {"data_source_id": database_id}
    else:
        parent = {"page_id": parent_page_id}

    title = event.get("title", "")
    properties = event.get("properties")
    content = event.get("content", "")

    if properties:
        properties = _parse_json_param(properties, "properties")
        # title パラメータも指定されている場合、properties にタイトルが無ければマージ
        if title:
            has_title_prop = any(
                isinstance(v, dict) and v.get("type") == "title"
                or (isinstance(v, dict) and "title" in v)
                for v in properties.values()
            )
            if not has_title_prop:
                title_key = "Name" if database_id else "title"
                properties[title_key] = {
                    "title": [{"text": {"content": title}}]
                }
    elif title:
        if database_id:
            properties = {"Name": {"title": [{"text": {"content": title}}]}}
        else:
            properties = {"title": {"title": [{"text": {"content": title}}]}}

    create_kwargs = {"parent": parent}
    if properties:
        create_kwargs["properties"] = properties

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

    return {
        "success": True,
        "id": page["id"],
        "title": page_title,
        "url": page.get("url", ""),
        "message": f"ページ「{page_title}」を作成しました。",
    }


def _update_page(client: Client, event: dict) -> dict:
    """Update page properties, append content, or archive."""
    page_id = event.get("page_id", "")
    if not page_id:
        return {"success": False, "message": "page_id は必須です。"}

    properties = event.get("properties")
    content = event.get("content", "")
    archived = event.get("archived", False)

    actions_done = []

    if archived:
        client.pages.update(page_id=page_id, archived=True)
        actions_done.append("アーカイブ")
    elif properties:
        properties = _parse_json_param(properties, "properties")
        client.pages.update(page_id=page_id, properties=properties)
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
    return {
        "success": True,
        "message": f"ページを{summary}しました。",
    }


def _query_database(client: Client, event: dict) -> dict:
    """Query a database with optional filter and sort."""
    database_id = event.get("database_id", "")
    if not database_id:
        return {"success": False, "message": "database_id は必須です。"}

    max_results = int(event.get("max_results", 20))

    query_kwargs = {
        "data_source_id": database_id,
        "page_size": min(max_results, 100),
    }

    filter_param = event.get("filter")
    if filter_param:
        query_kwargs["filter"] = _parse_json_param(filter_param, "filter")

    sorts_param = event.get("sorts")
    if sorts_param:
        query_kwargs["sorts"] = _parse_json_param(sorts_param, "sorts")

    response = client.data_sources.query(**query_kwargs)

    pages = []
    for page in response.get("results", [])[:max_results]:
        pages.append({
            "id": page["id"],
            "url": page.get("url", ""),
            "properties": _convert_page_properties(page.get("properties", {})),
        })

    return {
        "pages": pages,
        "resultCount": len(pages),
        "has_more": response.get("has_more", False),
    }


def _get_database(client: Client, event: dict) -> dict:
    """Get database property schema."""
    database_id = event.get("database_id", "")
    if not database_id:
        return {"success": False, "message": "database_id は必須です。"}

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

    return {
        "success": True,
        "database": {
            "id": db["id"],
            "title": title,
            "properties": properties,
        },
    }


# Action dispatch table
_ACTION_MAP = {
    "search_pages": _search_pages,
    "get_page": _get_page,
    "create_page": _create_page,
    "update_page": _update_page,
    "query_database": _query_database,
    "get_database": _get_database,
}


def handler(event, context):
    """Dispatch to appropriate action function based on event.action field."""
    action = event.get("action", "")
    if not action:
        return {
            "success": False,
            "message": "不明なアクションです。action フィールドが必要です。",
        }

    logger.info("Handler called with action: %s", action)

    action_fn = _ACTION_MAP.get(action)
    if not action_fn:
        return {
            "success": False,
            "message": f"不明なアクションです: {action}",
        }

    try:
        client = _get_notion_client()
        return action_fn(client, event)
    except APIResponseError as e:
        logger.exception("Notion API error for action %s", action)
        return _handle_notion_error(e)
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        logger.exception("Unexpected error for action %s", action)
        return {
            "success": False,
            "message": f"エラーが発生しました: {e}",
        }
