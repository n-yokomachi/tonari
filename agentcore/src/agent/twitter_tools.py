"""Twitter/X tool functions using AgentCore Identity API Key.

Provides @tool-decorated functions for reading and posting tweets,
replacing the previous Lambda/Gateway-based implementation.
"""

import logging
import os
from datetime import datetime, timedelta, timezone

from strands import tool

from .twitter_auth import get_read_client, get_write_client

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))
OWNER_USER_ID = os.getenv("OWNER_TWITTER_USER_ID", "")


@tool
def twitter_get_todays_tweets(user_id: str = "", max_count: int = 3) -> dict:
    """Fetch a user's tweets posted today. Returns tweet text and timestamps.

    Args:
        user_id: Twitter user ID to fetch tweets for. If omitted, uses the owner's ID.
        max_count: Maximum number of tweets to fetch (default: 3).
    """
    target_user_id = user_id or OWNER_USER_ID
    if not target_user_id:
        return {
            "tweets": [],
            "count": 0,
            "message": "user_id is required (OWNER_TWITTER_USER_ID is not set).",
            "error": True,
        }

    try:
        client = get_read_client()
        response = client.get_users_tweets(
            id=target_user_id,
            max_results=5,
            exclude=["retweets", "replies"],
            tweet_fields=["created_at", "text"],
        )

        if not response.data:
            return {
                "tweets": [],
                "count": 0,
                "message": "今日のツイートはありません。",
            }

        today_jst = datetime.now(JST).date()
        today_tweets = []

        for tweet in response.data:
            tweet_date_jst = tweet.created_at.astimezone(JST).date()
            if tweet_date_jst == today_jst:
                today_tweets.append(
                    {
                        "id": str(tweet.id),
                        "text": tweet.text,
                        "created_at": tweet.created_at.isoformat(),
                    }
                )

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

    except Exception as e:
        logger.exception("Failed to fetch tweets from Twitter API")
        return {
            "tweets": [],
            "count": 0,
            "message": f"Twitter API access failed: {e}",
            "error": True,
        }


@tool
def twitter_post_tweet(text: str) -> dict:
    """Post a tweet on behalf of the Tonari account.

    Args:
        text: The tweet text to post (max 280 characters).
    """
    try:
        client = get_write_client()
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

    except Exception as e:
        logger.exception("Failed to post tweet")
        return {
            "tweet_id": None,
            "message": f"Failed to post tweet: {e}",
            "error": True,
        }


TWITTER_TOOLS = [twitter_get_todays_tweets, twitter_post_tweet]
