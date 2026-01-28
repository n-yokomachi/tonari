"""Scensei エージェント実装"""

import os

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from strands import Agent
from strands.models import BedrockModel

from .prompts import SCENSEI_SYSTEM_PROMPT

# デフォルトのMemory ID（AgentCore CLIで作成済み）
DEFAULT_MEMORY_ID = "scensei_mem-INEd7K94yX"


def create_scensei_agent(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
) -> Agent:
    """Scenseiエージェントを作成（セッション管理付き）

    Args:
        session_id: セッションID（タブ単位で管理）
        actor_id: ユーザーID（ブラウザ単位で永続化）

    Returns:
        Agent: セッション管理機能付きのScenseiエージェント
    """
    # AgentCore Memory設定（STM + LTM）
    # LTM戦略はMemoryリソース側で設定済み:
    # - scensei_user_preferences (USER_PREFERENCE)
    # - scensei_semantic_facts (SEMANTIC)
    # - scensei_episodic (EPISODIC)
    memory_config = AgentCoreMemoryConfig(
        memory_id=os.getenv("AGENTCORE_MEMORY_ID", DEFAULT_MEMORY_ID),
        session_id=session_id,
        actor_id=actor_id,
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
    )

    # Bedrock経由でClaude Haiku 4.5を使用（jp.プレフィックスでクロスリージョン推論）
    bedrock_model = BedrockModel(
        model_id=os.getenv(
            "BEDROCK_MODEL_ID", "jp.anthropic.claude-haiku-4-5-20251001-v1:0"
        ),
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
        streaming=True,
    )

    agent = Agent(
        model=bedrock_model,
        system_prompt=SCENSEI_SYSTEM_PROMPT,
        session_manager=session_manager,
        # Phase 7以降でtools追加予定
    )
    return agent


# ローカルテスト用
if __name__ == "__main__":
    agent = create_scensei_agent(session_id="test-session-local", actor_id="test-user")
    response = agent("こんにちは！夏におすすめの爽やかな香水を教えて")
    print(response)
