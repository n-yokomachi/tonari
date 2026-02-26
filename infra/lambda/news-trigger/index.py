"""News Trigger Lambda: collect news via AgentCore and send notifications."""

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from base64 import b64encode
from datetime import datetime, timedelta, timezone

import boto3
from pywebpush import WebPushException, webpush

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

JST = timezone(timedelta(hours=9))


def _build_news_prompt(now_str: str) -> str:
    """Build news collection prompt for the agent.

    Args:
        now_str: Current time string in JST.

    Returns:
        Prompt string for AgentCore Runtime.
    """
    return (
        f"現在{now_str}（JST）です。定時のニュース収集・配信タスクを実行してください。\n\n"
        "## タスク概要\n"
        "Web検索ツール（TavilySearch）を使って最新ニュースを収集し、"
        "通知用に要約してください。\n\n"
        "## 収集手順\n\n"
        "1. TavilySearchツールを使って、以下のジャンルから最新ニュースを幅広く検索してください：\n"
        "   - テクノロジー・IT\n"
        "   - 経済・ビジネス\n"
        "   - 社会・政治\n"
        "   - エンタメ・カルチャー\n"
        "   - 科学・環境\n"
        "   複数回の検索を行い、各ジャンルから重要なニュースを集めてください。\n\n"
        "2. オーナーの記憶（長期記憶）を参照して、オーナーの興味・関心に合いそうなニュースを"
        "1〜2件ピックアップしてください。これは「TONaRiのおすすめ」として特別に紹介します。\n\n"
        "3. 収集したニュースを以下のフォーマットで出力してください：\n\n"
        "## 出力フォーマット（厳守）\n\n"
        "以下のフォーマットで出力してください。Markdown記法ではなく、"
        "プレーンテキストで読みやすく整形してください。\n\n"
        "---\n"
        "【総合ニュース】\n\n"
        "■ ニュースタイトル1\n"
        "要約（2〜3文）\n"
        "出典: URL\n\n"
        "■ ニュースタイトル2\n"
        "要約（2〜3文）\n"
        "出典: URL\n\n"
        "（3〜5件程度）\n\n"
        "【TONaRiのおすすめ】\n\n"
        "■ ニュースタイトル\n"
        "要約（2〜3文）\n"
        "おすすめ理由: オーナーの○○への関心に関連\n"
        "出典: URL\n\n"
        "（1〜2件）\n"
        "---\n\n"
        "## 注意事項\n"
        "- 感情タグ（[happy]等）やジェスチャータグ（[bow]等）は使用しない\n"
        "- このテキストはメールとプッシュ通知で配信されるため、"
        "プレーンテキストとして読みやすい形式にする\n"
        "- 信頼性の高いソースを優先する\n"
        "- 各ニュースの要約は簡潔に、2〜3文以内にまとめる\n\n"
        "## LTMへの保存\n"
        f"ニュース収集が完了したら、「{now_str}のニュースまとめ」として"
        "要約を長期記憶に保存してください。"
    )


def _get_cognito_token(
    client_id: str,
    client_secret: str,
    token_endpoint: str,
    scope: str,
) -> str:
    """Get Cognito M2M access token via client_credentials grant."""
    credentials = b64encode(f"{client_id}:{client_secret}".encode()).decode()

    data = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "scope": scope,
        }
    ).encode()

    req = urllib.request.Request(
        token_endpoint,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {credentials}",
        },
    )

    with urllib.request.urlopen(req, timeout=30) as response:
        body = json.loads(response.read())
        return body["access_token"]


def _call_agentcore(
    prompt: str,
    access_token: str,
    runtime_arn: str,
    session_id: str,
    region: str = "ap-northeast-1",
) -> str:
    """Call AgentCore Runtime and return response text."""
    encoded_arn = urllib.parse.quote(runtime_arn, safe="")
    endpoint = (
        f"https://bedrock-agentcore.{region}.amazonaws.com"
        f"/runtimes/{encoded_arn}/invocations"
    )

    body = json.dumps(
        {
            "prompt": prompt,
            "session_id": session_id,
            "actor_id": "tonari-owner",
        }
    ).encode()

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

    with urllib.request.urlopen(req, timeout=240) as response:
        return response.read().decode()


def _parse_agentcore_response(response_body: str) -> str:
    """Extract text content from SSE stream response.

    Args:
        response_body: Raw SSE response from AgentCore Runtime.

    Returns:
        Concatenated text content.
    """
    texts = []
    for line in response_body.split("\n"):
        if not line.startswith("data:"):
            continue
        data_str = line[len("data:") :].strip()
        if not data_str:
            continue
        try:
            data = json.loads(data_str)
            if isinstance(data, str):
                texts.append(data)
            elif isinstance(data, dict) and "data" in data:
                inner = data["data"]
                if isinstance(inner, str):
                    texts.append(inner)
        except (json.JSONDecodeError, TypeError):
            pass
    return "".join(texts)


def _publish_to_sns(topic_arn: str, summary: str, now_str: str) -> None:
    """Publish news summary to SNS topic.

    Args:
        topic_arn: SNS Topic ARN.
        summary: News summary text.
        now_str: Current time string for the subject.
    """
    sns_client = boto3.client("sns")
    subject = f"TONaRi ニュースまとめ（{now_str}）"
    # SNS subject max length is 100 characters
    if len(subject) > 100:
        subject = subject[:97] + "..."

    sns_client.publish(
        TopicArn=topic_arn,
        Subject=subject,
        Message=summary,
    )
    logger.info("SNS notification published successfully")


def _send_push_notifications(
    summary: str,
    table_name: str,
    vapid_private_key: str,
    vapid_subject: str,
) -> None:
    """Send Web Push notifications to all registered subscriptions.

    Args:
        summary: News summary text.
        table_name: DynamoDB table name for push subscriptions.
        vapid_private_key: VAPID private key (base64 DER).
        vapid_subject: VAPID subject (mailto: URI).
    """
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)

    # Get all subscriptions
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("userId").eq(
            "tonari-owner"
        )
    )
    items = response.get("Items", [])

    if not items:
        logger.info("No push subscriptions found, skipping Web Push")
        return

    # Prepare push payload
    preview = summary[:100] + "..." if len(summary) > 100 else summary
    payload = json.dumps(
        {
            "title": "TONaRi ニュースまとめ",
            "body": preview,
            "url": "/",
        }
    )

    stale_endpoints = []

    for item in items:
        subscription_info = {
            "endpoint": item["endpoint"],
            "keys": {
                "p256dh": item["p256dh"],
                "auth": item["auth"],
            },
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_subject},
            )
            logger.info("Push sent to endpoint: %s...", item["endpoint"][:50])
        except WebPushException as e:
            if hasattr(e, "response") and e.response is not None:
                status_code = e.response.status_code
                if status_code in (404, 410):
                    logger.info(
                        "Stale subscription (HTTP %d): %s...",
                        status_code,
                        item["endpoint"][:50],
                    )
                    stale_endpoints.append(item["endpoint"])
                    continue
            logger.error("Push failed for %s...: %s", item["endpoint"][:50], e)
        except Exception as e:
            logger.error("Push failed for %s...: %s", item["endpoint"][:50], e)

    # Delete stale subscriptions
    for endpoint in stale_endpoints:
        try:
            table.delete_item(
                Key={"userId": "tonari-owner", "endpoint": endpoint}
            )
            logger.info("Deleted stale subscription: %s...", endpoint[:50])
        except Exception as e:
            logger.error("Failed to delete stale subscription: %s", e)

    logger.info(
        "Push notifications: %d sent, %d stale deleted",
        len(items) - len(stale_endpoints),
        len(stale_endpoints),
    )


def handler(event, context):
    """Collect news via AgentCore and send notifications.

    Args:
        event: EventBridge event (content ignored).
        context: Lambda context.

    Returns:
        {statusCode: int, body: str}
    """
    runtime_arn = os.environ["AGENTCORE_RUNTIME_ARN"]
    cognito_endpoint = os.environ["COGNITO_TOKEN_ENDPOINT"]
    cognito_client_id = os.environ["COGNITO_CLIENT_ID"]
    ssm_cognito_secret = os.environ["SSM_COGNITO_CLIENT_SECRET"]
    cognito_scope = os.environ["COGNITO_SCOPE"]
    region = os.environ.get("AGENTCORE_REGION", "ap-northeast-1")
    sns_topic_arn = os.environ["SNS_TOPIC_ARN"]
    push_table = os.environ["PUSH_SUBSCRIPTIONS_TABLE"]
    ssm_vapid_key = os.environ["SSM_VAPID_PRIVATE_KEY"]
    vapid_subject = os.environ["VAPID_SUBJECT"]

    # Get secrets from SSM
    try:
        ssm = boto3.client("ssm")
        cognito_client_secret = ssm.get_parameter(
            Name=ssm_cognito_secret, WithDecryption=True
        )["Parameter"]["Value"]
    except Exception:
        logger.exception("Failed to get Cognito client secret from SSM")
        return {"statusCode": 500, "body": "SSM access failed (Cognito)"}

    # Build prompt and session ID
    now_jst = datetime.now(JST)
    now_str = now_jst.strftime("%Y年%m月%d日 %H:%M")
    prompt = _build_news_prompt(now_str)
    session_id = (
        f"tonari-news-pipeline-{now_jst.strftime('%Y-%m-%d')}"
        f"-{now_jst.strftime('%H')}"
    )

    # Get Cognito token and invoke AgentCore
    try:
        access_token = _get_cognito_token(
            cognito_client_id,
            cognito_client_secret,
            cognito_endpoint,
            cognito_scope,
        )

        response_body = _call_agentcore(
            prompt, access_token, runtime_arn, session_id, region
        )
        news_summary = _parse_agentcore_response(response_body)

        if not news_summary.strip():
            logger.error("Empty news summary from AgentCore")
            return {"statusCode": 500, "body": "Empty news summary"}

        logger.info(
            "News summary collected: %d chars", len(news_summary)
        )

    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else "No response body"
        logger.error("AgentCore HTTP %d: %s", e.code, error_body)
        return {
            "statusCode": 500,
            "body": f"AgentCore HTTP {e.code}: {error_body}",
        }
    except Exception:
        logger.exception("Failed to invoke AgentCore Runtime")
        return {"statusCode": 500, "body": "AgentCore invocation failed"}

    # Send SNS email notification
    try:
        _publish_to_sns(sns_topic_arn, news_summary, now_str)
    except Exception:
        logger.exception("Failed to publish to SNS")
        # Continue to Web Push even if SNS fails

    # Send Web Push notifications
    try:
        vapid_private_key = ssm.get_parameter(
            Name=ssm_vapid_key, WithDecryption=True
        )["Parameter"]["Value"]

        _send_push_notifications(
            news_summary, push_table, vapid_private_key, vapid_subject
        )
    except Exception:
        logger.exception("Failed to send push notifications")

    logger.info("News pipeline completed successfully")
    return {"statusCode": 200, "body": "News pipeline completed"}
