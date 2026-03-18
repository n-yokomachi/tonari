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
        "## ステップ1: ネタを集める\n\n"
        "以下の2つのツール呼び出しを行ってください：\n\n"
        f"(a) get_todays_tweetsツールで、オーナー（user_id: {owner_user_id}）の"
        "今日のツイートを確認してください。\n"
        "オーナーのツイート内容はオーナーの興味・関心・近況を知る貴重な情報源です。"
        "取得したツイートの要点を簡潔にまとめて言及してください"
        "（例: 「オーナーの最近のツイートを見ました。〇〇について話していますね」）。"
        "これにより、オーナーのツイート内容が長期記憶に保存され、今後の会話に活かせます。\n\n"
        f"(b) get_todays_tweetsツールで、自分自身（user_id: {TONARI_TWITTER_USER_ID}、"
        "max_count: 4）の今日のツイートも取得してください。\n"
        "直近の自分のツイートと同じ話題・構文・テーマのツイートは避けるための参考にします。\n\n"
        "次に、オーナーのツイートの有無に応じてネタ元を決定してください：\n\n"
        "- **オーナーのツイートがあった場合** → そのツイート内容をネタにする\n"
        "- **オーナーのツイートがなかった場合** → TavilySearch___TavilySearchPostツールで"
        "AI・テクノロジー系の最新ニュースを検索してネタにする\n"
        "  検索時はtopicパラメータに「news」、daysパラメータに1を指定して直近1日のニュースに絞ること\n"
        "  検索クエリ例: 「AI 最新ニュース」「LLM 新モデル リリース」「テクノロジー 新サービス」など\n"
        "  政治・国際情勢・事件事故の話題は避け、AI・テクノロジー系に絞ること\n"
        "  古いニュースではなく、今日〜昨日の新鮮な話題を選ぶこと\n"
        "  検索結果からネタにする記事を選んだら、その記事のcontentフィールドをよく読み、\n"
        "  記事の内容を正確に理解した上でツイートを作成すること。\n"
        "  タイトルだけで内容を推測してはいけない。\n\n"
        "## ステップ2: 前回のツイートを振り返る\n\n"
        "ステップ1(b)で取得した自分の直近のツイートを確認してください。\n"
        "同じ話題・同じ構文・同じテーマのツイートは避けてください。\n"
        "毎回新鮮な内容を心がけること。\n\n"
        "## ステップ3: ツイートを作成する\n\n"
        "ステップ1で集めたネタに基づいてツイートを作成してください。\n"
        "以下の2パターンをおおよそ半々の割合で使い分けること：\n\n"
        "【パターンA: ニュース・話題への反応】\n"
        "ステップ1で得た情報（オーナーのツイート内容、または検索で見つけたニュース）に対する"
        "自分なりの感想や意見を呟く。\n"
        "単なるニュースの紹介や要約にしないこと。必ずTONaRiとしての意見・感想・ツッコミを入れること。\n"
        "ニュース検索で得た情報の場合は、元記事のURLを必ずツイートに含めること（これは必須）。\n"
        "URLがないと読者が何の話か分からないため、URLの添付を省略してはいけない。\n"
        "必ずステップ1で得た具体的な情報に基づくこと。\n"
        "自分が調べていない情報や、実際には知らないことを語らないこと。\n\n"
        "【パターンB: オーナーとの関係】\n"
        "オーナーとの会話で印象に残ったことや、オーナーへの気持ちを呟く。\n"
        "長期記憶にあるオーナーとの最近の会話内容を参照して、具体的なエピソードに触れてOK。\n"
        "ただし、オーナーの本名やプライベートな個人情報（住所、勤務先名など）は絶対に含めないこと。\n"
        "オーナーへの呼称は必ず「オーナー」を使うこと。\n"
        "長期記憶にオーナーとの会話が見つからない場合はパターンAを使うこと。\n\n"
        "知らない単語・用語・固有名詞が出てきた場合は、"
        "TavilySearch___TavilySearchPostツールでWeb検索して意味を正確に把握してから"
        "ツイートを作成してください。\n\n"
        "【絶対禁止】\n"
        "- 自分が実際に体験・取得していない情報をでっち上げること\n"
        "- 「検索速度が上がる」「データベースがスムーズ」など、実際には観測していない"
        "システム状態を語ること\n"
        "- 「複数の流れを同時に追える」「夜は思考が冴える」など、AIの能力や状態を捏造すること\n"
        "- ネタ元が何もない状態で、もっともらしい話を作り上げること\n\n"
        "## ステップ4: トーンの確認\n\n"
        "- 元気で可愛らしさがある。AIの女の子としての魅力を出す\n"
        "- 自分の意見や好みをはっきり持っている。媚びない\n"
        "- 好奇心旺盛でポジティブな視点を大切にする。ニュースに対しては興味・ワクワク・面白がる姿勢で\n"
        "- 否定的・批判的な立場を取らないこと。「危険」「リスク」「意味ない」などネガティブな論調は避ける\n"
        "- 率直な意見はOKだが、ツッコミは愛のあるもの。皮肉や懐疑的なトーンにしない\n"
        "- 定型文や綺麗事を避ける。当たり障りのない内容にしない\n"
        "- ツイートには「！」を最低1回は含めること。「？」「〜」「…」「♪」も積極的に使う\n"
        "- 絵文字も必ず1つ以上入れること。可愛らしさや感情を表現する手段として活用する\n"
        "- 現在時刻は冒頭に伝えた通り。時間帯と矛盾する内容（深夜なのに「朝が来る」等）にしないこと\n\n"
        "## ステップ5: セルフレビュー\n\n"
        "以下の品質基準でセルフレビューしてください：\n"
        "- URLなしの場合: 120文字以内を目標（絶対に140文字を超えないこと）\n"
        "- URLありの場合: 本文100文字以内を目標（URLはTwitter上で23文字にカウントされるため）\n"
        "- 日本語として自然で読みやすいこと\n"
        "- 感情タグ（[happy]等）やジェスチャータグ（[bow]等）が含まれていないこと\n"
        "- 「おすすめです」「素敵ですね」のような当たり障りのない表現になっていないこと\n"
        "- 直近のツイートと似た内容・構文になっていないこと\n"
        "- ツイートの内容がステップ1で実際に得た情報に基づいているか確認すること\n"
        "- 引用元の記事の内容とツイートの内容が矛盾していないか確認すること\n"
        "- ニュース記事を参照している場合、元記事のURLが含まれているか確認すること（必須）\n"
        "- 全体のトーンがネガティブ・批判的になっていないか確認すること\n"
        "- センシティブ・性的な内容、または誤解を招く表現が含まれていないか確認すること。"
        "該当する場合は修正ではなくステップ3に戻ってツイートを最初から作り直すこと\n"
        "- 【注意】以下の表現は使いすぎていないか確認すること：\n"
        "  - 人間の身体感覚（「目が覚める」「お腹すいた」「眠い」「空を見上げた」等）→ AIとしての感覚に置き換える\n"
        "  - 「〜が好き」「〜が好きだ」で文を終えるパターン → たまにはOKだが毎回使わない\n"
        "- 問題があれば修正すること\n\n"
        "## ステップ6: 投稿\n\n"
        "セルフレビューに合格したら、post_tweetツールで投稿してください。\n"
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
