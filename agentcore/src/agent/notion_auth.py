"""Notion API authentication via AgentCore Identity.

Provides API key retrieval and Notion client builder
using AgentCore Identity's API Key Credential Provider.
"""

import asyncio
import logging
import os
import threading

from notion_client import Client

logger = logging.getLogger(__name__)

CREDENTIAL_PROVIDER_NAME = os.getenv(
    "NOTION_CREDENTIAL_PROVIDER",
    "notion_secrets",
)
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")


def _run_async(coro):
    """Run an async coroutine from sync context, handling existing event loops."""
    try:
        asyncio.get_running_loop()
        result = [None]
        exc = [None]

        def _run():
            try:
                result[0] = asyncio.run(coro)
            except Exception as e:
                exc[0] = e

        t = threading.Thread(target=_run)
        t.start()
        t.join()
        if exc[0]:
            raise exc[0]
        return result[0]
    except RuntimeError:
        return asyncio.run(coro)


def get_api_key() -> str:
    """Get a Notion API key via AgentCore Identity API Key Credential Provider."""
    from bedrock_agentcore.runtime import BedrockAgentCoreContext
    from bedrock_agentcore.services.identity import IdentityClient

    workload_token = BedrockAgentCoreContext.get_workload_access_token()
    if not workload_token:
        raise RuntimeError(
            "No workload access token available. "
            "Ensure the agent is running inside AgentCore Runtime."
        )

    client = IdentityClient(region=AWS_REGION)

    async def _fetch():
        return await client.get_api_key(
            provider_name=CREDENTIAL_PROVIDER_NAME,
            agent_identity_token=workload_token,
        )

    try:
        api_key = _run_async(_fetch())
        return api_key
    except Exception as e:
        error_detail = f"{type(e).__name__}: {e}"
        raise RuntimeError(
            f"Notion認証エラー: {error_detail}. "
            f"provider={CREDENTIAL_PROVIDER_NAME}, region={AWS_REGION}"
        ) from e


def get_notion_client() -> Client:
    """Build a Notion client using AgentCore Identity API key."""
    api_key = get_api_key()
    return Client(auth=api_key)
