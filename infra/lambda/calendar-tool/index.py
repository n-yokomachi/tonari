"""
AgentCore Gateway Calendar Tool Lambda

Tools:
- list_events: List calendar events for a date or date range
- check_availability: Check availability for a date, time slot, or date range
- create_event: Create a new calendar event
- update_event: Update an existing calendar event
- delete_event: Delete a calendar event
- suggest_schedule: Suggest available time slots based on criteria
"""

import logging
from datetime import datetime, timedelta, timezone

import boto3
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SSM_PREFIX = "/tonari/google"
AWS_REGION = "ap-northeast-1"
CALENDAR_ID = "primary"
JST = timezone(timedelta(hours=9))
TIMEZONE = "Asia/Tokyo"

_calendar_service = None


def get_calendar_service():
    """Initialize Google Calendar API client with SSM credentials."""
    global _calendar_service
    if _calendar_service:
        return _calendar_service

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

    _calendar_service = build("calendar", "v3", credentials=credentials)
    return _calendar_service


def handler(event, context):
    """Dispatch to appropriate tool function based on event fields."""
    try:
        if "duration_minutes" in event:
            return suggest_schedule(event)
        if "event_id" in event:
            update_fields = ("title", "start", "end", "location", "description")
            if any(k in event for k in update_fields):
                return update_event(event)
            return delete_event(event)
        if "title" in event:
            return create_event(event)
        if "check_type" in event:
            return check_availability(event)
        return list_events(event)
    except HttpError as e:
        return _handle_google_error(e)
    except Exception as e:
        logger.exception("Unexpected error")
        return {"success": False, "message": f"エラーが発生しました: {str(e)}"}


def _handle_google_error(e):
    """Convert Google API errors to user-friendly messages."""
    status = e.resp.status if hasattr(e, "resp") else 0
    if status == 401:
        global _calendar_service
        _calendar_service = None
        return {
            "success": False,
            "message": "カレンダーにアクセスできません。認証情報を確認してください。",
        }
    if status == 404:
        return {"success": False, "message": "指定された予定が見つかりません。"}
    if status == 429:
        return {
            "success": False,
            "message": "カレンダーへのアクセスが一時的に制限されています。",
        }
    if status >= 500:
        return {
            "success": False,
            "message": "カレンダーサービスに接続できません。",
        }
    return {
        "success": False,
        "message": f"カレンダー操作でエラーが発生しました: {str(e)}",
    }


def _parse_event(event):
    """Convert Google Calendar event to simplified format."""
    start = event.get("start", {})
    end = event.get("end", {})
    return {
        "event_id": event.get("id"),
        "title": event.get("summary", "(タイトルなし)"),
        "start": start.get("dateTime", start.get("date", "")),
        "end": end.get("dateTime", end.get("date", "")),
        "location": event.get("location", ""),
        "all_day": "date" in start,
    }


# ---------------------------------------------------------------------------
# Tool: list_events
# ---------------------------------------------------------------------------


def list_events(event):
    """List events for a specific date or date range."""
    service = get_calendar_service()

    date_str = event.get("date")
    date_from = event.get("date_from")
    date_to = event.get("date_to")

    if date_str:
        time_min = f"{date_str}T00:00:00+09:00"
        time_max = f"{date_str}T23:59:59+09:00"
    elif date_from and date_to:
        time_min = f"{date_from}T00:00:00+09:00"
        time_max = f"{date_to}T23:59:59+09:00"
    else:
        today = datetime.now(JST).strftime("%Y-%m-%d")
        time_min = f"{today}T00:00:00+09:00"
        time_max = f"{today}T23:59:59+09:00"

    result = (
        service.events()
        .list(
            calendarId=CALENDAR_ID,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            timeZone=TIMEZONE,
        )
        .execute()
    )

    events = [_parse_event(e) for e in result.get("items", [])]

    return {
        "events": events,
        "count": len(events),
        "message": f"{len(events)}件の予定が見つかりました。"
        if events
        else "予定はありません。",
    }


# ---------------------------------------------------------------------------
# Tool: check_availability
# ---------------------------------------------------------------------------


def check_availability(event):
    """Check availability for a date, time slot, or date range."""
    service = get_calendar_service()
    check_type = event.get("check_type", "day")

    if check_type == "time_slot":
        return _check_time_slot(service, event)
    if check_type == "range":
        return _check_range(service, event)
    return _check_day(service, event)


def _check_time_slot(service, event):
    """Check if a specific time slot is available."""
    date_str = event.get("date")
    time_from = event.get("time_from", "09:00")
    time_to = event.get("time_to", "18:00")

    if not date_str:
        return {"success": False, "message": "date は必須です。"}

    time_min = f"{date_str}T{time_from}:00+09:00"
    time_max = f"{date_str}T{time_to}:00+09:00"

    body = {
        "timeMin": time_min,
        "timeMax": time_max,
        "timeZone": TIMEZONE,
        "items": [{"id": CALENDAR_ID}],
    }
    result = service.freebusy().query(body=body).execute()
    busy = result.get("calendars", {}).get(CALENDAR_ID, {}).get("busy", [])

    busy_slots = [{"start": s["start"], "end": s["end"]} for s in busy]

    available = len(busy) == 0
    msg = (
        f"{date_str} {time_from}〜{time_to}は空いています。"
        if available
        else f"{date_str} {time_from}〜{time_to}には{len(busy)}件の予定があります。"
    )
    return {"available": available, "busy_slots": busy_slots, "message": msg}


def _check_range(service, event):
    """Find free days in a date range."""
    date_from = event.get("date_from")
    date_to = event.get("date_to")

    if not date_from or not date_to:
        return {"success": False, "message": "date_from と date_to は必須です。"}

    time_min = f"{date_from}T00:00:00+09:00"
    time_max = f"{date_to}T23:59:59+09:00"

    result = (
        service.events()
        .list(
            calendarId=CALENDAR_ID,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            timeZone=TIMEZONE,
        )
        .execute()
    )

    busy_dates = set()
    for e in result.get("items", []):
        start = e.get("start", {})
        if "date" in start:
            busy_dates.add(start["date"])
        elif "dateTime" in start:
            dt = datetime.fromisoformat(start["dateTime"])
            busy_dates.add(dt.strftime("%Y-%m-%d"))

    start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
    end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
    free_days = []
    current = start_date
    while current <= end_date:
        ds = current.strftime("%Y-%m-%d")
        if ds not in busy_dates:
            free_days.append(ds)
        current += timedelta(days=1)

    return {
        "free_days": free_days,
        "count": len(free_days),
        "message": f"{len(free_days)}日の空き日があります。"
        if free_days
        else "指定期間に空き日はありません。",
    }


def _check_day(service, event):
    """Check if a single day is available."""
    date_str = event.get("date")
    if not date_str:
        date_str = datetime.now(JST).strftime("%Y-%m-%d")

    time_min = f"{date_str}T00:00:00+09:00"
    time_max = f"{date_str}T23:59:59+09:00"

    body = {
        "timeMin": time_min,
        "timeMax": time_max,
        "timeZone": TIMEZONE,
        "items": [{"id": CALENDAR_ID}],
    }
    result = service.freebusy().query(body=body).execute()
    busy = result.get("calendars", {}).get(CALENDAR_ID, {}).get("busy", [])

    busy_slots = [{"start": s["start"], "end": s["end"]} for s in busy]

    available = len(busy) == 0
    msg = (
        f"{date_str}は空いています。"
        if available
        else f"{date_str}には{len(busy)}件の予定があります。"
    )
    return {"available": available, "busy_slots": busy_slots, "message": msg}


# ---------------------------------------------------------------------------
# Tool: create_event
# ---------------------------------------------------------------------------


def create_event(event):
    """Create a new calendar event."""
    service = get_calendar_service()

    title = event.get("title", "").strip()
    if not title:
        return {"success": False, "message": "title は必須です。"}

    start = event.get("start", "")
    if not start:
        return {"success": False, "message": "start は必須です。"}

    end = event.get("end", "")
    is_all_day = len(start) == 10  # YYYY-MM-DD format

    body = {"summary": title}

    if is_all_day:
        body["start"] = {"date": start}
        if end and end != start:
            body["end"] = {"date": end}
        else:
            next_day = datetime.strptime(start, "%Y-%m-%d") + timedelta(days=1)
            body["end"] = {"date": next_day.strftime("%Y-%m-%d")}
    else:
        if "+" not in start and "Z" not in start:
            start += "+09:00"
        body["start"] = {"dateTime": start, "timeZone": TIMEZONE}

        if end:
            if "+" not in end and "Z" not in end:
                end += "+09:00"
            body["end"] = {"dateTime": end, "timeZone": TIMEZONE}
        else:
            start_dt = datetime.fromisoformat(start)
            end_dt = start_dt + timedelta(hours=1)
            body["end"] = {"dateTime": end_dt.isoformat(), "timeZone": TIMEZONE}

    location = event.get("location")
    if location:
        body["location"] = location

    description = event.get("description")
    if description:
        body["description"] = description

    created = service.events().insert(calendarId=CALENDAR_ID, body=body).execute()

    return {
        "success": True,
        "event": _parse_event(created),
        "message": f"予定「{title}」を登録しました。",
    }


# ---------------------------------------------------------------------------
# Tool: update_event
# ---------------------------------------------------------------------------


def update_event(event):
    """Update an existing calendar event."""
    service = get_calendar_service()

    event_id = event.get("event_id", "")
    if not event_id:
        return {"success": False, "message": "event_id は必須です。"}

    existing = service.events().get(calendarId=CALENDAR_ID, eventId=event_id).execute()

    if "title" in event:
        existing["summary"] = event["title"]

    if "start" in event:
        start = event["start"]
        if len(start) == 10:
            existing["start"] = {"date": start}
        else:
            if "+" not in start and "Z" not in start:
                start += "+09:00"
            existing["start"] = {"dateTime": start, "timeZone": TIMEZONE}

    if "end" in event:
        end = event["end"]
        if len(end) == 10:
            existing["end"] = {"date": end}
        else:
            if "+" not in end and "Z" not in end:
                end += "+09:00"
            existing["end"] = {"dateTime": end, "timeZone": TIMEZONE}

    if "location" in event:
        existing["location"] = event["location"]

    if "description" in event:
        existing["description"] = event["description"]

    updated = (
        service.events()
        .update(calendarId=CALENDAR_ID, eventId=event_id, body=existing)
        .execute()
    )

    return {
        "success": True,
        "event": _parse_event(updated),
        "message": f"予定「{updated.get('summary', '')}」を更新しました。",
    }


# ---------------------------------------------------------------------------
# Tool: delete_event
# ---------------------------------------------------------------------------


def delete_event(event):
    """Delete a calendar event."""
    service = get_calendar_service()

    event_id = event.get("event_id", "")
    if not event_id:
        return {"success": False, "message": "event_id は必須です。"}

    try:
        existing = (
            service.events().get(calendarId=CALENDAR_ID, eventId=event_id).execute()
        )
        title = existing.get("summary", "(タイトルなし)")
    except HttpError:
        return {"success": False, "message": "指定された予定が見つかりません。"}

    service.events().delete(calendarId=CALENDAR_ID, eventId=event_id).execute()

    return {
        "success": True,
        "message": f"予定「{title}」を削除しました。",
    }


# ---------------------------------------------------------------------------
# Tool: suggest_schedule
# ---------------------------------------------------------------------------


def suggest_schedule(event):
    """Suggest available time slots based on criteria."""
    service = get_calendar_service()

    date_from = event.get("date_from")
    date_to = event.get("date_to")
    duration_minutes = int(event.get("duration_minutes", 60))
    preferred_from = event.get("preferred_time_from", "09:00")
    preferred_to = event.get("preferred_time_to", "18:00")

    if not date_from or not date_to:
        return {"success": False, "message": "date_from と date_to は必須です。"}

    time_min = f"{date_from}T00:00:00+09:00"
    time_max = f"{date_to}T23:59:59+09:00"

    body = {
        "timeMin": time_min,
        "timeMax": time_max,
        "timeZone": TIMEZONE,
        "items": [{"id": CALENDAR_ID}],
    }
    freebusy = service.freebusy().query(body=body).execute()
    busy_periods = freebusy.get("calendars", {}).get(CALENDAR_ID, {}).get("busy", [])

    busy = [
        {
            "start": datetime.fromisoformat(p["start"]),
            "end": datetime.fromisoformat(p["end"]),
        }
        for p in busy_periods
    ]

    suggestions = []
    start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
    end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
    duration = timedelta(minutes=duration_minutes)

    pref_h_from, pref_m_from = map(int, preferred_from.split(":"))
    pref_h_to, pref_m_to = map(int, preferred_to.split(":"))

    current_date = start_date
    while current_date <= end_date and len(suggestions) < 5:
        slot_start = datetime(
            current_date.year,
            current_date.month,
            current_date.day,
            pref_h_from,
            pref_m_from,
            tzinfo=JST,
        )
        day_end = datetime(
            current_date.year,
            current_date.month,
            current_date.day,
            pref_h_to,
            pref_m_to,
            tzinfo=JST,
        )

        while slot_start + duration <= day_end and len(suggestions) < 5:
            slot_end = slot_start + duration

            conflict = None
            for b in busy:
                if slot_start < b["end"] and slot_end > b["start"]:
                    conflict = b
                    break

            if conflict is None:
                suggestions.append(
                    {
                        "date": current_date.strftime("%Y-%m-%d"),
                        "start": slot_start.isoformat(),
                        "end": slot_end.isoformat(),
                    }
                )
                slot_start = slot_end
            else:
                slot_start = conflict["end"]

        current_date += timedelta(days=1)

    return {
        "suggestions": suggestions,
        "count": len(suggestions),
        "message": f"{len(suggestions)}件の候補が見つかりました。"
        if suggestions
        else "指定条件で空き枠が見つかりませんでした。",
    }
