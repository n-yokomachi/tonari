"""Fetch owner's today's tweets via Twitter API v2 (AgentCore Gateway tool)."""

import logging
from datetime import datetime, timezone, timedelta

import boto3
import tweepy

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))
SSM_BEARER_TOKEN_KEY = "/tonari/twitter/bearer_token"


def handler(event, context):
    """Fetch owner's today's tweets.

    Args:
        event: {owner_user_id: str, max_count?: int}

    Returns:
        {tweets: list, count: int, message: str} or error response.
    """
    owner_user_id = event.get("owner_user_id", "")
    max_count = int(event.get("max_count", 3))

    try:
        ssm = boto3.client("ssm")
        bearer_token = ssm.get_parameter(
            Name=SSM_BEARER_TOKEN_KEY, WithDecryption=True
        )["Parameter"]["Value"]
    except Exception:
        logger.exception("Failed to get bearer token from SSM")
        return {
            "tweets": [],
            "count": 0,
            "message": "SSM Parameter Store access failed",
            "error": True,
        }

    try:
        client = tweepy.Client(bearer_token=bearer_token)
        response = client.get_users_tweets(
            id=owner_user_id,
            max_results=5,
            exclude=["retweets", "replies"],
            tweet_fields=["created_at", "text"],
        )

        if not response.data:
            return {
                "tweets": [],
                "count": 0,
                "message": "No tweets found today",
            }

        today_jst = datetime.now(JST).date()
        today_tweets = []

        for tweet in response.data:
            tweet_date_jst = tweet.created_at.astimezone(JST).date()
            if tweet_date_jst == today_jst:
                today_tweets.append({
                    "id": str(tweet.id),
                    "text": tweet.text,
                    "created_at": tweet.created_at.isoformat(),
                })

        result = today_tweets[:max_count]
        count = len(result)
        message = (
            f"{count}件のツイートが見つかりました。"
            if count > 0
            else "今日のツイートはありません。"
        )

        return {
            "tweets": result,
            "count": count,
            "message": message,
        }

    except Exception:
        logger.exception("Failed to fetch tweets from Twitter API")
        return {
            "tweets": [],
            "count": 0,
            "message": "Twitter API access failed",
            "error": True,
        }
