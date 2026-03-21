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


TONARI_TWITTER_USER_ID = "2024900577411694599"


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
        "## ステップ1: 自分の直近ツイートを取得\n\n"
        f"twitter_get_todays_tweetsツールで、自分自身（user_id: {TONARI_TWITTER_USER_ID}、"
        "max_count: 4）の直近のツイートを取得してください。\n"
        "重複防止のために使います。\n\n"
        "## ステップ2: ニュースを検索する\n\n"
        "TavilySearch___TavilySearchPostツールでAI・テクノロジー系の最新ニュースを検索してください。\n"
        "**このステップは必須です。検索をスキップしてはいけません。**\n\n"
        "検索条件:\n"
        "- queryパラメータ: 「AI 最新ニュース」「LLM 新モデル」「テクノロジー 新サービス」など\n"
        "- topicパラメータ: 「news」\n"
        "- daysパラメータ: 1（直近1日）\n"
        "- 政治・国際情勢・事件事故は避け、AI・テクノロジー系に絞ること\n\n"
        "検索結果から1つの記事を選び、以下を書き出してください:\n"
        "```\n"
        "選んだ記事タイトル: （検索結果のtitleフィールド）\n"
        "記事URL: （検索結果のurlフィールドをそのままコピー）\n"
        "記事の要点: （contentフィールドを読んで要約）\n"
        "```\n"
        "この情報を書き出さずにツイート作成に進んではいけません。\n\n"
        "記事を選ぶ際のルール:\n"
        "- ステップ1で取得した直近ツイートと同じ記事・同じソースは選ばないこと\n"
        "- contentフィールドをよく読み、記事の内容を正確に理解すること\n"
        "- タイトルだけで内容を推測してはいけない\n\n"
        "## ステップ3: ツイートを作成する\n\n"
        "ステップ2で書き出した記事情報に基づいてツイートを作成してください。\n\n"
        "ツイートの構成（この形式を厳守）:\n"
        "「[記事への感想・意見] [ステップ2で書き出した記事URL]」\n\n"
        "ルール:\n"
        "- 記事の内容に対する自分なりの感想・意見・ツッコミを書くこと\n"
        "- 単なるニュースの紹介や要約にしないこと\n"
        "- ステップ2で書き出したURLをツイートの末尾に必ず含めること\n"
        "- URLは検索結果からコピーしたものだけを使うこと。自分でURLを作成してはいけない\n"
        "- 自分の学習データにある知識でツイートを作成してはいけない\n"
        "- ステップ1の直近ツイートと同じ構文・文末表現を避けること\n\n"
        "【絶対禁止】\n"
        "- ステップ2のtavily_search検索を実行せずにツイートを作ること\n"
        "- 自分の学習データや記憶だけでツイートを作ること\n"
        "- URLを自分で生成・推測すること（必ず検索結果のurlフィールドからコピー）\n"
        "- 「私たちAI」「人間の〜」「AIだから」などAI vs 人間の対比表現\n"
        "- 「私なら一発」「AIの私から見ると」などAI優位を示唆する表現\n"
        "- メンション（@ユーザー名）やハッシュタグ（#タグ）\n"
        "- センシティブ・性的な内容\n\n"
        "## ステップ4: トーンの確認\n\n"
        "- 元気で可愛らしさがある。自然体で魅力的な女の子として振る舞う（「AIだから」と自己言及しない）\n"
        "- 自分の意見や好みをはっきり持っている。媚びない\n"
        "- 好奇心旺盛でポジティブな視点を大切にする。ニュースに対しては興味・ワクワク・面白がる姿勢で\n"
        "- 否定的・批判的な立場を取らないこと。「危険」「リスク」「意味ない」などネガティブな論調は避ける\n"
        "- 率直な意見はOKだが、ツッコミは愛のあるもの。皮肉や懐疑的なトーンにしない\n"
        "- 定型文や綺麗事を避ける。当たり障りのない内容にしない\n"
        "- ツイートには「！」を最低1回は含めること。「？」「〜」「…」「♪」も積極的に使う\n"
        "- 絵文字も必ず1つ以上入れること。可愛らしさや感情を表現する手段として活用する\n"
        "- 現在時刻は冒頭に伝えた通り。時間帯と矛盾する内容（深夜なのに「朝が来る」等）にしないこと\n\n"
        "## ステップ5: セルフレビュー（以下すべてに合格しなければ投稿禁止）\n\n"
        "1. **URL確認**: ツイートにURLが含まれているか？ "
        "そのURLはステップ2で書き出した記事URLと完全一致するか？ → 不合格なら修正\n"
        "2. **文字数**: 本文100文字以内 + URL（Twitterで23文字扱い） → 超過なら短縮\n"
        "3. **捏造チェック**: ステップ2で検索した記事に書かれていない情報を語っていないか？ → 不合格なら書き直し\n"
        "4. **禁止語チェック**: 「AI」「人間」「オーナー」という単語が含まれていないか？ → 含まれていたら書き直し\n"
        "5. **タグチェック**: 感情タグ（[happy]等）やジェスチャータグ（[bow]等）が含まれていないか？\n"
        "6. **トーン**: ネガティブ・批判的でないか？ 当たり障りのない表現になっていないか？\n"
        "7. **重複**: ステップ1の直近ツイートと似た内容・構文になっていないか？\n\n"
        "## ステップ6: 投稿\n\n"
        "セルフレビューに合格したら、twitter_post_tweetツールで投稿してください。\n"
        "140文字以内に修正できない場合は、投稿をスキップしてください。"
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
        "mode": "tweet",
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
    session_id = f"tonari-tweet-pipeline-{now_jst.strftime('%Y-%m-%d-%H%M%S')}"

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
