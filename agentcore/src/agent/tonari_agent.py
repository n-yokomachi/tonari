"""Tonari エージェント実装"""

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
from strands.models.bedrock import CacheConfig
from strands.tools.mcp import MCPClient

from .prompts import TONARI_SYSTEM_PROMPT

# デフォルトのMemory ID（AgentCore CLIで作成済み）
DEFAULT_MEMORY_ID = "tonari_memory-aky0rJC6wh"

# Gateway設定（IAM認証を使用）
DEFAULT_GATEWAY_URL = "https://tonari-gateway-umzqvn6zkm.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp"


def create_mcp_client(gateway_url: str, region: str) -> MCPClient:
    """IAM認証を使用してMCPClientを作成"""

    def create_transport():
        return aws_iam_streamablehttp_client(
            endpoint=gateway_url,
            aws_region=region,
            aws_service="bedrock-agentcore",
        )

    return MCPClient(create_transport)


def _create_bedrock_model() -> BedrockModel:
    """共通のBedrockModelインスタンスを作成"""
    return BedrockModel(
        model_id=os.getenv(
            "BEDROCK_MODEL_ID", "jp.anthropic.claude-haiku-4-5-20251001-v1:0"
        ),
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
        streaming=True,
        cache_config=CacheConfig(strategy="auto"),
    )


def _create_memory_config(
    session_id: str,
    actor_id: str,
    use_ltm: bool = True,
) -> AgentCoreMemoryConfig:
    """AgentCore Memory設定を作成

    Args:
        session_id: セッションID（タブ単位で管理）
        actor_id: ユーザーID（ブラウザ単位で永続化）
        use_ltm: LTM（長期記憶）検索を有効にするか
    """
    retrieval_config = {}
    if use_ltm:
        retrieval_config = {
            # ユーザーの好み（オーナー単位）
            "/preferences/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.5),
            # 事実情報（購入履歴、試した香水など、オーナー単位）
            "/facts/{actorId}/": RetrievalConfig(top_k=10, relevance_score=0.4),
            # セッションサマリー（全セッション横断取得）
            "/summaries/{actorId}/": RetrievalConfig(top_k=3, relevance_score=0.6),
            # エピソード記憶+リフレクション（全セッション横断取得）
            "/episodes/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.5),
        }

    return AgentCoreMemoryConfig(
        memory_id=os.getenv("AGENTCORE_MEMORY_ID", DEFAULT_MEMORY_ID),
        session_id=session_id,
        actor_id=actor_id,
        retrieval_config=retrieval_config,
    )


def create_tonari_agent(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
    mcp_tools: Optional[list] = None,
) -> Agent:
    """Tonariエージェントを作成（フルモード：LTM + ツール付き）

    Args:
        session_id: セッションID（タブ単位で管理）
        actor_id: ユーザーID（ブラウザ単位で永続化）
        mcp_tools: MCPから取得したツールリスト（オプション）

    Returns:
        Agent: セッション管理機能付きのTonariエージェント
    """
    memory_config = _create_memory_config(session_id, actor_id, use_ltm=True)
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
    )

    agent = Agent(
        model=_create_bedrock_model(),
        system_prompt=TONARI_SYSTEM_PROMPT,
        session_manager=session_manager,
        tools=mcp_tools or [],
    )
    return agent


def create_tonari_agent_light(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
) -> Agent:
    """Tonariエージェントを作成（軽量モード：STMのみ、ツールなし）

    雑談などツールもLTM検索も不要なリクエスト用。
    STM（会話履歴）は維持されるため、会話の文脈は保たれる。
    """
    memory_config = _create_memory_config(session_id, actor_id, use_ltm=False)
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
    )

    agent = Agent(
        model=_create_bedrock_model(),
        system_prompt=TONARI_SYSTEM_PROMPT,
        session_manager=session_manager,
        tools=[],
    )
    return agent


def create_tonari_agent_with_gateway(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
) -> tuple[Agent, MCPClient]:
    """Gateway統合済みのTonariエージェントを作成（IAM認証）

    Returns:
        tuple: (Agent, MCPClient) - MCPClientはcontext managerとして使用する必要あり
    """
    gateway_url = os.getenv("AGENTCORE_GATEWAY_URL", DEFAULT_GATEWAY_URL)
    region = os.getenv("AWS_REGION", "ap-northeast-1")

    # IAM認証でMCPClient作成
    mcp_client = create_mcp_client(gateway_url, region)

    return create_tonari_agent(session_id, actor_id), mcp_client
