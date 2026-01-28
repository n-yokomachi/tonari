"""AgentCore Runtime エントリポイント（ストリーミング対応）"""

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from src.agent.scensei_agent import create_scensei_agent

app = BedrockAgentCoreApp()


@app.entrypoint
async def invoke(payload: dict):
    """エージェント呼び出しエントリポイント（ストリーミング）"""
    prompt = payload.get("prompt", "") if isinstance(payload, dict) else str(payload)
    session_id = payload.get("session_id", "default-session")
    actor_id = payload.get("actor_id", "anonymous")

    # セッションごとにエージェントを作成（AgentCore Memory統合）
    agent = create_scensei_agent(session_id=session_id, actor_id=actor_id)

    # ストリーミングレスポンスを生成
    stream = agent.stream_async(prompt)
    async for event in stream:
        # Strands SDKのTextStreamEventは {"data": text} 形式
        if isinstance(event, dict) and "data" in event:
            text = event["data"]
            if isinstance(text, str):
                yield text


if __name__ == "__main__":
    # ローカルテスト用（ポート8080で起動）
    app.run(port=8080)
