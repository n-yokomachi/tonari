"""Scensei エージェント実装"""

import base64
import os
from typing import Optional

import httpx
from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient

from .prompts import SCENSEI_SYSTEM_PROMPT

# デフォルトのMemory ID（AgentCore CLIで作成済み）
DEFAULT_MEMORY_ID = "scensei_mem-INEd7K94yX"

# Gateway設定
DEFAULT_GATEWAY_URL = "https://scenseigateway-ipv8wrpowl.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp"
DEFAULT_COGNITO_USER_POOL_ID = "ap-northeast-1_9YLOHAYn6"
DEFAULT_COGNITO_CLIENT_ID = "1qemnml5e11reu81d0jap2ele3"
DEFAULT_COGNITO_CLIENT_SECRET = "cqm1freo0sbpqv0oee7lsq7aoqlhr14nn3id27ualudd0e1lq2d"


def get_cognito_token(
    user_pool_id: str,
    client_id: str,
    client_secret: str,
    region: str = "ap-northeast-1",
) -> str:
    """Cognitoからアクセストークンを取得（Client Credentials Flow）"""
    token_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"

    # Basic認証ヘッダーを作成
    credentials = f"{client_id}:{client_secret}"
    encoded_credentials = base64.b64encode(credentials.encode()).decode()

    # Cognitoのoauth2/tokenエンドポイント
    # User Pool IDからドメインを推測（カスタムドメインの場合は環境変数で設定）
    domain = os.getenv("COGNITO_DOMAIN", "scensei-m2m-identity")
    oauth_url = f"https://{domain}.auth.{region}.amazoncognito.com/oauth2/token"

    response = httpx.post(
        oauth_url,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {encoded_credentials}",
        },
        data={
            "grant_type": "client_credentials",
            "scope": os.getenv(
                "COGNITO_SCOPE", "agentcore-m2m-03ce8ee4/read agentcore-m2m-03ce8ee4/write"
            ),
        },
    )

    if response.status_code != 200:
        raise Exception(f"Failed to get token: {response.text}")

    return response.json()["access_token"]


def create_mcp_client(access_token: str, gateway_url: str) -> MCPClient:
    """MCPClientを作成"""

    def create_transport():
        return streamablehttp_client(
            gateway_url,
            headers={"Authorization": f"Bearer {access_token}"},
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
    # AgentCore Memory設定（STM + LTM）
    memory_config = AgentCoreMemoryConfig(
        memory_id=os.getenv("AGENTCORE_MEMORY_ID", DEFAULT_MEMORY_ID),
        session_id=session_id,
        actor_id=actor_id,
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
    """Gateway統合済みのScenseiエージェントを作成

    Returns:
        tuple: (Agent, MCPClient) - MCPClientはcontext managerとして使用する必要あり
    """
    # Gateway設定を取得
    gateway_url = os.getenv("AGENTCORE_GATEWAY_URL", DEFAULT_GATEWAY_URL)
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID", DEFAULT_COGNITO_USER_POOL_ID)
    client_id = os.getenv("COGNITO_CLIENT_ID", DEFAULT_COGNITO_CLIENT_ID)
    client_secret = os.getenv("COGNITO_CLIENT_SECRET", DEFAULT_COGNITO_CLIENT_SECRET)
    region = os.getenv("AWS_REGION", "ap-northeast-1")

    # トークン取得
    try:
        access_token = get_cognito_token(user_pool_id, client_id, client_secret, region)
    except Exception as e:
        print(f"Warning: Failed to get Cognito token: {e}")
        print("Creating agent without Gateway tools...")
        return create_scensei_agent(session_id, actor_id), None

    # MCPClient作成
    mcp_client = create_mcp_client(access_token, gateway_url)

    return create_scensei_agent(session_id, actor_id), mcp_client


# ローカルテスト用
if __name__ == "__main__":
    agent, mcp_client = create_scensei_agent_with_gateway(
        session_id="test-session-local", actor_id="test-user"
    )

    if mcp_client:
        with mcp_client:
            tools = mcp_client.list_tools_sync()
            print(f"Available tools: {[t.name for t in tools]}")
            agent = create_scensei_agent(
                session_id="test-session-local",
                actor_id="test-user",
                mcp_tools=tools,
            )
            response = agent("夏におすすめの爽やかな香水を教えて")
            print(response)
    else:
        response = agent("こんにちは！夏におすすめの爽やかな香水を教えて")
        print(response)
