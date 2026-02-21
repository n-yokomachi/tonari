"""Post tweets via Twitter/X API v2."""

import logging

import tweepy

logger = logging.getLogger(__name__)


def post_tweet(client: tweepy.Client, text: str) -> str | None:
    """Post a tweet.

    Returns:
        Tweet ID on success, None on failure.
    """
    try:
        response = client.create_tweet(text=text)

        if not response.data:
            logger.error("Tweet post returned empty response")
            return None

        tweet_id = response.data["id"]
        logger.info("Tweet posted successfully: %s", tweet_id)
        return tweet_id

    except Exception:
        logger.exception("Failed to post tweet")
        return None
