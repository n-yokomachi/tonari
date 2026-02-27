"""
News CRUD API Lambda

Endpoints:
- GET /news - Get latest news for tonari-owner
- DELETE /news - Delete news record (mark as read)
"""
import json
import os

import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

USER_ID = "tonari-owner"


def response(status_code: int, body: dict) -> dict:
    """Build API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,DELETE,OPTIONS",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def get_news() -> dict:
    """Get the latest news record."""
    result = table.get_item(Key={"userId": USER_ID})
    item = result.get("Item")

    if not item:
        return response(200, {"news": None})

    return response(
        200,
        {
            "news": {
                "summary": item.get("summary", ""),
                "updatedAt": item.get("updatedAt", ""),
            }
        },
    )


def delete_news() -> dict:
    """Delete the news record (mark as read)."""
    table.delete_item(Key={"userId": USER_ID})
    return response(200, {"message": "ok"})


def handler(event, context):
    """Lambda handler."""
    http_method = event.get(
        "httpMethod", event.get("requestContext", {}).get("http", {}).get("method")
    )

    if http_method == "OPTIONS":
        return response(200, {})

    if http_method == "GET":
        return get_news()

    if http_method == "DELETE":
        return delete_news()

    return response(400, {"error": "Invalid request"})
