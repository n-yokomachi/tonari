"""AgentCore Runtime エントリポイント（ストリーミング対応）"""

import asyncio
import base64
import logging
import os

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from src.agent.sub_agents import (
    briefing_agent,
    calendar_agent,
    diary_agent,
    gmail_agent,
    init_sub_agent_tools,
    intro_agent,
    notion_agent,
    split_mcp_tools,
    task_agent,
    twitter_agent,
)
from strands_tools.tavily import tavily_search
from src.agent.twitter_tools import TWITTER_TOOLS
from src.agent.tonari_agent import (
    MODEL_PROVIDER_BEDROCK,
    _get_default_model_provider,
    create_mcp_client,
    create_tonari_agent,
    create_tonari_agent_pipeline,
    create_tonari_agent_with_gateway,
)

logger = logging.getLogger(__name__)


def _init_tavily_api_key():
    """Fetch Tavily API key from AgentCore Identity and set as env var."""
    if os.getenv("TAVILY_API_KEY"):
        return
    try:
        from src.agent.notion_auth import _run_async, AWS_REGION
        from bedrock_agentcore.runtime import BedrockAgentCoreContext
        from bedrock_agentcore.services.identity import IdentityClient

        workload_token = BedrockAgentCoreContext.get_workload_access_token()
        if not workload_token:
            return
        client = IdentityClient(region=AWS_REGION)

        async def _fetch():
            return await client.get_api_key(
                provider_name="tavily-api-key",
                agent_identity_token=workload_token,
            )

        api_key = _run_async(_fetch())
        os.environ["TAVILY_API_KEY"] = api_key
        logger.info("TAVILY_API_KEY set from AgentCore Identity")
    except Exception as e:
        logger.warning("Failed to fetch Tavily API key from Identity: %s", e)


_init_tavily_api_key()

app = BedrockAgentCoreApp()

# 保持中のAgentとそのセッション情報
_current_agent = None
_current_mcp_client = None
_current_session_id = None
_current_actor_id = None
_current_model_provider = None
_current_reasoning_enabled = None


def _get_or_create_agent(
    session_id: str, actor_id: str, model_provider: str = MODEL_PROVIDER_BEDROCK,
    reasoning_enabled: bool = False,
):
    """同じセッション・同じモデルならAgentを使い回し、変わったら作り直す"""
    global _current_agent, _current_mcp_client, _current_session_id, _current_actor_id, _current_model_provider, _current_reasoning_enabled

    if (
        _current_agent is not None
        and _current_session_id == session_id
        and _current_actor_id == actor_id
        and _current_model_provider == model_provider
        and _current_reasoning_enabled == reasoning_enabled
    ):
        return _current_agent

    # 既存のMCPClient接続があれば閉じる
    if _current_mcp_client is not None:
        try:
            _current_mcp_client.stop()
        except Exception:
            pass
        _current_mcp_client = None

    # フル装備のAgentを作成（LTM + Gateway + ツール）
    try:
        agent, mcp_client = create_tonari_agent_with_gateway(
            session_id=session_id, actor_id=actor_id
        )
        mcp_client.start()
        all_tools = mcp_client.list_tools_sync()
        # 香水系ツールはコスト削減のため除外
        EXCLUDED_TOOLS = {"perfume-search___search_perfumes"}
        tools = [t for t in all_tools if t.tool_name not in EXCLUDED_TOOLS] if all_tools else []
        tool_names = [t.tool_name for t in tools]
        logger.info("Gateway tools discovered: %s (excluded: %s)", tool_names, EXCLUDED_TOOLS)

        # ツールをサブエージェント用とメイン用に分割
        tool_map = split_mcp_tools(tools)
        init_sub_agent_tools(tool_map, actor_id=actor_id)
        main_tools = tool_map["main"] + [
            task_agent, calendar_agent, gmail_agent, notion_agent,
            briefing_agent, diary_agent, intro_agent, twitter_agent,
        ]

        agent = create_tonari_agent(
            session_id=session_id,
            actor_id=actor_id,
            mcp_tools=main_tools,
            model_provider=model_provider,
            reasoning_enabled=reasoning_enabled,
        )
        _current_mcp_client = mcp_client
    except Exception as e:
        logger.warning("Gateway connection failed, running without tools: %s", e, exc_info=True)
        agent = create_tonari_agent(
            session_id=session_id, actor_id=actor_id, model_provider=model_provider,
            reasoning_enabled=reasoning_enabled,
        )

    _current_agent = agent
    _current_session_id = session_id
    _current_actor_id = actor_id
    _current_model_provider = model_provider
    _current_reasoning_enabled = reasoning_enabled
    return agent


# パイプラインモード別のGateway MCPツールフィルタ
PIPELINE_TOOL_FILTERS = {
    "news": {"TavilySearch"},
}

# パイプラインモード別の直接ツール（@tool関数、Gateway不要）
PIPELINE_DIRECT_TOOLS = {
    "tweet": TWITTER_TOOLS + [tavily_search],
}


def _create_pipeline_agent(session_id: str, actor_id: str, mode: str):
    """パイプライン用軽量エージェントを作成（毎回新規、キャッシュしない）"""
    import os
    gateway_url = os.getenv(
        "AGENTCORE_GATEWAY_URL",
        "https://tonari-gateway-umzqvn6zkm.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp",
    )
    region = os.getenv("AWS_REGION", "ap-northeast-1")

    allowed_prefixes = PIPELINE_TOOL_FILTERS.get(mode, set())
    direct_tools = PIPELINE_DIRECT_TOOLS.get(mode, [])
    mcp_client = None
    gateway_tools = []

    # Gateway MCP ツールの取得（MCPフィルタがある場合のみ）
    if allowed_prefixes:
        mcp_client = create_mcp_client(gateway_url, region)
        try:
            mcp_client.start()
            all_tools = mcp_client.list_tools_sync()
            gateway_tools = [
                t for t in (all_tools or [])
                if t.tool_name.split("___")[0] in allowed_prefixes
            ]
        except Exception as e:
            logger.warning("Pipeline gateway failed: %s", e)
            try:
                mcp_client.stop()
            except Exception:
                pass
            mcp_client = None

    # MCPツールと@toolは混在不可のため、分けて渡す
    agent = create_tonari_agent_pipeline(
        session_id=session_id,
        actor_id=actor_id,
        mcp_tools=gateway_tools or None,
        extra_tools=direct_tools or None,
    )
    return agent, mcp_client


def build_content_blocks(
    prompt: str, image_base64: str | None, image_format: str = "jpeg"
) -> list | str:
    """画像データがある場合はStrands Agent ContentBlockリストを構築する。

    Args:
        prompt: テキストプロンプト
        image_base64: base64エンコードされた画像データ（Noneの場合テキストのみ）
        image_format: 画像フォーマット（デフォルト: "jpeg"）

    Returns:
        画像がある場合: [{"text": prompt}, {"image": {...}}] のContentBlockリスト
        画像がない場合: prompt文字列
    """
    if not image_base64:
        return prompt

    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception:
        logger.warning("Invalid base64 image data, falling back to text-only")
        return prompt

    blocks = []
    # Strands Agentはテキストブロックを必須とするため、空でも含める
    blocks.append({"text": prompt or " "})
    blocks.append(
        {"image": {"format": image_format, "source": {"bytes": image_bytes}}}
    )
    return blocks


async def _stream_response(agent, content):
    """エージェントのストリーミングレスポンスを生成

    エージェント実行をバックグラウンドタスクで走らせ、ストリームイベントを
    キュー経由でyieldする。

    Yields:
        str: テキストチャンク
        dict: ツールイベント ({"type": "tool_start", "tool": name} or {"type": "tool_end"})
    """
    event_queue = asyncio.Queue()

    async def _run_agent():
        active_tool = None
        try:
            async for event in agent.stream_async(content):
                if isinstance(event, dict):
                    if "data" in event:
                        text = event["data"]
                        if isinstance(text, str):
                            if active_tool is not None:
                                await event_queue.put({"type": "tool_end"})
                                active_tool = None
                            await event_queue.put(text)
                    elif "current_tool_use" in event:
                        tool_info = event["current_tool_use"]
                        tool_name = tool_info.get("name", "unknown")
                        if tool_name != active_tool:
                            if active_tool is not None:
                                await event_queue.put({"type": "tool_end"})
                            active_tool = tool_name
                            await event_queue.put({"type": "tool_start", "tool": tool_name})
            if active_tool is not None:
                await event_queue.put({"type": "tool_end"})
        except Exception as e:
            logger.error("Agent stream error: %s", e, exc_info=True)
            await event_queue.put({"type": "error", "message": str(e)})
        finally:
            await event_queue.put(None)  # 終了シグナル

    task = asyncio.create_task(_run_agent())

    try:
        while True:
            item = await event_queue.get()
            if item is None:
                break
            yield item
    finally:
        await task


@app.entrypoint
async def invoke(payload: dict):
    """エージェント呼び出しエントリポイント（ストリーミング）"""
    prompt = payload.get("prompt", "") if isinstance(payload, dict) else str(payload)
    session_id = payload.get("session_id", "default-session")
    actor_id = payload.get("actor_id", "anonymous")
    mode = payload.get("mode") if isinstance(payload, dict) else None
    default_provider = _get_default_model_provider()
    model_provider = (
        payload.get("model_provider", default_provider)
        if isinstance(payload, dict)
        else default_provider
    )
    reasoning_enabled = (
        payload.get("reasoning_enabled", False)
        if isinstance(payload, dict)
        else False
    )
    logger.info("invoke: model_provider=%s, reasoning_enabled=%s", model_provider, reasoning_enabled)
    image_base64 = payload.get("image_base64") if isinstance(payload, dict) else None
    image_format = (
        payload.get("image_format", "jpeg") if isinstance(payload, dict) else "jpeg"
    )

    content = build_content_blocks(prompt, image_base64, image_format)

    # パイプラインモード: 軽量エージェントを毎回作成
    if mode in PIPELINE_TOOL_FILTERS or mode in PIPELINE_DIRECT_TOOLS:
        pipeline_mcp_client = None
        try:
            agent, pipeline_mcp_client = _create_pipeline_agent(
                session_id, actor_id, mode
            )
            async for chunk in _stream_response(agent, content):
                yield chunk
        finally:
            if pipeline_mcp_client:
                try:
                    pipeline_mcp_client.stop()
                except Exception:
                    pass
        return

    # 通常モード: フルエージェント（キャッシュ付き）
    agent = _get_or_create_agent(session_id, actor_id, model_provider, reasoning_enabled)

    async for chunk in _stream_response(agent, content):
        yield chunk


if __name__ == "__main__":
    # ローカルテスト用（ポート8080で起動）
    app.run(port=8080)
