"""サブエージェントモジュール

MCPツールをドメイン別に分割し、各ドメインの専門サブエージェントを@toolとして提供する。
メインエージェントは必要時にサブエージェントをツールとして呼び出す。
"""

import logging
import os
from datetime import datetime, timedelta, timezone

from strands import Agent, tool
from strands.models import BedrockModel

from .sub_agent_prompts import (
    BRIEFING_AGENT_PROMPT,
    CALENDAR_AGENT_PROMPT,
    DIARY_AGENT_PROMPT,
    GMAIL_AGENT_PROMPT,
    INTRO_AGENT_PROMPT,
    NOTION_AGENT_PROMPT,
    TASK_AGENT_PROMPT,
    TWITTER_AGENT_PROMPT,
)

logger = logging.getLogger(__name__)

# サブエージェント用ツール（init_sub_agent_toolsで設定）
_task_tools: list = []
_calendar_tools: list = []
_gmail_tools: list = []
_notion_tools: list = []
_twitter_tools: list = []
_diary_tools: list = []
_main_tools: list = []
_actor_id: str = ""

# ツール名プレフィックス → サブエージェントバケット
SUB_AGENT_PREFIXES = {
    "task-tool": "task",
    "calendar-tool": "calendar",
    "gmail-tool": "gmail",
    "notion-tool": "notion",
    "twitter-read": "twitter",
    "twitter-write": "twitter",
    "diary-tool": "diary",
}


JST = timezone(timedelta(hours=9))


def _current_datetime_str() -> str:
    """現在日時（JST）を文字列で返す"""
    return datetime.now(JST).strftime("%Y年%m月%d日 %H:%M")


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
        "twitter": [],
        "diary": [],
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
    global _task_tools, _calendar_tools, _gmail_tools, _notion_tools
    global _twitter_tools, _diary_tools, _main_tools, _actor_id
    _task_tools = tool_map.get("task", [])
    _calendar_tools = tool_map.get("calendar", [])
    _gmail_tools = tool_map.get("gmail", [])
    _notion_tools = tool_map.get("notion", [])
    _twitter_tools = tool_map.get("twitter", [])
    _diary_tools = tool_map.get("diary", [])
    _main_tools = tool_map.get("main", [])
    _actor_id = actor_id


@tool
def task_agent(request: str) -> str:
    """タスク管理のサブエージェント。タスクの一覧取得、追加、完了、更新を行う。

    Args:
        request: オーナーのタスクに関するリクエスト（例: 「タスク一覧を見せて」「買い物をタスクに追加して」）
    """
    try:
        prompt = f"現在日時: {_current_datetime_str()}（JST）\n\n{TASK_AGENT_PROMPT}\n\n## オーナー情報\nuser_id: {_actor_id}"
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
        prompt = f"現在日時: {_current_datetime_str()}（JST）\n\n{CALENDAR_AGENT_PROMPT}"
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=prompt,
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
        prompt = f"現在日時: {_current_datetime_str()}（JST）\n\n{GMAIL_AGENT_PROMPT}"
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=prompt,
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


@tool
def briefing_agent(request: str) -> str:
    """ブリーフィングのサブエージェント。予定・メール・タスク・天気・支出をまとめて報告する。

    Args:
        request: ブリーフィングのリクエスト（日時情報を含めて渡すこと）
    """
    try:
        # ブリーフィングはcalendar/gmail/taskサブエージェント + DateTool + TavilySearchが必要
        briefing_tools = (
            _calendar_tools + _gmail_tools + _task_tools
            + [t for t in _main_tools if t.tool_name.startswith(("DateTool", "TavilySearch"))]
            + [task_agent, calendar_agent, gmail_agent]
        )
        prompt = f"現在日時: {_current_datetime_str()}（JST）\n\n{BRIEFING_AGENT_PROMPT}"
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=prompt,
            tools=briefing_tools,
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("briefing_agent error")
        return f"ブリーフィングでエラーが発生しました: {e}"


@tool
def diary_agent(request: str) -> str:
    """日記のサブエージェント。オーナーの一日をヒアリングして日記を作成・保存する。過去の日記の取得も行う。

    Args:
        request: オーナーの日記に関するリクエスト（例: 「日記を書きたい」「最近の日記を見せて」）
    """
    try:
        prompt = f"現在日時: {_current_datetime_str()}（JST）\n\n{DIARY_AGENT_PROMPT}"
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=prompt,
            tools=_diary_tools,
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("diary_agent error")
        return f"日記操作でエラーが発生しました: {e}"


@tool
def intro_agent(request: str) -> str:
    """自己紹介のサブエージェント。TONaRiの自己紹介を生成する。

    Args:
        request: 自己紹介のリクエスト（例: 「自己紹介して」「あなたは誰？」）
    """
    try:
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=INTRO_AGENT_PROMPT,
            tools=[],
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("intro_agent error")
        return f"自己紹介でエラーが発生しました: {e}"


@tool
def twitter_agent(request: str) -> str:
    """Twitterのサブエージェント。ツイートの取得・閲覧・投稿を行う。

    Args:
        request: Twitterに関するリクエスト（例: 「最近のツイートを見せて」「ツイートして」）
    """
    try:
        agent = Agent(
            model=_create_sub_agent_model(),
            system_prompt=TWITTER_AGENT_PROMPT,
            tools=_twitter_tools,
            callback_handler=None,
        )
        result = agent(request)
        return str(result)
    except Exception as e:
        logger.exception("twitter_agent error")
        return f"Twitter操作でエラーが発生しました: {e}"
