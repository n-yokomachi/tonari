"""Fetch owner's recent tweets from Twitter/X API v2."""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta

import tweepy

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


@dataclass
class OwnerTweet:
    """Owner tweet data."""

    id: str
    text: str
    created_at: str


def fetch_owner_tweets(
    client: tweepy.Client,
    owner_user_id: str,
    max_count: int = 3,
) -> list[OwnerTweet]:
    """Fetch today's tweets from the owner's account.

    Returns:
        List of today's tweets (up to max_count). Empty list on failure.
    """
    try:
        response = client.get_users_tweets(
            id=owner_user_id,
            max_results=5,
            exclude=["retweets", "replies"],
            tweet_fields=["created_at", "text"],
        )

        if not response.data:
            logger.info("No tweets found for owner %s", owner_user_id)
            return []

        today_jst = datetime.now(JST).date()
        today_tweets: list[OwnerTweet] = []

        for tweet in response.data:
            tweet_date_jst = tweet.created_at.astimezone(JST).date()
            if tweet_date_jst == today_jst:
                today_tweets.append(
                    OwnerTweet(
                        id=str(tweet.id),
                        text=tweet.text,
                        created_at=tweet.created_at.isoformat(),
                    )
                )

        result = today_tweets[:max_count]
        logger.info(
            "Fetched %d today's tweets for owner %s", len(result), owner_user_id
        )
        return result

    except Exception:
        logger.exception("Failed to fetch tweets for owner %s", owner_user_id)
        return []
