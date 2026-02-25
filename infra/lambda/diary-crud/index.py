"""
日記データCRUD API Lambda

エンドポイント:
- GET /diaries - 一覧取得
- GET /diaries/{date} - 単一取得
"""
import json
import os

import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

DEFAULT_USER_ID = 'default_user'


def response(status_code: int, body: dict) -> dict:
    """API Gateway形式のレスポンスを生成"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
        },
        'body': json.dumps(body, ensure_ascii=False),
    }


def list_diaries() -> dict:
    """日記一覧を取得"""
    result = table.query(
        KeyConditionExpression=Key('userId').eq(DEFAULT_USER_ID),
        ScanIndexForward=False,
    )
    items = result.get('Items', [])

    diaries = [
        {
            'date': item.get('date'),
            'body': item.get('body', ''),
            'createdAt': item.get('createdAt'),
        }
        for item in items
    ]

    return response(200, {'diaries': diaries})


def get_diary(date: str) -> dict:
    """単一の日記を取得"""
    result = table.get_item(
        Key={'userId': DEFAULT_USER_ID, 'date': date}
    )
    item = result.get('Item')

    if not item:
        return response(404, {'error': '日記が見つかりません'})

    return response(200, {
        'diary': {
            'date': item.get('date'),
            'body': item.get('body', ''),
            'createdAt': item.get('createdAt'),
        }
    })


def handler(event, context):
    """Lambda ハンドラー"""
    http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method'))
    path_parameters = event.get('pathParameters') or {}

    if http_method == 'OPTIONS':
        return response(200, {})

    date = path_parameters.get('date')

    if http_method == 'GET' and date:
        return get_diary(date)

    if http_method == 'GET':
        return list_diaries()

    return response(400, {'error': 'Invalid request'})
