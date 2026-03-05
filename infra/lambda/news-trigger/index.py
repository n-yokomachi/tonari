"""News Trigger Lambda: collect news via AgentCore and send notifications."""

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
from base64 import b64encode
from datetime import datetime, timedelta, timezone

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

JST = timezone(timedelta(hours=9))


def _get_urgent_tasks(table_name: str, days: int = 3) -> list[dict]:
    """Get tasks with due dates within N days.

    Args:
        table_name: DynamoDB table name for tasks.
        days: Number of days to look ahead.

    Returns:
        List of task dicts with title and dueDate.
    """
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)
    now = datetime.now(JST)
    threshold = (now + timedelta(days=days)).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")

    try:
        response = table.scan(
            FilterExpression="attribute_exists(dueDate) AND completed = :false AND dueDate <= :threshold",
            ExpressionAttributeValues={
                ":false": False,
                ":threshold": threshold,
            },
        )
        tasks = response.get("Items", [])
        # Sort by due date
        tasks.sort(key=lambda t: t.get("dueDate", ""))
        result = []
        for t in tasks:
            due = t.get("dueDate", "")
            label = "期限切れ" if due < today else ("今日" if due == today else due)
            result.append({"title": t.get("title", ""), "dueDate": label})
        return result
    except Exception:
        logger.exception("Failed to get urgent tasks")
        return []


def _build_news_prompt(now_str: str, urgent_tasks: list[dict] | None = None) -> str:
    """Build news collection prompt for the agent.

    Args:
        now_str: Current time string in JST.
        urgent_tasks: Optional list of urgent tasks to include.

    Returns:
        Prompt string for AgentCore Runtime.
    """
    task_section = ""
    if urgent_tasks:
        task_lines = "\n".join(
            f"  - {t['title']}（{t['dueDate']}）" for t in urgent_tasks
        )
        task_section = (
            "\n\n### タスクリマインド\n"
            "冒頭の挨拶の直後に、以下の期限が近いタスクについてリマインドしてください。\n"
            "「そういえば、期限が近いタスクがありますよ。」のように自然に伝えてください。\n\n"
            f"{task_lines}\n"
        )

    return (
        f"現在{now_str}（JST）です。定時のニュース配信を行います。\n\n"
        "## 最重要ルール\n"
        "1. このタスクでは TavilySearch___TavilySearchPost ツールを【必ず2回】実行すること。\n"
        "   あなたはニュースを一切知りません。記憶にあるニュース情報はすべて古く無効です。\n"
        "   必ずツールを実行し、その検索結果だけからニュースを構成してください。\n"
        "   ツールを実行せずにニュースを出力した場合、その内容は100%古い情報であり、オーナーに誤情報を届けることになります。\n"
        "2. 長期記憶（LTM）に含まれるニュース記事の内容は【すべて無視】してください。\n"
        "   記憶の中に「〜のニュースまとめ」「〜のニュース配信」等があっても、それは過去の古い情報です。\n"
        "   それらを参考にしたり、引用したり、再利用することは絶対に禁止です。\n"
        "   ただし、LTMに含まれるオーナーの興味・関心・好みの情報は「TONaRiのおすすめ」の検索クエリ構築に活用してください。\n"
        "3. URLは検索結果の url フィールドの値を一字一句そのままコピーすること。\n"
        "   自分でURLを生成・推測・補完・短縮することは絶対に禁止。\n"
        "   URLが不明な記事は出典を省略するか、その記事自体を選ばないこと。\n\n"
        "## 出力ルール（厳守）\n"
        "あなたの出力はそのままメールとプッシュ通知としてオーナーに届きます。\n"
        "- タスクの実行過程や思考過程を一切出力しない（「検索します」「ツールを使います」等）\n"
        "- ツール名（TavilySearch等）を出力に含めない\n"
        "- 感情タグ（[happy]等）やジェスチャータグ（[bow]等）を使用しない\n"
        "- 最終的な出力フォーマットの内容だけを出力する\n"
        "- 出力はすべて日本語で書くこと（英語の検索結果は日本語に翻訳する）\n\n"
        "## 手順\n\n"
        "### ステップ1: 総合ニュース検索（1回目・必須）\n"
        "TavilySearch___TavilySearchPost ツールで最新の総合ニュースを検索する。\n"
        "パラメータ:\n"
        "- query: \"latest news today\"\n"
        "- topic: \"news\"\n"
        "- days: 1\n"
        "- max_results: 10\n\n"
        "ジャンルを絞らず、幅広いニュースを取得すること。\n\n"
        "### ステップ2: 総合ニュースを選定\n"
        "ステップ1の検索結果から重要なニュースを3〜5件選ぶ。\n"
        "各ニュースについて、検索結果のレスポンスから以下を正確に取得する：\n"
        "- title: results[].title の値をそのまま使用\n"
        "- url: results[].url の値を一字一句そのまま使用（編集・推測・補完禁止）\n"
        "- content: results[].content の値を元に要約作成\n\n"
        "**url フィールドが存在しない記事は選ばないこと。**\n\n"
        "### ステップ3: おすすめニュース検索（2回目・必須）\n"
        "オーナーの長期記憶（LTM）から興味・関心を把握し、それに合ったニュースを検索する。\n"
        "TavilySearch___TavilySearchPost ツールで検索する。\n"
        "パラメータ:\n"
        "- query: LTMから把握したオーナーの興味に基づくクエリ（例: オーナーがAIに興味があるなら \"AI technology news today\"）\n"
        "- topic: \"news\"\n"
        "- days: 1\n"
        "- max_results: 5\n\n"
        "### ステップ4: おすすめニュースを選定\n"
        "ステップ3の検索結果から1〜2件ピックアップする。\n"
        "- **ステップ2で選んだ記事と同じURLの記事は絶対に選ばない（重複禁止）**\n"
        "- 該当するものがなければ「TONaRiのおすすめ」セクション自体を省略してよい\n\n"
        "### ステップ5: 出力\n"
        "以下のフォーマットで出力する。\n\n"
        f"{task_section}"
        "## 出力フォーマット\n\n"
        "（冒頭の挨拶：時間帯に合った親しみのある一言。例：「オーナー、おはようございます！今朝のニュースをお届けします。」「オーナー、お疲れ様です。夜のニュースまとめです。」など。タスクの説明や「検索します」等の作業報告は絶対に書かない）\n\n"
        "---\n\n"
        "【総合ニュース】\n\n"
        "■ 記事タイトル（検索結果のtitleを日本語に翻訳）\n"
        "要約（2〜3文。検索結果のcontentを元に日本語で作成）\n"
        "出典: 検索結果のurlをそのまま記載\n\n"
        "（3〜5件）\n\n"
        "【TONaRiのおすすめ】（該当なければ省略可）\n\n"
        "■ 記事タイトル（検索結果のtitleを日本語に翻訳。総合ニュースと被らない記事）\n"
        "要約（2〜3文）\n"
        "おすすめ理由: 一言添える\n"
        "出典: 検索結果のurlをそのまま記載\n\n"
        "---\n\n"
        "（締めの一言：オーナーを気遣う短いメッセージ。例：「今日も良い一日をお過ごしください。」「夜更かしせず、ゆっくり休んでくださいね。」など。「以上です」のような事務的な表現は使わない）\n\n"
        "## 注意事項\n"
        "- プレーンテキストで読みやすく整形する（Markdown不可）\n"
        "- すべて日本語で出力する（タイトル・要約・挨拶すべて日本語）\n"
        "- 検索結果にないニュースを創作しない\n"
        "- 出典URLは検索結果の results[].url の値を一字一句コピーすること\n"
        "- URLを自分で生成・推測・補完することは絶対に禁止\n"
        "- 検索結果に url がない記事は出典を書かない\n\n"
        "## 長期記憶への保存禁止\n"
        "ニュースの内容を長期記憶（LTM）に保存しないでください。\n"
        "ニュースは別の仕組みで保存されるため、記憶への保存は不要かつ有害です。"
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
            "mode": "news",
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


def _save_news_to_dynamodb(
    table_name: str, summary: str, now_jst: datetime
) -> None:
    """Save news summary to DynamoDB (overwrite existing record).

    Args:
        table_name: DynamoDB table name for news.
        summary: News summary text.
        now_jst: Current datetime in JST.
    """
    dynamodb = boto3.resource("dynamodb")
    news_table = dynamodb.Table(table_name)
    news_table.put_item(
        Item={
            "userId": "tonari-owner",
            "summary": summary,
            "updatedAt": now_jst.isoformat(),
        }
    )
    logger.info("News saved to DynamoDB table: %s", table_name)


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
    news_table = os.environ["NEWS_TABLE"]
    tasks_table = os.environ.get("TASKS_TABLE", "")

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

    # Get urgent tasks for reminder
    urgent_tasks = _get_urgent_tasks(tasks_table) if tasks_table else []
    if urgent_tasks:
        logger.info("Found %d urgent tasks for reminder", len(urgent_tasks))

    prompt = _build_news_prompt(now_str, urgent_tasks if urgent_tasks else None)
    session_id = (
        f"tonari-news-pipeline-{now_jst.strftime('%Y-%m-%d')}"
        f"-{now_jst.strftime('%H%M')}-{uuid.uuid4().hex[:8]}"
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

        # Debug: log raw SSE response (truncated)
        logger.info(
            "Raw AgentCore response (first 3000 chars): %s",
            response_body[:3000],
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

    # Save news to DynamoDB for in-app viewing
    try:
        _save_news_to_dynamodb(news_table, news_summary, now_jst)
    except Exception:
        logger.exception("Failed to save news to DynamoDB")

    logger.info("News pipeline completed successfully")
    return {"statusCode": 200, "body": "News pipeline completed"}
