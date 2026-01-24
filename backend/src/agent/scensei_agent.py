"""Scensei エージェント実装"""

import os

from strands import Agent
from strands.models import BedrockModel

from .prompts import SCENSEI_SYSTEM_PROMPT


def create_scensei_agent() -> Agent:
    """Scenseiエージェントを作成"""
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
        # Phase 7以降でtools追加予定
    )
    return agent


# ローカルテスト用
if __name__ == "__main__":
    agent = create_scensei_agent()
    response = agent("こんにちは！夏におすすめの爽やかな香水を教えて")
    print(response)
