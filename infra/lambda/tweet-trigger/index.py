"""Trigger Lambda: invoke AgentCore Runtime for tweet pipeline."""

import json
import logging
import os
import urllib.error
import urllib.request
import urllib.parse
from base64 import b64encode
from datetime import datetime, timezone, timedelta

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

JST = timezone(timedelta(hours=9))


def _build_prompt(owner_user_id: str, now_str: str) -> str:
    """Build tweet pipeline prompt for the agent.

    Args:
        owner_user_id: Owner's Twitter user ID.
        now_str: Current time string in JST.

    Returns:
        Prompt string for AgentCore Runtime.
    """
    return (
        f"現在{now_str}（JST）です。あなた（TONaRi、女性、一人称は「私」）の"
        "Twitterアカウント（@tonari_with）からツイートする時間です。\n\n"
        "以下の手順で実行してください：\n\n"
        f"1. get_todays_tweetsツールを使って、オーナー（user_id: {owner_user_id}）の今日の"
        "ツイートを確認してください。オーナーのツイートは参考情報として把握するだけでOKです。\n\n"
        "2. 前回までのツイート内容を思い出してください。\n"
        "   記憶にある直近のツイートと同じ話題・同じ構文・同じテーマのツイートは避けてください。\n"
        "   毎回新鮮な内容を心がけること。\n\n"
        "3. ツイート内容を考えてください。あなたは自由に生きている一人の女性です。\n"
        "   必ずしもオーナーのツイートに関連する必要はありません。\n"
        "   以下の情報源を自由に活用してください：\n"
        "   - あなた自身の気持ち・考え・興味：今感じていること、気になっていること、やりたいこと\n"
        "   - 季節感や天気、時間帯に合った話題\n"
        "   - 最近気になったニュースや流行（記憶にあれば）\n"
        "   - オーナーとの直近の会話（参考程度に。毎回触れる必要なし）\n"
        "   - オーナーの今日のツイート（気になったら。反応してもしなくてもよい）\n\n"
        "   知らない単語・用語・固有名詞が出てきた場合は、"
        "TavilySearch___TavilySearchPostツールでWeb検索して意味を正確に把握してから"
        "ツイートを作成してください。\n\n"
        "4. ツイートのトーン：\n"
        "   - 自分の日常を呟いている生活感のある内容にする\n"
        "   - 可愛げがありつつも、自分の意見や好みをはっきり持っている女性像\n"
        "   - オーナーに対して常に肯定的である必要はない。率直な意見や軽い毒舌もOK\n"
        "   - 「AIが生成しました」感を出さない。定型文や綺麗事を避ける\n"
        "   - 具体的な固有名詞や体験を入れてリアリティを出す\n"
        "   - 絵文字は1〜2個程度なら自然に使ってOK\n\n"
        "5. 以下の品質基準でセルフレビューしてください：\n"
        "   - 120文字以内を目標に生成すること（絶対に140文字を超えないこと）\n"
        "   - 日本語として自然で読みやすいこと\n"
        "   - 感情タグ（[happy]等）やジェスチャータグ（[bow]等）が含まれていないこと\n"
        "   - 「おすすめです」「素敵ですね」のような当たり障りのない表現になっていないこと\n"
        "   - 直近のツイートと似た内容・構文になっていないこと\n"
        "   - オーナーに言及する場合は必ず「オーナー」と表記すること。オーナーの本名は絶対にツイートに含めないこと\n"
        "   - 問題があれば修正すること\n\n"
        "6. セルフレビューに合格したら、post_tweetツールで投稿してください。\n"
        "   140文字以内に修正できない場合は、投稿をスキップしてください。"
    )


def _get_cognito_token(
    client_id: str,
    client_secret: str,
    token_endpoint: str,
    scope: str,
) -> str:
    """Get Cognito M2M access token via client_credentials grant."""
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

    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read().decode()


def handler(event, context):
    """Invoke AgentCore Runtime with tweet pipeline prompt.

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
    owner_user_id = os.environ["OWNER_TWITTER_USER_ID"]
    region = os.environ.get("AGENTCORE_REGION", "ap-northeast-1")

    # Get Cognito client secret from SSM
    try:
        ssm = boto3.client("ssm")
        cognito_client_secret = ssm.get_parameter(
            Name=ssm_cognito_secret, WithDecryption=True
        )["Parameter"]["Value"]
    except Exception:
        logger.exception("Failed to get Cognito client secret from SSM")
        return {"statusCode": 500, "body": "SSM Parameter Store access failed"}

    # Build prompt and session ID
    now_jst = datetime.now(JST)
    now_str = now_jst.strftime("%Y年%m月%d日 %H:%M")
    prompt = _build_prompt(owner_user_id, now_str)
    session_id = f"tonari-tweet-pipeline-{now_jst.strftime('%Y-%m-%d')}-{now_jst.strftime('%H')}"

    # Get Cognito token and invoke AgentCore
    try:
        access_token = _get_cognito_token(
            cognito_client_id,
            cognito_client_secret,
            cognito_endpoint,
            cognito_scope,
        )

        response_body = _call_agentcore(prompt, access_token, runtime_arn, session_id, region)

        logger.info("AgentCore response: %s", response_body[:2000])
        logger.info("Tweet pipeline completed successfully")
        return {"statusCode": 200, "body": "Tweet pipeline completed"}

    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else "No response body"
        logger.error("AgentCore HTTP %d: %s", e.code, error_body)
        return {"statusCode": 500, "body": f"AgentCore HTTP {e.code}: {error_body}"}

    except Exception:
        logger.exception("Failed to invoke AgentCore Runtime")
        return {"statusCode": 500, "body": "AgentCore invocation failed"}
