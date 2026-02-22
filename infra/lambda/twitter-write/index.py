"""Post a tweet via Twitter API v2 with OAuth 1.0a (AgentCore Gateway tool)."""

import logging

import boto3
import tweepy

logger = logging.getLogger(__name__)

SSM_PATH = "/tonari/twitter/"
REQUIRED_KEYS = {"api_key", "api_secret", "access_token", "access_token_secret"}


def handler(event, context):
    """Post a tweet on behalf of the Tonari account.

    Args:
        event: {text: str}

    Returns:
        {tweet_id: str, message: str} or error response.
    """
    text = event.get("text", "")

    try:
        ssm = boto3.client("ssm")
        response = ssm.get_parameters_by_path(
            Path=SSM_PATH, WithDecryption=True
        )
    except Exception:
        logger.exception("Failed to get credentials from SSM")
        return {
            "tweet_id": None,
            "message": "SSM Parameter Store access failed",
            "error": True,
        }

    creds = {}
    for param in response.get("Parameters", []):
        key = param["Name"].rsplit("/", 1)[-1]
        creds[key] = param["Value"]

    missing = REQUIRED_KEYS - set(creds.keys())
    if missing:
        logger.error("Missing credentials: %s", missing)
        return {
            "tweet_id": None,
            "message": f"Missing required credentials: {', '.join(sorted(missing))}",
            "error": True,
        }

    try:
        client = tweepy.Client(
            consumer_key=creds["api_key"],
            consumer_secret=creds["api_secret"],
            access_token=creds["access_token"],
            access_token_secret=creds["access_token_secret"],
        )

        result = client.create_tweet(text=text)

        if not result.data:
            logger.error("Empty response from Twitter API")
            return {
                "tweet_id": None,
                "message": "Twitter API returned empty response",
                "error": True,
            }

        tweet_id = str(result.data["id"])
        return {
            "tweet_id": tweet_id,
            "message": f"Tweet posted successfully (ID: {tweet_id})",
        }

    except Exception:
        logger.exception("Failed to post tweet")
        return {
            "tweet_id": None,
            "message": "Failed to post tweet",
            "error": True,
        }
