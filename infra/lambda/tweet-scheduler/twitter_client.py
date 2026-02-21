"""Twitter/X API v2 client with SSM Parameter Store credential management."""

import logging

import boto3
import tweepy

logger = logging.getLogger(__name__)

REQUIRED_PARAMS = {
    "api_key", "api_secret", "access_token", "access_token_secret", "bearer_token",
}


class TwitterClient:
    """Twitter/X API v2 client initialized from SSM Parameter Store credentials."""

    def __init__(self, ssm_prefix: str, region: str) -> None:
        """Load credentials from SSM Parameter Store and initialize tweepy Client.

        Args:
            ssm_prefix: SSM parameter prefix (e.g. /tonari/twitter)
            region: AWS region
        """
        ssm = boto3.client("ssm", region_name=region)
        response = ssm.get_parameters_by_path(
            Path=ssm_prefix, WithDecryption=True
        )

        params: dict[str, str] = {}
        for p in response.get("Parameters", []):
            key = p["Name"].rsplit("/", 1)[-1]
            params[key] = p["Value"]

        missing = REQUIRED_PARAMS - params.keys()
        if missing:
            raise ValueError(
                f"Missing SSM parameters under {ssm_prefix}: {sorted(missing)}"
            )

        self._client = tweepy.Client(
            bearer_token=params["bearer_token"],
            consumer_key=params["api_key"],
            consumer_secret=params["api_secret"],
            access_token=params["access_token"],
            access_token_secret=params["access_token_secret"],
        )
        logger.info("TwitterClient initialized successfully")

    @property
    def client(self) -> tweepy.Client:
        """Return the initialized tweepy Client."""
        return self._client

    def __repr__(self) -> str:
        return "TwitterClient(initialized=True)"
