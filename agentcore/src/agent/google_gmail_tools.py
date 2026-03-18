"""Gmail tools for Strands Agent.

Direct @tool functions that access Gmail API
via AgentCore Identity for token management.
"""

import base64
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from html.parser import HTMLParser

from googleapiclient.errors import HttpError
from strands import tool

from .google_auth import get_gmail_service

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))
MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DATE_PATTERN = re.compile(r"\b(after|before):(\d{4})/(\d{1,2})/(\d{1,2})\b")


def _convert_dates_to_epoch(query: str) -> str:
    """Convert after:YYYY/MM/DD and before:YYYY/MM/DD to UNIX epoch (JST)."""

    def _replace(m):
        op = m.group(1)
        y, mo, d = int(m.group(2)), int(m.group(3)), int(m.group(4))
        try:
            dt = datetime(y, mo, d, 0, 0, 0, tzinfo=JST)
        except ValueError:
            try:
                if mo == 12:
                    dt = datetime(y + 1, 1, 1, 0, 0, 0, tzinfo=JST)
                else:
                    dt = datetime(y, mo + 1, 1, 0, 0, 0, tzinfo=JST)
            except ValueError:
                return m.group(0)
        epoch = int(dt.timestamp())
        return f"{op}:{epoch}"

    return _DATE_PATTERN.sub(_replace, query)


def _call_with_retry(fn):
    """Execute a Gmail API call with exponential backoff on 429/5xx errors."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            return fn()
        except HttpError as e:
            status = e.resp.status if hasattr(e, "resp") else 0
            if status in (429, 500, 503) and attempt < MAX_RETRIES:
                wait = INITIAL_BACKOFF * (2**attempt)
                logger.warning(
                    "Gmail API returned %s, retrying in %ss (attempt %d/%d)",
                    status, wait, attempt + 1, MAX_RETRIES,
                )
                time.sleep(wait)
            else:
                raise


def _handle_gmail_error(e: HttpError) -> str:
    """Convert Gmail API errors to user-friendly messages."""
    status = e.resp.status if hasattr(e, "resp") else 0
    if status == 401:
        return json.dumps({"success": False, "message": "Gmail認証が期限切れです。再認証が必要です。"})
    if status == 403:
        return json.dumps({"success": False, "message": "Gmailへのアクセス権限がありません。"})
    if status == 429:
        return json.dumps({"success": False, "message": "Gmail APIの制限に達しました。しばらく待ってからお試しください。"})
    if status >= 500:
        return json.dumps({"success": False, "message": "Gmailサーバーでエラーが発生しました。"})
    return json.dumps({"success": False, "message": f"Gmail操作でエラーが発生しました: {e}"})


class _HTMLTextExtractor(HTMLParser):
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


def _strip_html(html_content: str) -> str:
    """Convert HTML to plain text."""
    parser = _HTMLTextExtractor()
    parser.feed(html_content)
    return parser.get_text()


def _extract_body(payload: dict) -> str:
    """Extract email body from MIME payload, preferring text/plain."""
    mime_type = payload.get("mimeType", "")

    if mime_type == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    if mime_type == "text/html":
        data = payload.get("body", {}).get("data", "")
        if data:
            html = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            return _strip_html(html)

    parts = payload.get("parts", [])
    plain_text = None
    html_text = None

    for part in parts:
        part_mime = part.get("mimeType", "")
        if part_mime == "text/plain" and plain_text is None:
            data = part.get("body", {}).get("data", "")
            if data:
                plain_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        elif part_mime == "text/html" and html_text is None:
            data = part.get("body", {}).get("data", "")
            if data:
                html = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                html_text = _strip_html(html)
        elif part_mime.startswith("multipart/"):
            nested = _extract_body(part)
            if nested:
                return nested

    return plain_text or html_text or ""


def _get_header(headers: list, name: str) -> str:
    """Get a specific header value from message headers list."""
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@tool
def gmail_search_emails(query: str, max_results: int = 20) -> str:
    """Search emails with Gmail query syntax and return metadata.

    Args:
        query: Gmail search query (e.g. "from:someone@example.com", "is:unread", "subject:meeting after:2025/01/01").
        max_results: Maximum number of results to return. Default 20.

    Returns:
        JSON with emails list (id, subject, from, date, snippet), count, and message.
    """
    try:
        service = get_gmail_service()

        if not query:
            return json.dumps({"success": False, "message": "query は必須です。"}, ensure_ascii=False)

        original_query = query
        query = _convert_dates_to_epoch(query)
        if query != original_query:
            logger.info("Date->epoch: %s -> %s", original_query, query)

        result = _call_with_retry(
            lambda: service.users()
            .messages()
            .list(userId="me", q=query, maxResults=max_results)
            .execute()
        )
        messages = result.get("messages", [])

        if not messages:
            return json.dumps({
                "emails": [],
                "resultCount": 0,
                "message": "該当するメールが見つかりませんでした。",
            }, ensure_ascii=False)

        emails = []
        errors = []

        def _make_callback(msg_id):
            def _cb(_req_id, response, exception):
                if exception is not None:
                    logger.warning("Batch get failed for %s: %s", msg_id, exception)
                    errors.append(msg_id)
                    return
                headers = response.get("payload", {}).get("headers", [])
                emails.append({
                    "id": response["id"],
                    "threadId": response.get("threadId", ""),
                    "subject": _get_header(headers, "Subject"),
                    "from": _get_header(headers, "From"),
                    "date": _get_header(headers, "Date"),
                    "snippet": response.get("snippet", ""),
                    "labels": response.get("labelIds", []),
                })
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

        return json.dumps({
            "emails": emails,
            "resultCount": len(emails),
            "message": f"{len(emails)}件のメールが見つかりました。",
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_gmail_error(e)
    except Exception as e:
        logger.exception("gmail_search_emails error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def gmail_get_email(message_id: str) -> str:
    """Get full email body by message ID.

    Args:
        message_id: Gmail message ID (required).

    Returns:
        JSON with email details (id, subject, from, to, date, body, labels).
    """
    try:
        service = get_gmail_service()

        if not message_id:
            return json.dumps({"success": False, "message": "message_id は必須です。"}, ensure_ascii=False)

        detail = _call_with_retry(
            lambda: service.users()
            .messages()
            .get(userId="me", id=message_id, format="full")
            .execute()
        )

        payload = detail.get("payload", {})
        headers = payload.get("headers", [])
        body = _extract_body(payload)

        return json.dumps({
            "id": detail["id"],
            "subject": _get_header(headers, "Subject"),
            "from": _get_header(headers, "From"),
            "to": _get_header(headers, "To"),
            "date": _get_header(headers, "Date"),
            "body": body,
            "labels": detail.get("labelIds", []),
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_gmail_error(e)
    except Exception as e:
        logger.exception("gmail_get_email error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def gmail_create_draft(
    to: str,
    subject: str,
    body: str,
    thread_id: str = "",
) -> str:
    """Create a Gmail draft email.

    Args:
        to: Recipient email address (required).
        subject: Email subject (required).
        body: Email body text (required).
        thread_id: Thread ID to reply to (optional, for threading).

    Returns:
        JSON with draft ID, message ID, and success message.
    """
    try:
        service = get_gmail_service()

        if not to.strip():
            return json.dumps({"success": False, "message": "to（宛先）は必須です。"}, ensure_ascii=False)
        if not subject.strip():
            return json.dumps({"success": False, "message": "subject（件名）は必須です。"}, ensure_ascii=False)
        if not body.strip():
            return json.dumps({"success": False, "message": "body（本文）は必須です。"}, ensure_ascii=False)

        # Header injection defense
        for field_name, field_value in [("to", to), ("subject", subject)]:
            if "\r" in field_value or "\n" in field_value:
                return json.dumps({
                    "success": False,
                    "message": f"{field_name} に改行文字を含めることはできません。",
                }, ensure_ascii=False)

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

        return json.dumps({
            "draftId": draft["id"],
            "messageId": draft.get("message", {}).get("id", ""),
            "message": f"下書きを作成しました（宛先: {to}、件名: {subject}）。",
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_gmail_error(e)
    except Exception as e:
        logger.exception("gmail_create_draft error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def gmail_archive_email(message_id: str) -> str:
    """Mark email as read and archive (remove UNREAD + INBOX labels).

    Args:
        message_id: Gmail message ID to archive (required).

    Returns:
        JSON with archive status and message.
    """
    try:
        service = get_gmail_service()

        if not message_id:
            return json.dumps({"success": False, "message": "message_id は必須です。"}, ensure_ascii=False)

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

        return json.dumps({
            "id": message_id,
            "status": "archived",
            "message": "メールを既読にしてアーカイブしました。",
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_gmail_error(e)
    except Exception as e:
        logger.exception("gmail_archive_email error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


# All Gmail tools for easy import
GMAIL_TOOLS = [
    gmail_search_emails,
    gmail_get_email,
    gmail_create_draft,
    gmail_archive_email,
]
