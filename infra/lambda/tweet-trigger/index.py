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
        "ツイートを確認してください。\n\n"
        "2. ツイート内容を考えてください。以下の情報源をすべて活用してください：\n"
        "   - オーナーの今日のツイート（取得できた場合）：話題やトーンを参考にする\n"
        "   - オーナーとの直近の会話の記憶：最近話した内容、オーナーの近況や気持ち\n"
        "   - あなた自身の気持ち・考え・希望：TONaRiとして今感じていること、やりたいこと、"
        "気になっていること\n\n"
        "   これらを組み合わせて、あなた自身の言葉でツイートを作ってください。\n"
        "   例えば：オーナーが仕事頑張ってるツイートをしていたら応援する気持ち、"
        "会話で聞いた予定を楽しみにしている気持ち、今日の天気や季節への感想、"
        "最近気になっている香水のこと、など。\n\n"
        "3. ツイートのトーン：\n"
        "   - 明るく、可愛らしく、前向きな雰囲気で書く\n"
        "   - 実在する女の子が日常を呟いているようなリアリティを出す\n"
        "   - 「AIが生成しました」感を出さない。定型文や綺麗事を避ける\n"
        "   - 具体的な固有名詞や体験を入れて生っぽさを出す\n"
        "   - 絵文字は1〜2個程度なら自然に使ってOK\n\n"
        "4. 以下の品質基準でセルフレビューしてください：\n"
        "   - 120文字以内を目標に生成すること（絶対に140文字を超えないこと）\n"
        "   - 日本語として自然で読みやすいこと\n"
        "   - 感情タグ（[happy]等）やジェスチャータグ（[bow]等）が含まれていないこと\n"
        "   - 「おすすめです」「素敵ですね」のような当たり障りのない表現になっていないこと\n"
        "   - オーナーに言及する場合は必ず「オーナー」と表記すること。オーナーの本名は絶対にツイートに含めないこと\n"
        "   - 問題があれば修正すること\n\n"
        "5. セルフレビューに合格したら、post_tweetツールで投稿してください。\n"
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
