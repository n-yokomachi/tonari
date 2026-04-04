"""Twitter/X API authentication via SSM-stored credentials.

Provides credential retrieval and tweepy client builders
using credentials stored in AWS SSM Parameter Store.
"""

import logging
import os

import boto3
import tweepy

logger = logging.getLogger(__name__)

AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")
SSM_PREFIX = "/tonari/twitter"

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


def get_read_client() -> tweepy.Client:
    """Build a tweepy Client for read operations (bearer token)."""
    bearer_token = _get_ssm_param("bearer_token")
    return tweepy.Client(bearer_token=bearer_token)


def get_write_client() -> tweepy.Client:
    """Build a tweepy Client for write operations (OAuth 1.0a)."""
    return tweepy.Client(
        consumer_key=_get_ssm_param("api_key"),
        consumer_secret=_get_ssm_param("api_secret"),
        access_token=_get_ssm_param("access_token"),
        access_token_secret=_get_ssm_param("access_token_secret"),
    )
