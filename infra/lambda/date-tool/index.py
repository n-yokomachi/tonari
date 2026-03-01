"""Date utility tool for accurate date calculations.

Provides reliable date arithmetic that LLMs cannot perform accurately,
such as "2 weeks from now", "next Monday", or "every Tuesday in March".
All dates are calculated in JST (Asia/Tokyo).
"""

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger()
logger.setLevel(logging.INFO)

JST = ZoneInfo("Asia/Tokyo")

WEEKDAY_NAMES_JA = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"]
WEEKDAY_MAP = {
    "月": 0, "月曜": 0, "月曜日": 0, "monday": 0, "mon": 0,
    "火": 1, "火曜": 1, "火曜日": 1, "tuesday": 1, "tue": 1,
    "水": 2, "水曜": 2, "水曜日": 2, "wednesday": 2, "wed": 2,
    "木": 3, "木曜": 3, "木曜日": 3, "thursday": 3, "thu": 3,
    "金": 4, "金曜": 4, "金曜日": 4, "friday": 4, "fri": 4,
    "土": 5, "土曜": 5, "土曜日": 5, "saturday": 5, "sat": 5,
    "日": 6, "日曜": 6, "日曜日": 6, "sunday": 6, "sun": 6,
}


def _today():
    """Get today's date in JST."""
    return datetime.now(JST).date()


def _format_date(d):
    """Format a date with day-of-week info."""
    return {
        "date": d.isoformat(),
        "weekday": WEEKDAY_NAMES_JA[d.weekday()],
        "weekday_number": d.weekday(),
    }


def _parse_weekday(name):
    """Parse a weekday name (Japanese or English) to Monday=0 index."""
    key = name.strip().lower()
    if key in WEEKDAY_MAP:
        return WEEKDAY_MAP[key]
    return None


def handler(event, context):
    """Dispatch to the appropriate tool function based on event fields."""
    try:
        if "start_date" in event and "end_date" in event and "weekday" in event:
            return list_dates_in_range(event)
        if any(k in event for k in ("offset_days", "offset_weeks", "offset_months")):
            return calculate_date(event)
        return get_current_datetime(event)
    except Exception as e:
        logger.exception("Unexpected error")
        return {"success": False, "message": f"日付計算でエラーが発生しました: {str(e)}"}


def get_current_datetime(event):
    """Return current JST date, time, day of week, and week number."""
    now = datetime.now(JST)
    today = now.date()
    iso_year, iso_week, _ = today.isocalendar()

    return {
        "success": True,
        "current": {
            "date": today.isoformat(),
            "time": now.strftime("%H:%M"),
            "weekday": WEEKDAY_NAMES_JA[today.weekday()],
            "weekday_number": today.weekday(),
            "iso_week": iso_week,
            "iso_year": iso_year,
        },
        "message": f"現在は {today.isoformat()}（{WEEKDAY_NAMES_JA[today.weekday()]}）{now.strftime('%H:%M')} です。第{iso_week}週。",
    }


def calculate_date(event):
    """Calculate a date by adding/subtracting days, weeks, or months from a base date."""
    base_str = event.get("base_date")
    if base_str:
        try:
            base = datetime.strptime(base_str, "%Y-%m-%d").date()
        except ValueError:
            return {"success": False, "message": f"日付の形式が正しくありません: {base_str}（YYYY-MM-DD形式で指定してください）"}
    else:
        base = _today()

    original_base = base

    offset_days = int(event.get("offset_days", 0))
    offset_weeks = int(event.get("offset_weeks", 0))
    offset_months = int(event.get("offset_months", 0))

    # Month offset: move month, clamp day to valid range
    if offset_months != 0:
        import calendar
        year = base.year
        month = base.month + offset_months
        while month > 12:
            year += 1
            month -= 12
        while month < 1:
            year -= 1
            month += 12
        max_day = calendar.monthrange(year, month)[1]
        day = min(base.day, max_day)
        base = base.replace(year=year, month=month, day=day)

    total_days = offset_days + (offset_weeks * 7)
    result_date = base + timedelta(days=total_days)

    # Build description
    parts = []
    if offset_weeks:
        parts.append(f"{abs(offset_weeks)}週間{'後' if offset_weeks > 0 else '前'}")
    if offset_days:
        parts.append(f"{abs(offset_days)}日{'後' if offset_days > 0 else '前'}")
    if offset_months:
        parts.append(f"{abs(offset_months)}ヶ月{'後' if offset_months > 0 else '前'}")
    offset_desc = "・".join(parts) if parts else "同日"

    return {
        "success": True,
        "base_date": _format_date(original_base),
        "result": _format_date(result_date),
        "offset": {"days": offset_days, "weeks": offset_weeks, "months": offset_months},
        "message": f"{event.get('base_date', '今日')}の{offset_desc}は {result_date.isoformat()}（{WEEKDAY_NAMES_JA[result_date.weekday()]}）です。",
    }


def list_dates_in_range(event):
    """List all dates matching a specific weekday within a date range."""
    try:
        start = datetime.strptime(event["start_date"], "%Y-%m-%d").date()
        end = datetime.strptime(event["end_date"], "%Y-%m-%d").date()
    except ValueError as e:
        return {"success": False, "message": f"日付の形式が正しくありません（YYYY-MM-DD形式で指定してください）: {e}"}

    if start > end:
        return {"success": False, "message": "開始日が終了日より後になっています。"}

    if (end - start).days > 366:
        return {"success": False, "message": "検索範囲は1年以内にしてください。"}

    weekday_num = _parse_weekday(event["weekday"])
    if weekday_num is None:
        return {"success": False, "message": f"曜日が認識できません: {event['weekday']}（月〜日、または Monday〜Sunday で指定してください）"}

    dates = []
    current = start
    while current <= end:
        if current.weekday() == weekday_num:
            dates.append(_format_date(current))
        current += timedelta(days=1)

    weekday_name = WEEKDAY_NAMES_JA[weekday_num]
    return {
        "success": True,
        "weekday": weekday_name,
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "dates": dates,
        "count": len(dates),
        "message": f"{start.isoformat()} 〜 {end.isoformat()} の{weekday_name}は {len(dates)} 日あります。",
    }
