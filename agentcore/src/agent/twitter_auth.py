"""Twitter/X API authentication via AgentCore Identity.

Provides credential retrieval and tweepy client builders
using AgentCore Identity's API Key Credential Provider.
Credentials are stored as a JSON object containing bearer_token
and OAuth 1.0a keys.
"""

import asyncio
import json
import logging
import os
import threading

import tweepy

logger = logging.getLogger(__name__)

CREDENTIAL_PROVIDER_NAME = os.getenv(
    "TWITTER_CREDENTIAL_PROVIDER",
    "x-api-key",
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


def _get_credentials() -> dict:
    """Get Twitter credentials JSON via AgentCore Identity API Key Credential Provider."""
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
        raw = _run_async(_fetch())
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Twitter credentials JSON parse error: {e}. "
            f"provider={CREDENTIAL_PROVIDER_NAME}"
        ) from e
    except Exception as e:
        error_detail = f"{type(e).__name__}: {e}"
        raise RuntimeError(
            f"Twitter認証エラー: {error_detail}. "
            f"provider={CREDENTIAL_PROVIDER_NAME}, region={AWS_REGION}"
        ) from e


def get_read_client() -> tweepy.Client:
    """Build a tweepy Client for read operations (bearer token)."""
    creds = _get_credentials()
    return tweepy.Client(bearer_token=creds["bearer_token"])


def get_write_client() -> tweepy.Client:
    """Build a tweepy Client for write operations (OAuth 1.0a)."""
    creds = _get_credentials()
    return tweepy.Client(
        consumer_key=creds["api_key"],
        consumer_secret=creds["api_secret"],
        access_token=creds["access_token"],
        access_token_secret=creds["access_token_secret"],
    )
