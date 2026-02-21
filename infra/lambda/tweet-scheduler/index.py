"""Lambda handler for scheduled tweet auto-posting pipeline."""

import logging
import os

import boto3

from twitter_client import TwitterClient
from tweet_fetcher import fetch_owner_tweets
from agentcore_invoker import invoke_tonari_for_tweet
from tweet_poster import post_tweet

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _get_ssm_parameter(name: str, region: str) -> str:
    """Get a SecureString parameter from SSM Parameter Store."""
    ssm = boto3.client("ssm", region_name=region)
    response = ssm.get_parameter(Name=name, WithDecryption=True)
    return response["Parameter"]["Value"]


def handler(event: dict, context) -> dict:
    """Tweet auto-posting pipeline: fetch → generate → post."""
    logger.info("Tweet scheduler started")

    # Load configuration from environment variables
    owner_user_id = os.environ["OWNER_TWITTER_USER_ID"]
    ssm_prefix = os.environ["SSM_TWITTER_PREFIX"]
    region = os.environ.get("AGENTCORE_REGION", "ap-northeast-1")
    runtime_arn = os.environ["AGENTCORE_RUNTIME_ARN"]
    cognito_endpoint = os.environ["COGNITO_TOKEN_ENDPOINT"]
    cognito_client_id = os.environ["COGNITO_CLIENT_ID"]
    cognito_scope = os.environ["COGNITO_SCOPE"]

    # Load Cognito Client Secret from SSM Parameter Store
    ssm_cognito_secret = os.environ["SSM_COGNITO_CLIENT_SECRET"]
    cognito_client_secret = _get_ssm_parameter(ssm_cognito_secret, region)

    # Step 1: Initialize Twitter client
    try:
        twitter = TwitterClient(ssm_prefix=ssm_prefix, region=region)
    except Exception:
        logger.exception("Failed to initialize TwitterClient")
        return {"statusCode": 500, "body": "TwitterClient initialization failed"}

    # Step 2: Fetch owner's tweets
    owner_tweets = fetch_owner_tweets(twitter.client, owner_user_id)
    logger.info("Fetched %d owner tweets", len(owner_tweets))

    # Step 3: Generate tweet via AgentCore
    generated_text = invoke_tonari_for_tweet(
        owner_tweets=owner_tweets,
        cognito_client_id=cognito_client_id,
        cognito_client_secret=cognito_client_secret,
        cognito_token_endpoint=cognito_endpoint,
        cognito_scope=cognito_scope,
        runtime_arn=runtime_arn,
        region=region,
    )

    if not generated_text:
        logger.error("Tweet generation failed or skipped")
        return {"statusCode": 200, "body": "Tweet generation skipped"}

    # Step 4: Post tweet
    tweet_id = post_tweet(twitter.client, generated_text)

    if tweet_id:
        logger.info("Pipeline completed: tweet_id=%s", tweet_id)
        return {"statusCode": 200, "body": f"Tweet posted: {tweet_id}"}
    else:
        logger.error("Tweet posting failed")
        return {"statusCode": 200, "body": "Tweet posting failed"}
