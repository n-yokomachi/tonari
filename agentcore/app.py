"""AgentCore Runtime エントリポイント（ストリーミング対応）"""

import base64
import logging

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from src.agent.tonari_agent import (
    create_tonari_agent,
    create_tonari_agent_with_gateway,
)

logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()

# 保持中のAgentとそのセッション情報
_current_agent = None
_current_mcp_client = None
_current_session_id = None
_current_actor_id = None


def _get_or_create_agent(session_id: str, actor_id: str):
    """同じセッションならAgentを使い回し、変わったら作り直す"""
    global _current_agent, _current_mcp_client, _current_session_id, _current_actor_id

    if (
        _current_agent is not None
        and _current_session_id == session_id
        and _current_actor_id == actor_id
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
        tools = mcp_client.list_tools_sync()
        tool_names = [t.tool_name for t in tools] if tools else []
        logger.info("Gateway tools discovered: %s", tool_names)
        agent = create_tonari_agent(
            session_id=session_id,
            actor_id=actor_id,
            mcp_tools=tools,
        )
        _current_mcp_client = mcp_client
    except Exception as e:
        logger.warning("Gateway connection failed, running without tools: %s", e, exc_info=True)
        agent = create_tonari_agent(session_id=session_id, actor_id=actor_id)

    _current_agent = agent
    _current_session_id = session_id
    _current_actor_id = actor_id
    return agent


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

    Yields:
        str: テキストチャンク
        dict: ツールイベント ({"type": "tool_start", "tool": name} or {"type": "tool_end"})
    """
    stream = agent.stream_async(content)
    active_tool = None

    async for event in stream:
        if isinstance(event, dict):
            if "data" in event:
                text = event["data"]
                if isinstance(text, str):
                    if active_tool is not None:
                        yield {"type": "tool_end"}
                        active_tool = None
                    yield text
            elif "current_tool_use" in event:
                tool_info = event["current_tool_use"]
                tool_name = tool_info.get("name", "unknown")
                if tool_name != active_tool:
                    if active_tool is not None:
                        yield {"type": "tool_end"}
                    active_tool = tool_name
                    yield {"type": "tool_start", "tool": tool_name}

    if active_tool is not None:
        yield {"type": "tool_end"}


@app.entrypoint
async def invoke(payload: dict):
    """エージェント呼び出しエントリポイント（ストリーミング）"""
    prompt = payload.get("prompt", "") if isinstance(payload, dict) else str(payload)
    session_id = payload.get("session_id", "default-session")
    actor_id = payload.get("actor_id", "anonymous")
    image_base64 = payload.get("image_base64") if isinstance(payload, dict) else None
    image_format = (
        payload.get("image_format", "jpeg") if isinstance(payload, dict) else "jpeg"
    )

    content = build_content_blocks(prompt, image_base64, image_format)
    agent = _get_or_create_agent(session_id, actor_id)

    async for chunk in _stream_response(agent, content):
        yield chunk


if __name__ == "__main__":
    # ローカルテスト用（ポート8080で起動）
    app.run(port=8080)
