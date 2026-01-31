"""Scensei エージェント実装"""

import os
from typing import Optional

from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    RetrievalConfig,
)
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from mcp_proxy_for_aws.client import aws_iam_streamablehttp_client
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient

from .prompts import SCENSEI_SYSTEM_PROMPT

# デフォルトのMemory ID（AgentCore CLIで作成済み）
DEFAULT_MEMORY_ID = "scensei_mem-INEd7K94yX"

# Gateway設定（IAM認証を使用）
DEFAULT_GATEWAY_URL = "https://scenseigateway-zxdprxgrqx.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp"


def create_mcp_client(gateway_url: str, region: str) -> MCPClient:
    """IAM認証を使用してMCPClientを作成"""

    def create_transport():
        return aws_iam_streamablehttp_client(
            endpoint=gateway_url,
            aws_region=region,
            aws_service="bedrock-agentcore",
        )

    return MCPClient(create_transport)


def create_scensei_agent(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
    mcp_tools: Optional[list] = None,
) -> Agent:
    """Scenseiエージェントを作成（セッション管理付き）

    Args:
        session_id: セッションID（タブ単位で管理）
        actor_id: ユーザーID（ブラウザ単位で永続化）
        mcp_tools: MCPから取得したツールリスト（オプション）

    Returns:
        Agent: セッション管理機能付きのScenseiエージェント
    """
    # AgentCore Memory設定（STM + LTM取得）
    memory_config = AgentCoreMemoryConfig(
        memory_id=os.getenv("AGENTCORE_MEMORY_ID", DEFAULT_MEMORY_ID),
        session_id=session_id,
        actor_id=actor_id,
        retrieval_config={
            # ユーザーの香り好み（甘い香りが好き、など）
            "/preferences/{actorId}": RetrievalConfig(top_k=5, relevance_score=0.5),
            # 事実情報（購入履歴、試した香水など）
            "/facts/{actorId}": RetrievalConfig(top_k=10, relevance_score=0.4),
            # セッションサマリー（過去の会話の要約）
            "/summaries/{actorId}/{sessionId}": RetrievalConfig(
                top_k=3, relevance_score=0.6
            ),
        },
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
    )

    # Bedrock経由でClaude Haiku 4.5を使用
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
        tools=mcp_tools or [],
    )
    return agent


def create_scensei_agent_with_gateway(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
) -> tuple[Agent, MCPClient]:
    """Gateway統合済みのScenseiエージェントを作成（IAM認証）

    Returns:
        tuple: (Agent, MCPClient) - MCPClientはcontext managerとして使用する必要あり
    """
    gateway_url = os.getenv("AGENTCORE_GATEWAY_URL", DEFAULT_GATEWAY_URL)
    region = os.getenv("AWS_REGION", "ap-northeast-1")

    # IAM認証でMCPClient作成
    mcp_client = create_mcp_client(gateway_url, region)

    return create_scensei_agent(session_id, actor_id), mcp_client
