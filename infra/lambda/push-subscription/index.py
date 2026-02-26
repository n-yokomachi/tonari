"""
Push Subscription CRUD API Lambda

エンドポイント:
- POST /push-subscription - サブスクリプション登録
- DELETE /push-subscription - サブスクリプション削除
"""
import json
import os
from datetime import datetime

import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])


def response(status_code: int, body: dict) -> dict:
    """API Gateway形式のレスポンスを生成"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
        },
        'body': json.dumps(body, ensure_ascii=False),
    }


def save_subscription(body: dict) -> dict:
    """Push Subscriptionを保存"""
    subscription = body.get('subscription')

    if not subscription:
        return response(400, {'error': 'subscription is required'})

    endpoint = subscription.get('endpoint')
    keys = subscription.get('keys', {})
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')

    if not endpoint or not p256dh or not auth:
        return response(400, {'error': 'Invalid subscription data'})

    table.put_item(
        Item={
            'userId': 'tonari-owner',
            'endpoint': endpoint,
            'p256dh': p256dh,
            'auth': auth,
            'createdAt': datetime.utcnow().isoformat() + 'Z',
        }
    )

    return response(200, {'success': True})


def delete_subscription(body: dict) -> dict:
    """Push Subscriptionを削除"""
    endpoint = body.get('endpoint')

    if not endpoint:
        return response(400, {'error': 'endpoint is required'})

    table.delete_item(
        Key={
            'userId': 'tonari-owner',
            'endpoint': endpoint,
        }
    )

    return response(200, {'success': True})


def handler(event, context):
    """Lambda handler"""
    http_method = event.get(
        'httpMethod',
        event.get('requestContext', {}).get('http', {}).get('method'),
    )

    if http_method == 'OPTIONS':
        return response(200, {})

    try:
        body = json.loads(event.get('body', '{}'))
    except (json.JSONDecodeError, TypeError):
        return response(400, {'error': 'Invalid JSON body'})

    if http_method == 'POST':
        return save_subscription(body)

    if http_method == 'DELETE':
        return delete_subscription(body)

    return response(405, {'error': 'Method not allowed'})
