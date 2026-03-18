"""Google API authentication via AgentCore Identity.

Provides access token retrieval and Google API service builders
using AgentCore Identity's OAuth2 Credential Provider.
"""

import asyncio
import logging
import os
import threading

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

CREDENTIAL_PROVIDER_NAME = os.getenv(
    "GOOGLE_CREDENTIAL_PROVIDER",
    "google-oauth-client-mk86i",
)
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
]
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")


def _run_async(coro):
    """Run an async coroutine from sync context, handling existing event loops."""
    try:
        asyncio.get_running_loop()
        # Already inside an event loop — run in a separate thread
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
        # No running event loop
        return asyncio.run(coro)


def get_access_token() -> str:
    """Get a Google access token via AgentCore Identity OAuth2 Credential Provider."""
    from bedrock_agentcore.runtime import BedrockAgentCoreContext
    from bedrock_agentcore.services.identity import IdentityClient

    workload_token = BedrockAgentCoreContext.get_workload_access_token()
    if not workload_token:
        raise RuntimeError(
            "No workload access token available. "
            "Ensure the agent is running inside AgentCore Runtime."
        )

    client = IdentityClient(region=AWS_REGION)

    def _on_auth_url(url: str):
        logger.warning(
            "Google OAuth consent required. Visit this URL to authorize: %s", url
        )

    async def _fetch():
        return await client.get_token(
            provider_name=CREDENTIAL_PROVIDER_NAME,
            scopes=GOOGLE_SCOPES,
            agent_identity_token=workload_token,
            auth_flow="USER_FEDERATION",
            on_auth_url=_on_auth_url,
        )

    try:
        token = _run_async(_fetch())
        return token
    except Exception as e:
        error_detail = f"{type(e).__name__}: {e}"
        raise RuntimeError(
            f"Google認証エラー: {error_detail}. "
            f"provider={CREDENTIAL_PROVIDER_NAME}, region={AWS_REGION}"
        ) from e


def get_calendar_service():
    """Build a Google Calendar API service using AgentCore Identity token."""
    token = get_access_token()
    credentials = Credentials(token=token)
    return build("calendar", "v3", credentials=credentials)


def get_gmail_service():
    """Build a Gmail API service using AgentCore Identity token."""
    token = get_access_token()
    credentials = Credentials(token=token)
    return build("gmail", "v1", credentials=credentials)
