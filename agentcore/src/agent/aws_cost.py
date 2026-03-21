"""AWS Cost Explorer tool for Strands Agent.

Runtime 側で IAM 権限を使ってコストデータを取得する。
取得したデータは execute_python (Code Interpreter) でグラフ化できる。
"""

import json
import logging
import os
from datetime import datetime, timedelta

import boto3
from strands import tool

logger = logging.getLogger(__name__)

# モジュールロード時に CE クライアントを即時初期化（STS クレデンシャル取得を前倒し）
_ce_client = boto3.client(
    "ce", region_name=os.getenv("AWS_REGION", "ap-northeast-1")
)
logger.info("Cost Explorer client initialized")


@tool
def get_aws_cost(
    period: str = "monthly",
    months: int = 1,
    group_by_service: bool = True,
) -> str:
    """Retrieve AWS cost data from Cost Explorer.

    Use this tool to fetch cost data. Then pass the result to execute_python
    to create matplotlib charts for visualization.

    Args:
        period: Granularity - "monthly" or "daily".
        months: Number of months to look back (default: 1, max: 6).
        group_by_service: If True, break down costs by AWS service.

    Returns:
        JSON string with cost data.
    """
    ce = _ce_client

    now = datetime.utcnow()
    end = now.strftime("%Y-%m-%d")
    months = min(max(months, 1), 6)
    start = (now - timedelta(days=30 * months)).replace(day=1).strftime("%Y-%m-%d")

    granularity = "MONTHLY" if period == "monthly" else "DAILY"

    try:
        kwargs = {
            "TimePeriod": {"Start": start, "End": end},
            "Granularity": granularity,
            "Metrics": ["UnblendedCost"],
        }
        if group_by_service:
            kwargs["GroupBy"] = [{"Type": "DIMENSION", "Key": "SERVICE"}]

        response = ce.get_cost_and_usage(**kwargs)
        results = response.get("ResultsByTime", [])

        if group_by_service:
            data = []
            for r in results:
                services = {}
                for group in r.get("Groups", []):
                    amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
                    if amount > 0.01:
                        services[group["Keys"][0]] = round(amount, 2)
                data.append({
                    "start": r["TimePeriod"]["Start"],
                    "end": r["TimePeriod"]["End"],
                    "total": round(sum(services.values()), 2),
                    "services": services,
                })
        else:
            data = [
                {
                    "start": r["TimePeriod"]["Start"],
                    "end": r["TimePeriod"]["End"],
                    "total": round(float(r["Total"]["UnblendedCost"]["Amount"]), 2),
                }
                for r in results
            ]

        return json.dumps({
            "granularity": granularity,
            "start": start,
            "end": end,
            "data": data,
        }, ensure_ascii=False)

    except Exception as e:
        logger.error("Cost Explorer error: %s", e, exc_info=True)
        return json.dumps({"error": str(e)})
