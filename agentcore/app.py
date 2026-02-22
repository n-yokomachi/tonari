"""AgentCore Runtime エントリポイント（ストリーミング対応）"""

import logging

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from src.agent.tonari_agent import (
    create_tonari_agent,
    create_tonari_agent_with_gateway,
)

logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()


async def _stream_response(agent, prompt):
    """エージェントのストリーミングレスポンスを生成"""
    stream = agent.stream_async(prompt)
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
            async for text in _stream_response(agent, prompt):
                yield text
    except Exception as e:
        logger.warning("Gateway connection failed, running without tools: %s", e)
        agent = create_tonari_agent(session_id=session_id, actor_id=actor_id)
        async for text in _stream_response(agent, prompt):
            yield text


if __name__ == "__main__":
    # ローカルテスト用（ポート8080で起動）
    app.run(port=8080)
