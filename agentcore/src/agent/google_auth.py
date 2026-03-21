"""Google API authentication via SSM-stored refresh tokens.

Provides access token retrieval and Google API service builders
using refresh tokens stored in AWS SSM Parameter Store.
"""

import json
import logging
import os
import urllib.parse
import urllib.request

import boto3
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")
SSM_PREFIX = "/tonari/google"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

_ssm_client = None


def _get_ssm():
    global _ssm_client
    if _ssm_client is None:
        _ssm_client = boto3.client("ssm", region_name=AWS_REGION)
    return _ssm_client


def _get_ssm_param(name: str) -> str:
    resp = _get_ssm().get_parameter(
        Name=f"{SSM_PREFIX}/{name}", WithDecryption=True
    )
    return resp["Parameter"]["Value"]


def get_access_token() -> str:
    """Get a Google access token using refresh token from SSM."""
    try:
        client_id = _get_ssm_param("client_id")
        client_secret = _get_ssm_param("client_secret")
        refresh_token = _get_ssm_param("refresh_token")
    except Exception as e:
        raise RuntimeError(
            "Google認証情報がSSMに設定されていません。"
            "設定画面から「Google認証を更新」を実行してください。"
        ) from e

    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
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
        raise RuntimeError(
            f"Google認証エラー: トークンの更新に失敗しました。"
            f"設定画面から「Google認証を更新」を実行してください。"
            f" ({error_body})"
        ) from e

    return token_data["access_token"]


def get_calendar_service():
    """Build a Google Calendar API service."""
    token = get_access_token()
    credentials = Credentials(token=token)
    return build("calendar", "v3", credentials=credentials)


def get_gmail_service():
    """Build a Gmail API service."""
    token = get_access_token()
    credentials = Credentials(token=token)
    return build("gmail", "v1", credentials=credentials)
