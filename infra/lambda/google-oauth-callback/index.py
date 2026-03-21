"""Google OAuth Callback Lambda

AgentCore Identity の OAuth2 フローを完了する。
Vercel の google-auth-callback API から M2M 認証付きで呼び出される。
"""

import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")


def _response(status_code, body):
    """API Gateway proxy integration response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event, context):
    """Complete OAuth2 resource token auth via AgentCore Identity."""
    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        body = {}

    session_uri = body.get("session_uri", "")
    if not session_uri:
        return _response(400, {"success": False, "message": "session_uri is required"})

    try:
        client = boto3.client("bedrock-agentcore", region_name=AWS_REGION)
        client.complete_resource_token_auth(
            sessionUri=session_uri,
            userIdentifier={"userId": "tonari-owner"},
        )
        logger.info("CompleteResourceTokenAuth succeeded for session: %s", session_uri)
        return _response(200, {"success": True})
    except Exception as e:
        logger.exception("CompleteResourceTokenAuth failed")
        return _response(500, {"success": False, "message": str(e)})
