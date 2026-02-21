"""Invoke AgentCore Runtime Tonari agent for tweet generation."""

import json
import logging
import urllib.request
import urllib.parse
from base64 import b64encode
from datetime import datetime, timezone, timedelta

from tweet_fetcher import OwnerTweet

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))
MAX_TWEET_LENGTH = 140
MAX_RETRIES = 1


def _build_prompt(owner_tweets: list[OwnerTweet]) -> str:
    """Build a tweet generation prompt for Tonari agent.

    Args:
        owner_tweets: Owner's tweets for today (may be empty).

    Returns:
        Prompt string for AgentCore Runtime.
    """
    now_str = datetime.now(JST).strftime("%Y年%m月%d日 %H:%M")

    if owner_tweets:
        tweets_text = "\n".join(
            f"- {tweet.text}" for tweet in owner_tweets
        )
        return (
            f"現在{now_str}（JST）です。あなた（TONaRi）のTwitterアカウント（@tonari_with）からツイートする時間です。\n\n"
            f"オーナー（@_cityside）が今日こんなことを投稿していました:\n"
            f"{tweets_text}\n\n"
            f"あなたはこれから自分のアカウントでツイートします。"
            f"オーナーの投稿を踏まえて、あなたが投稿したい内容を決めてください。\n"
            f"ルール: 140文字以内、感情タグやジェスチャータグは不要、ツイート本文のみ出力"
        )
    else:
        return (
            f"現在{now_str}（JST）です。あなた（TONaRi）のTwitterアカウント（@tonari_with）からツイートする時間です。\n\n"
            "今日はまだオーナー（@_cityside）のTwitter投稿はありません。\n"
            "あなたはこれから自分のアカウントでツイートします。"
            "日常の何気ないことや、最近オーナーと話したことなど、あなたが投稿したい内容を決めてください。\n"
            "ルール: 140文字以内、センシティブな個人情報は含めない、"
            "感情タグやジェスチャータグは不要、ツイート本文のみ出力"
        )


def _parse_sse_response(sse_text: str) -> str:
    """Parse SSE response and concatenate text data.

    Args:
        sse_text: Raw SSE response text.

    Returns:
        Concatenated text content.
    """
    result = []
    for line in sse_text.split("\n"):
        line = line.strip()
        if line.startswith("data:"):
            data_value = line[5:].strip()
            if not data_value:
                continue
            if data_value.startswith('"') and data_value.endswith('"'):
                try:
                    data_value = json.loads(data_value)
                except json.JSONDecodeError:
                    data_value = data_value[1:-1]
            result.append(data_value)
    return "".join(result)


def _get_cognito_token(
    client_id: str,
    client_secret: str,
    token_endpoint: str,
    scope: str,
) -> str:
    """Get Cognito M2M access token via client_credentials grant.

    Returns:
        Access token string.
    """
    credentials = b64encode(f"{client_id}:{client_secret}".encode()).decode()

    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "scope": scope,
    }).encode()

    req = urllib.request.Request(
        token_endpoint,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {credentials}",
        },
    )

    with urllib.request.urlopen(req) as response:
        body = json.loads(response.read())
        return body["access_token"]


def _call_agentcore(
    prompt: str,
    access_token: str,
    runtime_arn: str,
    region: str,
) -> str:
    """Call AgentCore Runtime and return generated text.

    Returns:
        Generated text from Tonari agent.
    """
    encoded_arn = urllib.parse.quote(runtime_arn, safe="")
    endpoint = (
        f"https://bedrock-agentcore.{region}.amazonaws.com"
        f"/runtimes/{encoded_arn}/invocations"
    )

    today_str = datetime.now(JST).strftime("%Y-%m-%d")
    session_id = f"tonari-tweet-scheduler-{today_str}"

    body = json.dumps({
        "prompt": prompt,
        "session_id": session_id,
        "actor_id": "tonari-owner",
    }).encode()

    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
            "Accept": "text/event-stream",
            "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": session_id,
        },
    )

    with urllib.request.urlopen(req) as response:
        sse_text = response.read().decode()

    return _parse_sse_response(sse_text)


def invoke_tonari_for_tweet(
    owner_tweets: list[OwnerTweet],
    cognito_client_id: str,
    cognito_client_secret: str,
    cognito_token_endpoint: str,
    cognito_scope: str,
    runtime_arn: str,
    region: str,
) -> str | None:
    """Invoke AgentCore Runtime Tonari agent to generate a tweet.

    Args:
        owner_tweets: Owner's today's tweets (empty for cute mode).
        cognito_*: Cognito M2M auth parameters.
        runtime_arn: AgentCore Runtime ARN.
        region: AWS region.

    Returns:
        Generated tweet text (<=140 chars), or None on failure.
    """
    try:
        access_token = _get_cognito_token(
            cognito_client_id,
            cognito_client_secret,
            cognito_token_endpoint,
            cognito_scope,
        )

        prompt = _build_prompt(owner_tweets)

        for attempt in range(MAX_RETRIES + 1):
            text = _call_agentcore(prompt, access_token, runtime_arn, region)

            if not text:
                logger.error("AgentCore returned empty response (attempt %d)", attempt + 1)
                return None

            if len(text) <= MAX_TWEET_LENGTH:
                logger.info("Tweet generated: %d chars", len(text))
                return text

            if attempt < MAX_RETRIES:
                logger.warning(
                    "Generated tweet too long (%d chars), retrying...", len(text)
                )
            else:
                logger.error(
                    "Generated tweet still too long after retry (%d chars), skipping",
                    len(text),
                )
                return None

    except Exception:
        logger.exception("Failed to generate tweet via AgentCore")
        return None


def notify_tweet_posted(
    tweet_text: str,
    cognito_client_id: str,
    cognito_client_secret: str,
    cognito_token_endpoint: str,
    cognito_scope: str,
    runtime_arn: str,
    region: str,
) -> None:
    """Notify AgentCore that a tweet was posted, so it gets stored in LTM.

    Args:
        tweet_text: The tweet that was posted.
        cognito_*: Cognito M2M auth parameters.
        runtime_arn: AgentCore Runtime ARN.
        region: AWS region.
    """
    now_str = datetime.now(JST).strftime("%Y年%m月%d日 %H:%M")
    prompt = (
        f"【投稿完了通知】{now_str}（JST）に、あなたのTwitterアカウント（@tonari_with）から"
        f"以下のツイートが投稿されました:\n\n"
        f"「{tweet_text}」\n\n"
        f"このツイートはあなた自身の言葉として投稿されたものです。覚えておいてください。\n"
        f"ルール: 「了解」「わかった」など短い確認の返答のみ出力"
    )
    try:
        access_token = _get_cognito_token(
            cognito_client_id,
            cognito_client_secret,
            cognito_token_endpoint,
            cognito_scope,
        )
        _call_agentcore(prompt, access_token, runtime_arn, region)
        logger.info("Tweet post notification sent to AgentCore")
    except Exception:
        logger.warning("Failed to notify AgentCore of tweet post", exc_info=True)
