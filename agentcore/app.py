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
    """エージェントのストリーミングレスポンスを生成"""
    stream = agent.stream_async(content)
    async for event in stream:
        if isinstance(event, dict) and "data" in event:
            text = event["data"]
            if isinstance(text, str):
                yield text


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

    # Gateway統合を試み、失敗時はツールなしで実行
    try:
        agent, mcp_client = create_tonari_agent_with_gateway(
            session_id=session_id, actor_id=actor_id
        )
        with mcp_client:
            tools = mcp_client.list_tools_sync()
            agent = create_tonari_agent(
                session_id=session_id,
                actor_id=actor_id,
                mcp_tools=tools,
            )
            async for text in _stream_response(agent, content):
                yield text
    except Exception as e:
        logger.warning("Gateway connection failed, running without tools: %s", e)
        agent = create_tonari_agent(session_id=session_id, actor_id=actor_id)
        async for text in _stream_response(agent, content):
            yield text


if __name__ == "__main__":
    # ローカルテスト用（ポート8080で起動）
    app.run(port=8080)
