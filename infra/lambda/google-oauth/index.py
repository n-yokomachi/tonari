"""
Google OAuth2 Lambda

Handles OAuth2 authorization flow for Google Calendar and Gmail APIs.
Reads/writes credentials from/to AWS SSM Parameter Store.

Actions:
- get_auth_url: Generate Google OAuth2 authorization URL
- exchange_code: Exchange authorization code for tokens and store refresh_token in SSM
- check_status: Check if Google OAuth credentials are configured
"""

import json
import logging
import urllib.request
import urllib.parse

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SSM_PREFIX = "/tonari/google"
AWS_REGION = "ap-northeast-1"
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
]


def _response(status_code, body):
    """API Gateway proxy integration response format."""
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


def _get_ssm_param(ssm, name):
    """Get a parameter from SSM Parameter Store."""
    resp = ssm.get_parameter(Name=f"{SSM_PREFIX}/{name}", WithDecryption=True)
    return resp["Parameter"]["Value"]


def _put_ssm_param(ssm, name, value):
    """Put a parameter to SSM Parameter Store."""
    ssm.put_parameter(
        Name=f"{SSM_PREFIX}/{name}",
        Value=value,
        Type="SecureString",
        Overwrite=True,
    )


def handler(event, context):
    """Dispatch to appropriate action."""
    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        body = {}

    action = body.get("action", "")

    try:
        if action == "get_auth_url":
            return get_auth_url(body)
        elif action == "exchange_code":
            return exchange_code(body)
        elif action == "check_status":
            return check_status()
        else:
            return _response(400, {"success": False, "message": f"Unknown action: {action}"})
    except Exception as e:
        logger.exception("Google OAuth error")
        return _response(500, {"success": False, "message": str(e)})


def get_auth_url(body):
    """Generate Google OAuth2 authorization URL."""
    redirect_uri = body.get("redirect_uri", "")
    if not redirect_uri:
        return _response(400, {"success": False, "message": "redirect_uri is required"})

    ssm = boto3.client("ssm", region_name=AWS_REGION)
    client_id = _get_ssm_param(ssm, "client_id")

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }

    auth_url = f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"

    return _response(200, {"success": True, "auth_url": auth_url})


def exchange_code(body):
    """Exchange authorization code for tokens and store in SSM."""
    code = body.get("code", "")
    redirect_uri = body.get("redirect_uri", "")

    if not code:
        return _response(400, {"success": False, "message": "code is required"})
    if not redirect_uri:
        return _response(400, {"success": False, "message": "redirect_uri is required"})

    ssm = boto3.client("ssm", region_name=AWS_REGION)
    client_id = _get_ssm_param(ssm, "client_id")
    client_secret = _get_ssm_param(ssm, "client_secret")

    # Exchange code for tokens
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode("utf-8")

    req = urllib.request.Request(
        GOOGLE_TOKEN_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    try:
        with urllib.request.urlopen(req) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        logger.error(f"Token exchange failed: {e.code} {error_body}")
        return _response(500, {"success": False, "message": f"Token exchange failed: {error_body}"})

    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        return _response(500, {
            "success": False,
            "message": "No refresh_token in response. Try revoking access and re-authorizing.",
        })

    # Store refresh_token in SSM
    _put_ssm_param(ssm, "refresh_token", refresh_token)
    logger.info("Refresh token updated in SSM")

    return _response(200, {"success": True, "message": "Google OAuth credentials updated successfully"})


def check_status():
    """Check if Google OAuth credentials are configured in SSM."""
    ssm = boto3.client("ssm", region_name=AWS_REGION)

    status = {"client_id": False, "client_secret": False, "refresh_token": False}

    for key in status:
        try:
            _get_ssm_param(ssm, key)
            status[key] = True
        except Exception:
            pass

    all_configured = all(status.values())

    return _response(200, {
        "success": True,
        "configured": all_configured,
        "status": status,
    })
