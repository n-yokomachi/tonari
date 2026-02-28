"""
Task CRUD API Lambda

Endpoints:
- GET /tasks - List active tasks (query param: includeCompleted=true for all)
- POST /tasks - Create a new task
- GET /tasks/{taskId} - Get a single task
- PUT /tasks/{taskId} - Update a task
- DELETE /tasks/{taskId} - Delete a task
- PUT /tasks/reorder - Reorder tasks
"""
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

JST = timezone(timedelta(hours=9))
TTL_DAYS = 30


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body, ensure_ascii=False, cls=DecimalEncoder),
    }


def list_tasks(event) -> dict:
    query_params = event.get("queryStringParameters") or {}
    include_completed = query_params.get("includeCompleted") == "true"

    result = table.scan()
    items = result.get("Items", [])

    if not include_completed:
        items = [item for item in items if not item.get("completed", False)]

    items.sort(key=lambda x: x.get("sortOrder", 0))

    tasks = [_format_task(item) for item in items]
    return response(200, {"tasks": tasks})


def get_task(task_id: str) -> dict:
    result = table.get_item(Key={"taskId": task_id})
    item = result.get("Item")

    if not item:
        return response(404, {"error": "Task not found"})

    return response(200, {"task": _format_task(item)})


def create_task(event) -> dict:
    body = json.loads(event.get("body", "{}"))
    title = body.get("title", "").strip()

    if not title:
        return response(400, {"error": "title is required"})

    # Get max sortOrder
    result = table.scan(
        ProjectionExpression="sortOrder",
        FilterExpression="completed = :false",
        ExpressionAttributeValues={":false": False},
    )
    items = result.get("Items", [])
    max_order = max((item.get("sortOrder", 0) for item in items), default=-1)

    now = datetime.now(JST).isoformat()
    task_id = str(uuid.uuid4())

    item = {
        "taskId": task_id,
        "title": title,
        "sortOrder": max_order + 1,
        "completed": False,
        "createdAt": now,
    }

    due_date = body.get("dueDate")
    if due_date:
        item["dueDate"] = due_date

    table.put_item(Item=item)
    return response(201, {"task": _format_task(item)})


def update_task(task_id: str, event) -> dict:
    result = table.get_item(Key={"taskId": task_id})
    item = result.get("Item")

    if not item:
        return response(404, {"error": "Task not found"})

    body = json.loads(event.get("body", "{}"))

    update_expr_parts = []
    expr_names = {}
    expr_values = {}

    if "title" in body:
        update_expr_parts.append("#t = :title")
        expr_names["#t"] = "title"
        expr_values[":title"] = body["title"].strip()

    if "dueDate" in body:
        if body["dueDate"] is None:
            update_expr_parts.append("REMOVE dueDate")
        else:
            update_expr_parts.append("dueDate = :dueDate")
            expr_values[":dueDate"] = body["dueDate"]

    if "completed" in body:
        update_expr_parts.append("completed = :completed")
        expr_values[":completed"] = body["completed"]

        if body["completed"]:
            now = datetime.now(JST)
            ttl_timestamp = int((now + timedelta(days=TTL_DAYS)).timestamp())
            update_expr_parts.append("completedAt = :completedAt")
            update_expr_parts.append("#ttl = :ttl")
            expr_values[":completedAt"] = now.isoformat()
            expr_values[":ttl"] = ttl_timestamp
            expr_names["#ttl"] = "ttl"

    if "sortOrder" in body:
        update_expr_parts.append("sortOrder = :sortOrder")
        expr_values[":sortOrder"] = body["sortOrder"]

    if not update_expr_parts:
        return response(400, {"error": "No fields to update"})

    # Separate SET and REMOVE clauses
    set_parts = [p for p in update_expr_parts if not p.startswith("REMOVE")]
    remove_parts = [p.replace("REMOVE ", "") for p in update_expr_parts if p.startswith("REMOVE")]

    update_expr = ""
    if set_parts:
        update_expr += "SET " + ", ".join(set_parts)
    if remove_parts:
        update_expr += " REMOVE " + ", ".join(remove_parts)

    update_kwargs = {
        "Key": {"taskId": task_id},
        "UpdateExpression": update_expr,
        "ReturnValues": "ALL_NEW",
    }
    if expr_names:
        update_kwargs["ExpressionAttributeNames"] = expr_names
    if expr_values:
        update_kwargs["ExpressionAttributeValues"] = expr_values

    result = table.update_item(**update_kwargs)
    return response(200, {"task": _format_task(result["Attributes"])})


def delete_task(task_id: str) -> dict:
    result = table.get_item(Key={"taskId": task_id})
    if not result.get("Item"):
        return response(404, {"error": "Task not found"})

    table.delete_item(Key={"taskId": task_id})
    return response(200, {"success": True})


def reorder_tasks(event) -> dict:
    body = json.loads(event.get("body", "{}"))
    task_ids = body.get("taskIds", [])

    if not task_ids:
        return response(400, {"error": "taskIds is required"})

    with table.batch_writer() as batch:
        for index, task_id in enumerate(task_ids):
            batch.put_item(
                Item={
                    **table.get_item(Key={"taskId": task_id}).get("Item", {}),
                    "sortOrder": index,
                }
            )

    return response(200, {"success": True})


def _format_task(item: dict) -> dict:
    return {
        "taskId": item.get("taskId"),
        "title": item.get("title"),
        "dueDate": item.get("dueDate"),
        "sortOrder": item.get("sortOrder", 0),
        "completed": item.get("completed", False),
        "createdAt": item.get("createdAt"),
        "completedAt": item.get("completedAt"),
    }


def handler(event, context):
    http_method = event.get(
        "httpMethod",
        event.get("requestContext", {}).get("http", {}).get("method"),
    )
    path_parameters = event.get("pathParameters") or {}
    resource = event.get("resource", "")

    if http_method == "OPTIONS":
        return response(200, {})

    task_id = path_parameters.get("taskId")

    if http_method == "GET" and task_id:
        return get_task(task_id)

    if http_method == "GET":
        return list_tasks(event)

    if http_method == "POST":
        return create_task(event)

    if http_method == "PUT" and "reorder" in resource:
        return reorder_tasks(event)

    if http_method == "PUT" and task_id:
        return update_task(task_id, event)

    if http_method == "DELETE" and task_id:
        return delete_task(task_id)

    return response(400, {"error": "Invalid request"})
