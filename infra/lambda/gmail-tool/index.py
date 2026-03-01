"""
AgentCore Gateway Gmail Tool Lambda

Tools:
- search_emails: Search emails with Gmail query syntax and return metadata
- get_email: Get full email body by message ID
- create_draft: Create a draft email
- archive_email: Mark as read and archive (remove UNREAD + INBOX labels)
"""

import base64
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from html.parser import HTMLParser

import boto3
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SSM_PREFIX = "/tonari/google"
AWS_REGION = "ap-northeast-1"
JST = timezone(timedelta(hours=9))
_gmail_service = None

# ---------------------------------------------------------------------------
# Retry helper
# ---------------------------------------------------------------------------

MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0  # seconds


def _call_with_retry(fn):
    """Execute a Gmail API call with exponential backoff on 429/5xx errors."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            return fn()
        except HttpError as e:
            status = e.resp.status if hasattr(e, "resp") else 0
            if status in (429, 500, 503) and attempt < MAX_RETRIES:
                wait = INITIAL_BACKOFF * (2 ** attempt)
                logger.warning(
                    f"Gmail API returned {status}, retrying in {wait}s "
                    f"(attempt {attempt + 1}/{MAX_RETRIES})"
                )
                time.sleep(wait)
            else:
                raise


# ---------------------------------------------------------------------------
# JST date → UNIX epoch conversion for Gmail queries
# ---------------------------------------------------------------------------

_DATE_PATTERN = re.compile(
    r"\b(after|before):(\d{4})/(\d{1,2})/(\d{1,2})\b"
)


def _convert_dates_to_epoch(query):
    """Convert after:YYYY/MM/DD and before:YYYY/MM/DD to UNIX epoch (JST).

    Gmail interprets YYYY/MM/DD dates as midnight PST, which causes
    off-by-one issues for JST (UTC+9). Google's official recommendation
    is to use UNIX epoch seconds for accurate timezone handling.
    See: https://developers.google.com/gmail/api/guides/filtering

    The agent passes JST dates without any adjustment. This function
    converts them to epoch seconds at JST midnight so Gmail searches
    the correct time range.
    """

    def _replace(m):
        op = m.group(1)  # "after" or "before"
        y, mo, d = int(m.group(2)), int(m.group(3)), int(m.group(4))
        try:
            dt = datetime(y, mo, d, 0, 0, 0, tzinfo=JST)
        except ValueError:
            # Invalid date (e.g. Feb 29 in non-leap year) → normalize
            # by using day=1 of the next month
            try:
                if mo == 12:
                    dt = datetime(y + 1, 1, 1, 0, 0, 0, tzinfo=JST)
                else:
                    dt = datetime(y, mo + 1, 1, 0, 0, 0, tzinfo=JST)
                logger.info(
                    f"Normalized invalid date {y}/{mo:02d}/{d:02d} -> "
                    f"{dt.strftime('%Y/%m/%d')}"
                )
            except ValueError:
                logger.warning(f"Cannot normalize date: {m.group(0)}")
                return m.group(0)
        epoch = int(dt.timestamp())
        return f"{op}:{epoch}"

    return _DATE_PATTERN.sub(_replace, query)


# ---------------------------------------------------------------------------
# Gmail service
# ---------------------------------------------------------------------------


def get_gmail_service():
    """Initialize Gmail API client with SSM credentials."""
    global _gmail_service
    if _gmail_service:
        return _gmail_service

    ssm = boto3.client("ssm", region_name=AWS_REGION)
    params = {}
    for key in ("client_id", "client_secret", "refresh_token"):
        resp = ssm.get_parameter(Name=f"{SSM_PREFIX}/{key}", WithDecryption=True)
        params[key] = resp["Parameter"]["Value"]

    credentials = Credentials(
        token=None,
        refresh_token=params["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=params["client_id"],
        client_secret=params["client_secret"],
    )

    _gmail_service = build("gmail", "v1", credentials=credentials)
    return _gmail_service


# ---------------------------------------------------------------------------
# HTML helpers
# ---------------------------------------------------------------------------


class HTMLTextExtractor(HTMLParser):
    """Extract plain text from HTML content."""

    def __init__(self):
        super().__init__()
        self._text = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip = True
        elif tag in ("br", "p", "div", "tr", "li"):
            self._text.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self._text.append(data)

    def get_text(self):
        return re.sub(r"\n{3,}", "\n\n", "".join(self._text)).strip()


def _strip_html(html_content):
    """Convert HTML to plain text."""
    parser = HTMLTextExtractor()
    parser.feed(html_content)
    return parser.get_text()


def _extract_body(payload):
    """Extract email body from MIME payload, preferring text/plain."""
    mime_type = payload.get("mimeType", "")

    # Direct body (non-multipart)
    if mime_type == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    if mime_type == "text/html":
        data = payload.get("body", {}).get("data", "")
        if data:
            html = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            return _strip_html(html)

    # Multipart: recursively search parts
    parts = payload.get("parts", [])
    plain_text = None
    html_text = None

    for part in parts:
        part_mime = part.get("mimeType", "")
        if part_mime == "text/plain" and plain_text is None:
            data = part.get("body", {}).get("data", "")
            if data:
                plain_text = base64.urlsafe_b64decode(data).decode(
                    "utf-8", errors="replace"
                )
        elif part_mime == "text/html" and html_text is None:
            data = part.get("body", {}).get("data", "")
            if data:
                html = base64.urlsafe_b64decode(data).decode(
                    "utf-8", errors="replace"
                )
                html_text = _strip_html(html)
        elif part_mime.startswith("multipart/"):
            nested = _extract_body(part)
            if nested:
                return nested

    return plain_text or html_text or ""


def _get_header(headers, name):
    """Get a specific header value from message headers list."""
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------


def handler(event, context):
    """Dispatch to appropriate tool function based on event fields."""
    try:
        action = event.get("action", "")
        logger.info(f"Handler called with action: {action}")

        # Route by action field (passed via Gateway tool schema)
        if action == "search_emails":
            return search_emails(event)
        if action == "get_email":
            return get_email(event)
        if action == "create_draft":
            return create_draft(event)
        if action == "archive_email":
            return archive_email(event)

        return {"success": False, "message": "不明なツール呼び出しです。action フィールドが必要です。"}
    except HttpError as e:
        return _handle_gmail_error(e)
    except Exception as e:
        logger.exception("Unexpected error")
        return {"success": False, "message": f"エラーが発生しました: {str(e)}"}


def _handle_gmail_error(e):
    """Convert Gmail API errors to user-friendly messages."""
    status = e.resp.status if hasattr(e, "resp") else 0
    if status == 401:
        global _gmail_service
        _gmail_service = None
        return {
            "success": False,
            "message": "Gmail認証が期限切れです。再認証が必要です。",
        }
    if status == 403:
        return {
            "success": False,
            "message": "Gmailへのアクセス権限がありません。",
        }
    if status == 429:
        return {
            "success": False,
            "message": "Gmail APIの制限に達しました。しばらく待ってからお試しください。",
        }
    if status >= 500:
        return {
            "success": False,
            "message": "Gmailサーバーでエラーが発生しました。",
        }
    return {
        "success": False,
        "message": f"Gmail操作でエラーが発生しました: {str(e)}",
    }


# ---------------------------------------------------------------------------
# Tool: search_emails
# ---------------------------------------------------------------------------


def search_emails(event):
    """Search emails with Gmail query syntax and return metadata."""
    service = get_gmail_service()

    query = event.get("query", "")
    max_results = int(event.get("max_results", 20))

    if not query:
        return {"success": False, "message": "query は必須です。"}

    # Convert YYYY/MM/DD dates to UNIX epoch at JST midnight
    original_query = query
    query = _convert_dates_to_epoch(query)
    if query != original_query:
        logger.info(f"Date->epoch: {original_query} -> {query}")

    # Step 1: Get message IDs
    result = _call_with_retry(
        lambda: service.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )
    messages = result.get("messages", [])

    if not messages:
        return {
            "emails": [],
            "resultCount": 0,
            "message": "該当するメールが見つかりませんでした。",
        }

    # Step 2: Get metadata for each message (batch API)
    emails = []
    errors = []

    def _make_callback(msg_id):
        def _cb(_req_id, response, exception):
            if exception is not None:
                logger.warning(f"Batch get failed for {msg_id}: {exception}")
                errors.append(msg_id)
                return
            headers = response.get("payload", {}).get("headers", [])
            emails.append(
                {
                    "id": response["id"],
                    "threadId": response.get("threadId", ""),
                    "subject": _get_header(headers, "Subject"),
                    "from": _get_header(headers, "From"),
                    "date": _get_header(headers, "Date"),
                    "snippet": response.get("snippet", ""),
                    "labels": response.get("labelIds", []),
                }
            )

        return _cb

    batch = service.new_batch_http_request()
    for msg in messages:
        batch.add(
            service.users()
            .messages()
            .get(
                userId="me",
                id=msg["id"],
                format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            ),
            request_id=msg["id"],
            callback=_make_callback(msg["id"]),
        )
    batch.execute()

    if errors:
        logger.warning(f"Batch: {len(errors)} message(s) failed to fetch")

    return {
        "emails": emails,
        "resultCount": len(emails),
        "message": f"{len(emails)}件のメールが見つかりました。",
    }


# ---------------------------------------------------------------------------
# Tool: get_email
# ---------------------------------------------------------------------------


def get_email(event):
    """Get full email body by message ID."""
    service = get_gmail_service()

    message_id = event.get("message_id", "")
    if not message_id:
        return {"success": False, "message": "message_id は必須です。"}

    detail = _call_with_retry(
        lambda: service.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )

    payload = detail.get("payload", {})
    headers = payload.get("headers", [])
    body = _extract_body(payload)

    return {
        "id": detail["id"],
        "subject": _get_header(headers, "Subject"),
        "from": _get_header(headers, "From"),
        "to": _get_header(headers, "To"),
        "date": _get_header(headers, "Date"),
        "body": body,
        "labels": detail.get("labelIds", []),
    }


# ---------------------------------------------------------------------------
# Tool: create_draft
# ---------------------------------------------------------------------------


def create_draft(event):
    """Create a Gmail draft."""
    service = get_gmail_service()

    to = event.get("to", "").strip()
    subject = event.get("subject", "").strip()
    body = event.get("body", "").strip()
    thread_id = event.get("thread_id")

    if not to:
        return {"success": False, "message": "to（宛先）は必須です。"}
    if not subject:
        return {"success": False, "message": "subject（件名）は必須です。"}
    if not body:
        return {"success": False, "message": "body（本文）は必須です。"}

    # Header injection defense
    for field_name, field_value in [("to", to), ("subject", subject)]:
        if "\r" in field_value or "\n" in field_value:
            return {
                "success": False,
                "message": f"{field_name} に改行文字を含めることはできません。",
            }

    message = EmailMessage()
    message.set_content(body)
    message["To"] = to
    message["Subject"] = subject

    encoded = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")
    draft_body = {"message": {"raw": encoded}}

    if thread_id:
        draft_body["message"]["threadId"] = thread_id

    draft = _call_with_retry(
        lambda: service.users()
        .drafts()
        .create(userId="me", body=draft_body)
        .execute()
    )

    return {
        "draftId": draft["id"],
        "messageId": draft.get("message", {}).get("id", ""),
        "message": f"下書きを作成しました（宛先: {to}、件名: {subject}）。",
    }


# ---------------------------------------------------------------------------
# Tool: archive_email
# ---------------------------------------------------------------------------


def archive_email(event):
    """Mark email as read and archive (remove UNREAD + INBOX labels)."""
    service = get_gmail_service()

    message_id = event.get("message_id", "")
    if not message_id:
        return {"success": False, "message": "message_id は必須です。"}

    _call_with_retry(
        lambda: service.users()
        .messages()
        .modify(
            userId="me",
            id=message_id,
            body={"removeLabelIds": ["UNREAD", "INBOX"]},
        )
        .execute()
    )

    return {
        "id": message_id,
        "status": "archived",
        "message": "メールを既読にしてアーカイブしました。",
    }
