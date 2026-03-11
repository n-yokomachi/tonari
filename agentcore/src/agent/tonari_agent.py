"""Tonari エージェント実装"""

import logging
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
from strands.agent.conversation_manager import SlidingWindowConversationManager
from strands.models import BedrockModel, CacheConfig
from strands.tools.mcp import MCPClient

from .prompts import PIPELINE_SYSTEM_PROMPT, TONARI_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# モデルプロバイダー定数
MODEL_PROVIDER_BEDROCK = "bedrock"
MODEL_PROVIDER_OPENROUTER = "openrouter"

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


def _create_bedrock_model(cache_tools: bool = False) -> BedrockModel:
    """共通のBedrockModelインスタンスを作成

    Args:
        cache_tools: ツール定義のプロンプトキャッシングを有効にするか
    """
    kwargs = {
        "model_id": os.getenv(
            "BEDROCK_MODEL_ID", "jp.anthropic.claude-haiku-4-5-20251001-v1:0"
        ),
        "region_name": os.getenv("AWS_REGION", "ap-northeast-1"),
        "streaming": True,
        "cache_config": CacheConfig(strategy="auto"),
    }
    if cache_tools:
        kwargs["cache_tools"] = "default"
    return BedrockModel(**kwargs)


def _get_ssm_parameter(name: str) -> str:
    """SSM Parameter Storeからパラメータを取得（SecureString対応）"""
    import boto3

    ssm = boto3.client("ssm", region_name=os.getenv("AWS_REGION", "ap-northeast-1"))
    response = ssm.get_parameter(Name=name, WithDecryption=True)
    return response["Parameter"]["Value"]


def _create_openrouter_model(reasoning_enabled: bool = False):
    """OpenRouter経由のOpenAIModelインスタンスを作成

    Args:
        reasoning_enabled: reasoningを有効にするか（Trueで精度向上、応答遅延）
    """
    from strands.models.openai import OpenAIModel

    model_id = os.getenv("OPENROUTER_MODEL_ID", "x-ai/grok-4.1-fast")

    # SSMパスから実行時にAPIキーを取得
    ssm_path = os.getenv("SSM_OPENROUTER_API_KEY", "")
    api_key = ""
    if ssm_path:
        try:
            api_key = _get_ssm_parameter(ssm_path)
        except Exception as e:
            logger.warning("Failed to get OpenRouter API key from SSM: %s", e)

    if not api_key:
        logger.warning("OpenRouter API key not available, falling back to Bedrock")
        return _create_bedrock_model()

    params = {}
    if not reasoning_enabled:
        params["extra_body"] = {"reasoning": {"enabled": False}}
    return OpenAIModel(
        client_args={
            "api_key": api_key,
            "base_url": "https://openrouter.ai/api/v1",
        },
        model_id=model_id,
        params=params,
    )


def _get_default_model_provider() -> str:
    """環境変数からデフォルトのモデルプロバイダーを取得"""
    return os.getenv("MODEL_PROVIDER", MODEL_PROVIDER_BEDROCK)


def _create_model(
    model_provider: str | None = None, cache_tools: bool = False,
    reasoning_enabled: bool = False,
):
    """モデルプロバイダーに応じたモデルインスタンスを作成

    Args:
        model_provider: モデルプロバイダー ("bedrock" or "openrouter")。Noneの場合は環境変数を参照
        cache_tools: ツール定義のプロンプトキャッシングを有効にするか（Bedrockのみ）
        reasoning_enabled: reasoningを有効にするか（OpenRouterのみ）
    """
    provider = model_provider or _get_default_model_provider()
    if provider == MODEL_PROVIDER_OPENROUTER:
        return _create_openrouter_model(reasoning_enabled=reasoning_enabled)
    return _create_bedrock_model(cache_tools=cache_tools)


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
            "/preferences/{actorId}/": RetrievalConfig(top_k=3, relevance_score=0.5),
            # 事実情報（購入履歴、試した香水など、オーナー単位）
            "/facts/{actorId}/": RetrievalConfig(top_k=3, relevance_score=0.4),
            # セッションサマリー（全セッション横断取得）
            "/summaries/{actorId}/": RetrievalConfig(top_k=2, relevance_score=0.6),
            # エピソード記憶+リフレクション（全セッション横断取得）
            "/episodes/{actorId}/": RetrievalConfig(top_k=2, relevance_score=0.5),
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
    model_provider: str = MODEL_PROVIDER_BEDROCK,
    reasoning_enabled: bool = False,
) -> Agent:
    """Tonariエージェントを作成（フルモード：LTM + ツール付き）

    Args:
        session_id: セッションID（タブ単位で管理）
        actor_id: ユーザーID（ブラウザ単位で永続化）
        mcp_tools: MCPから取得したツールリスト（オプション）
        model_provider: モデルプロバイダー ("bedrock" or "openrouter")
        reasoning_enabled: reasoningを有効にするか（OpenRouterのみ）

    Returns:
        Agent: セッション管理機能付きのTonariエージェント
    """
    memory_config = _create_memory_config(session_id, actor_id, use_ltm=True)
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
    )

    has_tools = bool(mcp_tools)
    agent = Agent(
        model=_create_model(model_provider, cache_tools=has_tools, reasoning_enabled=reasoning_enabled),
        system_prompt=TONARI_SYSTEM_PROMPT,
        conversation_manager=SlidingWindowConversationManager(window_size=10),
        session_manager=session_manager,
        tools=mcp_tools or [],
    )
    return agent


def create_tonari_agent_light(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
    model_provider: str = MODEL_PROVIDER_BEDROCK,
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
        model=_create_model(model_provider),
        system_prompt=TONARI_SYSTEM_PROMPT,
        conversation_manager=SlidingWindowConversationManager(window_size=10),
        session_manager=session_manager,
        tools=[],
    )
    return agent


def create_tonari_agent_pipeline(
    session_id: str = "default-session",
    actor_id: str = "anonymous",
    mcp_tools: Optional[list] = None,
) -> Agent:
    """パイプライン用軽量エージェント（LTM有効、サブエージェントなし、最小プロンプト）

    ツイート・ニュースなどの自動パイプラインで使用。
    フルエージェントと比べてシステムプロンプトが短く、サブエージェントを含まないため
    入力トークンを大幅に削減できる。
    モデルは環境変数MODEL_PROVIDERに従う。
    """
    memory_config = _create_memory_config(session_id, actor_id, use_ltm=True)
    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
    )

    has_tools = bool(mcp_tools)
    agent = Agent(
        model=_create_model(cache_tools=has_tools),
        system_prompt=PIPELINE_SYSTEM_PROMPT,
        conversation_manager=SlidingWindowConversationManager(window_size=4),
        session_manager=session_manager,
        tools=mcp_tools or [],
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
