"""Google Calendar tools for Strands Agent.

Direct @tool functions that access Google Calendar API
via AgentCore Identity for token management.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from googleapiclient.errors import HttpError
from strands import tool

from .google_auth import get_calendar_service

logger = logging.getLogger(__name__)

CALENDAR_ID = "primary"
JST = timezone(timedelta(hours=9))
TIMEZONE = "Asia/Tokyo"


def _handle_google_error(e: HttpError) -> str:
    """Convert Google API errors to user-friendly messages."""
    status = e.resp.status if hasattr(e, "resp") else 0
    if status == 401:
        return json.dumps({"success": False, "message": "カレンダーにアクセスできません。認証情報を確認してください。"})
    if status == 404:
        return json.dumps({"success": False, "message": "指定された予定が見つかりません。"})
    if status == 429:
        return json.dumps({"success": False, "message": "カレンダーへのアクセスが一時的に制限されています。"})
    if status >= 500:
        return json.dumps({"success": False, "message": "カレンダーサービスに接続できません。"})
    return json.dumps({"success": False, "message": f"カレンダー操作でエラーが発生しました: {e}"})


def _parse_event(event: dict) -> dict:
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


@tool
def calendar_list_events(
    date_from: str = "",
    date_to: str = "",
) -> str:
    """List Google Calendar events for a date or date range.

    Args:
        date_from: Start date (YYYY-MM-DD). For a single day, set same value as date_to. Defaults to today.
        date_to: End date (YYYY-MM-DD). For a single day, set same value as date_from. Defaults to date_from.

    Returns:
        JSON with events list, count, and message.
    """
    try:
        service = get_calendar_service()

        if not date_from:
            date_from = datetime.now(JST).strftime("%Y-%m-%d")
        if not date_to:
            date_to = date_from

        time_min = f"{date_from}T00:00:00+09:00"
        time_max = f"{date_to}T23:59:59+09:00"

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
        return json.dumps({
            "events": events,
            "count": len(events),
            "message": f"{len(events)}件の予定が見つかりました。" if events else "予定はありません。",
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_google_error(e)
    except Exception as e:
        logger.exception("calendar_list_events error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def calendar_check_availability(
    date_from: str = "",
    date_to: str = "",
    time_from: str = "09:00",
    time_to: str = "18:00",
) -> str:
    """Check availability on Google Calendar for a date or date range.

    Args:
        date_from: Start date (YYYY-MM-DD). Defaults to today.
        date_to: End date (YYYY-MM-DD). Defaults to date_from (single day check).
        time_from: Start time to check (HH:MM). Default "09:00".
        time_to: End time to check (HH:MM). Default "18:00".

    Returns:
        JSON with availability status, busy slots, and message.
    """
    try:
        service = get_calendar_service()

        if not date_from:
            date_from = datetime.now(JST).strftime("%Y-%m-%d")
        if not date_to:
            date_to = date_from

        if date_from == date_to:
            # Single day: freebusy check
            time_min = f"{date_from}T{time_from}:00+09:00"
            time_max = f"{date_from}T{time_to}:00+09:00"
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
                f"{date_from} {time_from}〜{time_to}は空いています。"
                if available
                else f"{date_from} {time_from}〜{time_to}には{len(busy)}件の予定があります。"
            )
            return json.dumps({"available": available, "busy_slots": busy_slots, "message": msg}, ensure_ascii=False)

        else:
            # Range: find free days
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
            return json.dumps({
                "free_days": free_days,
                "count": len(free_days),
                "message": f"{len(free_days)}日の空き日があります。" if free_days else "指定期間に空き日はありません。",
            }, ensure_ascii=False)

    except HttpError as e:
        return _handle_google_error(e)
    except Exception as e:
        logger.exception("calendar_check_availability error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def calendar_create_event(
    title: str,
    start: str,
    end: str = "",
    location: str = "",
    description: str = "",
) -> str:
    """Create a new Google Calendar event.

    Args:
        title: Event title (required).
        start: Start time in ISO format (YYYY-MM-DD for all-day, YYYY-MM-DDTHH:MM for timed events).
        end: End time in ISO format. If empty, defaults to 1 hour after start for timed events.
        location: Event location (optional).
        description: Event description (optional).

    Returns:
        JSON with created event details and success message.
    """
    try:
        service = get_calendar_service()

        if not title.strip():
            return json.dumps({"success": False, "message": "title は必須です。"}, ensure_ascii=False)
        if not start:
            return json.dumps({"success": False, "message": "start は必須です。"}, ensure_ascii=False)

        is_all_day = len(start) == 10  # YYYY-MM-DD
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

        if location:
            body["location"] = location
        if description:
            body["description"] = description

        created = service.events().insert(calendarId=CALENDAR_ID, body=body).execute()
        return json.dumps({
            "success": True,
            "event": _parse_event(created),
            "message": f"予定「{title}」を登録しました。",
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_google_error(e)
    except Exception as e:
        logger.exception("calendar_create_event error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def calendar_update_event(
    event_id: str,
    title: str = "",
    start: str = "",
    end: str = "",
    location: str = "",
    description: str = "",
) -> str:
    """Update an existing Google Calendar event.

    Args:
        event_id: The event ID to update (required).
        title: New title (leave empty to keep current).
        start: New start time in ISO format (leave empty to keep current).
        end: New end time in ISO format (leave empty to keep current).
        location: New location (leave empty to keep current).
        description: New description (leave empty to keep current).

    Returns:
        JSON with updated event details and success message.
    """
    try:
        service = get_calendar_service()

        if not event_id:
            return json.dumps({"success": False, "message": "event_id は必須です。"}, ensure_ascii=False)

        existing = service.events().get(calendarId=CALENDAR_ID, eventId=event_id).execute()

        if title:
            existing["summary"] = title
        if start:
            if len(start) == 10:
                existing["start"] = {"date": start}
            else:
                if "+" not in start and "Z" not in start:
                    start += "+09:00"
                existing["start"] = {"dateTime": start, "timeZone": TIMEZONE}
        if end:
            if len(end) == 10:
                existing["end"] = {"date": end}
            else:
                if "+" not in end and "Z" not in end:
                    end += "+09:00"
                existing["end"] = {"dateTime": end, "timeZone": TIMEZONE}
        if location:
            existing["location"] = location
        if description:
            existing["description"] = description

        updated = (
            service.events()
            .update(calendarId=CALENDAR_ID, eventId=event_id, body=existing)
            .execute()
        )
        return json.dumps({
            "success": True,
            "event": _parse_event(updated),
            "message": f"予定「{updated.get('summary', '')}」を更新しました。",
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_google_error(e)
    except Exception as e:
        logger.exception("calendar_update_event error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def calendar_delete_event(event_id: str) -> str:
    """Delete a Google Calendar event.

    Args:
        event_id: The event ID to delete (required).

    Returns:
        JSON with success status and message.
    """
    try:
        service = get_calendar_service()

        if not event_id:
            return json.dumps({"success": False, "message": "event_id は必須です。"}, ensure_ascii=False)

        try:
            existing = service.events().get(calendarId=CALENDAR_ID, eventId=event_id).execute()
            title = existing.get("summary", "(タイトルなし)")
        except HttpError:
            return json.dumps({"success": False, "message": "指定された予定が見つかりません。"}, ensure_ascii=False)

        service.events().delete(calendarId=CALENDAR_ID, eventId=event_id).execute()
        return json.dumps({"success": True, "message": f"予定「{title}」を削除しました。"}, ensure_ascii=False)
    except HttpError as e:
        return _handle_google_error(e)
    except Exception as e:
        logger.exception("calendar_delete_event error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


@tool
def calendar_suggest_schedule(
    date_from: str,
    date_to: str,
    duration_minutes: int = 60,
    preferred_time_from: str = "09:00",
    preferred_time_to: str = "18:00",
) -> str:
    """Suggest available time slots in a date range based on calendar availability.

    Args:
        date_from: Start date for search range (YYYY-MM-DD, required).
        date_to: End date for search range (YYYY-MM-DD, required).
        duration_minutes: Required duration in minutes. Default 60.
        preferred_time_from: Earliest preferred time (HH:MM). Default "09:00".
        preferred_time_to: Latest preferred end time (HH:MM). Default "18:00".

    Returns:
        JSON with suggested time slots (up to 5), count, and message.
    """
    try:
        service = get_calendar_service()

        if not date_from or not date_to:
            return json.dumps({"success": False, "message": "date_from と date_to は必須です。"}, ensure_ascii=False)

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
            {"start": datetime.fromisoformat(p["start"]), "end": datetime.fromisoformat(p["end"])}
            for p in busy_periods
        ]

        suggestions = []
        start_date = datetime.strptime(date_from, "%Y-%m-%d").date()
        end_date = datetime.strptime(date_to, "%Y-%m-%d").date()
        duration = timedelta(minutes=duration_minutes)
        pref_h_from, pref_m_from = map(int, preferred_time_from.split(":"))
        pref_h_to, pref_m_to = map(int, preferred_time_to.split(":"))

        current_date = start_date
        while current_date <= end_date and len(suggestions) < 5:
            slot_start = datetime(
                current_date.year, current_date.month, current_date.day,
                pref_h_from, pref_m_from, tzinfo=JST,
            )
            day_end = datetime(
                current_date.year, current_date.month, current_date.day,
                pref_h_to, pref_m_to, tzinfo=JST,
            )
            while slot_start + duration <= day_end and len(suggestions) < 5:
                slot_end = slot_start + duration
                conflict = None
                for b in busy:
                    if slot_start < b["end"] and slot_end > b["start"]:
                        conflict = b
                        break
                if conflict is None:
                    suggestions.append({
                        "date": current_date.strftime("%Y-%m-%d"),
                        "start": slot_start.isoformat(),
                        "end": slot_end.isoformat(),
                    })
                    slot_start = slot_end
                else:
                    slot_start = conflict["end"]
            current_date += timedelta(days=1)

        return json.dumps({
            "suggestions": suggestions,
            "count": len(suggestions),
            "message": f"{len(suggestions)}件の候補が見つかりました。" if suggestions else "指定条件で空き枠が見つかりませんでした。",
        }, ensure_ascii=False)
    except HttpError as e:
        return _handle_google_error(e)
    except Exception as e:
        logger.exception("calendar_suggest_schedule error")
        return json.dumps({"success": False, "message": f"エラーが発生しました: {e}"}, ensure_ascii=False)


# All calendar tools for easy import
CALENDAR_TOOLS = [
    calendar_list_events,
    calendar_check_availability,
    calendar_create_event,
    calendar_update_event,
    calendar_delete_event,
    calendar_suggest_schedule,
]
