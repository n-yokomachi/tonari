"""
AgentCore Gateway Task Tool Lambda

Tools:
- list_tasks: List active tasks with optional deadline filter
- add_task: Add a new task
- complete_task: Mark a task as completed
- update_task: Update task title or due date
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

JST = timezone(timedelta(hours=9))
TTL_DAYS = 30


def handler(event, context):
    """Dispatch to the appropriate tool function based on event fields."""
    if "task_id" in event and "title" not in event and "due_date" not in event:
        return complete_task(event)
    if "task_id" in event:
        return update_task(event)
    if "title" in event:
        return add_task(event)
    return list_tasks(event)


def list_tasks(event):
    """List active tasks with optional deadline filter."""
    include_completed = event.get("include_completed", False)
    days_until_due = event.get("days_until_due")

    result = table.scan()
    items = result.get("Items", [])

    if not include_completed:
        items = [item for item in items if not item.get("completed", False)]

    if days_until_due is not None:
        now = datetime.now(JST).date()
        cutoff = now + timedelta(days=int(days_until_due))
        items = [
            item
            for item in items
            if item.get("dueDate")
            and datetime.strptime(item["dueDate"], "%Y-%m-%d").date() <= cutoff
        ]

    items.sort(key=lambda x: x.get("sortOrder", 0))

    tasks = [
        {
            "taskId": item.get("taskId"),
            "title": item.get("title"),
            "dueDate": item.get("dueDate"),
            "sortOrder": int(item.get("sortOrder", 0)),
            "completed": item.get("completed", False),
            "createdAt": item.get("createdAt"),
        }
        for item in items
    ]

    return {
        "tasks": tasks,
        "count": len(tasks),
        "message": f"{len(tasks)}件のタスクが見つかりました。"
        if tasks
        else "タスクはありません。",
    }


def add_task(event):
    """Add a new task."""
    title = event.get("title", "").strip()
    if not title:
        return {"success": False, "message": "title は必須です。"}

    # Get max sortOrder
    result = table.scan(
        ProjectionExpression="sortOrder",
        FilterExpression="completed = :false",
        ExpressionAttributeValues={":false": False},
    )
    items = result.get("Items", [])
    max_order = max((int(item.get("sortOrder", 0)) for item in items), default=-1)

    now = datetime.now(JST).isoformat()
    task_id = str(uuid.uuid4())

    item = {
        "taskId": task_id,
        "title": title,
        "sortOrder": max_order + 1,
        "completed": False,
        "createdAt": now,
    }

    due_date = event.get("due_date")
    if due_date:
        item["dueDate"] = due_date

    table.put_item(Item=item)

    return {
        "success": True,
        "task": {
            "taskId": task_id,
            "title": title,
            "dueDate": due_date,
            "createdAt": now,
        },
        "message": f"タスク「{title}」を追加しました。",
    }


def complete_task(event):
    """Mark a task as completed."""
    task_id = event.get("task_id", "")
    if not task_id:
        return {"success": False, "message": "task_id は必須です。"}

    result = table.get_item(Key={"taskId": task_id})
    item = result.get("Item")

    if not item:
        return {"success": False, "message": "タスクが見つかりません。"}

    now = datetime.now(JST)
    ttl_timestamp = int((now + timedelta(days=TTL_DAYS)).timestamp())

    table.update_item(
        Key={"taskId": task_id},
        UpdateExpression="SET completed = :c, completedAt = :ca, #ttl = :ttl",
        ExpressionAttributeNames={"#ttl": "ttl"},
        ExpressionAttributeValues={
            ":c": True,
            ":ca": now.isoformat(),
            ":ttl": ttl_timestamp,
        },
    )

    return {
        "success": True,
        "message": f"タスク「{item.get('title')}」を完了しました。",
    }


def update_task(event):
    """Update task title or due date."""
    task_id = event.get("task_id", "")
    if not task_id:
        return {"success": False, "message": "task_id は必須です。"}

    result = table.get_item(Key={"taskId": task_id})
    item = result.get("Item")

    if not item:
        return {"success": False, "message": "タスクが見つかりません。"}

    update_parts = []
    expr_names = {}
    expr_values = {}

    title = event.get("title")
    if title:
        update_parts.append("#t = :title")
        expr_names["#t"] = "title"
        expr_values[":title"] = title.strip()

    due_date = event.get("due_date")
    if due_date is not None:
        if due_date == "":
            # Remove due date
            update_parts.append("REMOVE dueDate")
        else:
            update_parts.append("dueDate = :dueDate")
            expr_values[":dueDate"] = due_date

    if not update_parts:
        return {"success": False, "message": "更新するフィールドがありません。"}

    set_parts = [p for p in update_parts if not p.startswith("REMOVE")]
    remove_parts = [
        p.replace("REMOVE ", "") for p in update_parts if p.startswith("REMOVE")
    ]

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
    updated = result["Attributes"]

    return {
        "success": True,
        "task": {
            "taskId": updated.get("taskId"),
            "title": updated.get("title"),
            "dueDate": updated.get("dueDate"),
        },
        "message": f"タスク「{updated.get('title')}」を更新しました。",
    }
