"""AgentCore Runtime エントリポイント（ストリーミング対応）"""

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from src.agent.tonari_agent import (
    create_tonari_agent,
    create_tonari_agent_with_gateway,
)

app = BedrockAgentCoreApp()


@app.entrypoint
async def invoke(payload: dict):
    """エージェント呼び出しエントリポイント（ストリーミング）"""
    prompt = payload.get("prompt", "") if isinstance(payload, dict) else str(payload)
    session_id = payload.get("session_id", "default-session")
    actor_id = payload.get("actor_id", "anonymous")

    # Gateway統合エージェントを作成
    agent, mcp_client = create_tonari_agent_with_gateway(
        session_id=session_id, actor_id=actor_id
    )

    if mcp_client:
        # MCPClient context内でエージェントを実行
        with mcp_client:
            tools = mcp_client.list_tools_sync()
            agent = create_tonari_agent(
                session_id=session_id,
                actor_id=actor_id,
                mcp_tools=tools,
            )
            # ストリーミングレスポンスを生成
            stream = agent.stream_async(prompt)
            async for event in stream:
                if isinstance(event, dict) and "data" in event:
                    text = event["data"]
                    if isinstance(text, str):
                        yield text
    else:
        # Gateway未接続の場合はツールなしで実行
        stream = agent.stream_async(prompt)
        async for event in stream:
            if isinstance(event, dict) and "data" in event:
                text = event["data"]
                if isinstance(text, str):
                    yield text


if __name__ == "__main__":
    # ローカルテスト用（ポート8080で起動）
    app.run(port=8080)
