"""サブエージェントモジュール

MCPツールをドメイン別に分割し、各ドメインの専門サブエージェントを@toolとして提供する。
メインエージェントは必要時にサブエージェントをツールとして呼び出す。
"""

import logging
import os

from strands import Agent, tool
from strands.models import BedrockModel

from .sub_agent_prompts import (
    CALENDAR_AGENT_PROMPT,
    GMAIL_AGENT_PROMPT,
    NOTION_AGENT_PROMPT,
    TASK_AGENT_PROMPT,
)

logger = logging.getLogger(__name__)

# サブエージェント用ツール（init_sub_agent_toolsで設定）
_task_tools: list = []
_calendar_tools: list = []
_gmail_tools: list = []
_notion_tools: list = []
_actor_id: str = ""

# ツール名プレフィックス → サブエージェントバケット
SUB_AGENT_PREFIXES = {
    "task-tool": "task",
    "calendar-tool": "calendar",
    "gmail-tool": "gmail",
    "notion-tool": "notion",
}


def _create_sub_agent_model() -> BedrockModel:
    """サブエージェント用のBedrockModelを作成"""
    return BedrockModel(
        model_id=os.getenv(
            "BEDROCK_MODEL_ID", "jp.anthropic.claude-haiku-4-5-20251001-v1:0"
        ),
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
        streaming=True,
    )


def split_mcp_tools(all_tools: list) -> dict[str, list]:
    """MCPツールをプレフィックスでサブエージェント用とメイン用に分割する。

    Args:
        all_tools: MCPから取得した全ツールリスト

    Returns:
        {"main": [...], "task": [...], "calendar": [...], "gmail": [...], "notion": [...]}
    """
    result: dict[str, list] = {
        "main": [],
        "task": [],
        "calendar": [],
        "gmail": [],
        "notion": [],
    }

    for t in all_tools:
        name = t.tool_name
        prefix = name.split("___")[0] if "___" in name else ""
        bucket = SUB_AGENT_PREFIXES.get(prefix)
        if bucket:
            result[bucket].append(t)
        else:
            result["main"].append(t)

    for key, tools in result.items():
        logger.info(
            "split_mcp_tools: %s = %d tools (%s)",
            key,
            len(tools),
            [t.tool_name for t in tools],
        )

    return result


def init_sub_agent_tools(tool_map: dict[str, list], actor_id: str = "") -> None:
    """split_mcp_toolsの結果とactor_idをモジュール変数にセットする（起動時1回）"""
    global _task_tools, _calendar_tools, _gmail_tools, _notion_tools, _actor_id
    _task_tools = tool_map.get("task", [])
    _calendar_tools = tool_map.get("calendar", [])
    _gmail_tools = tool_map.get("gmail", [])
    _notion_tools = tool_map.get("notion", [])
    _actor_id = actor_id


@tool
def task_agent(request: str) -> str:
    """タスク管理のサブエージェント。タスクの一覧取得、追加、完了、更新を行う。

    Args:
        request: オーナーのタスクに関するリクエスト（例: 「タスク一覧を見せて」「買い物をタスクに追加して」）
    """
    try:
        prompt = TASK_AGENT_PROMPT + f"\n\n## オーナー情報\nuser_id: {_actor_id}"
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=prompt,
            tools=_task_tools,
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("task_agent error")
        return f"タスク操作でエラーが発生しました: {e}"


@tool
def calendar_agent(request: str) -> str:
    """Googleカレンダーのサブエージェント。予定の一覧取得、空き確認、作成、更新、削除、候補日検索を行う。

    Args:
        request: オーナーのカレンダーに関するリクエスト（例: 「今日の予定は？」「明日14時に会議を入れて」）
    """
    try:
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=CALENDAR_AGENT_PROMPT,
            tools=_calendar_tools,
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("calendar_agent error")
        return f"カレンダー操作でエラーが発生しました: {e}"


@tool
def gmail_agent(request: str) -> str:
    """Gmailのサブエージェント。メールの検索、取得、下書き作成、アーカイブを行う。

    Args:
        request: オーナーのメールに関するリクエスト（例: 「未読メールを確認して」「〇〇さんにメールの下書きを作って」）
    """
    try:
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=GMAIL_AGENT_PROMPT,
            tools=_gmail_tools,
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("gmail_agent error")
        return f"メール操作でエラーが発生しました: {e}"


@tool
def notion_agent(request: str) -> str:
    """Notionのサブエージェント。ページの検索、取得、作成、更新、データベース操作を行う。

    Args:
        request: オーナーのNotionに関するリクエスト（例: 「メモして」「ブックマークして」「プロダクトアイデアに追加して」）
    """
    try:
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=NOTION_AGENT_PROMPT,
            tools=_notion_tools,
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("notion_agent error")
        return f"Notion操作でエラーが発生しました: {e}"
