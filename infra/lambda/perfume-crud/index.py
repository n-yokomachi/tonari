"""
香水データCRUD API Lambda

エンドポイント:
- GET /perfumes - 一覧取得
- POST /perfumes - 新規作成
- GET /perfumes/{brand}/{name} - 単一取得
- PUT /perfumes/{brand}/{name} - 更新
- DELETE /perfumes/{brand}/{name} - 削除
"""
import json
import os
from datetime import datetime
from decimal import Decimal
from urllib.parse import unquote

import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])


class DecimalEncoder(json.JSONEncoder):
    """DynamoDBのDecimal型をJSON変換"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def response(status_code: int, body: dict) -> dict:
    """API Gateway形式のレスポンスを生成"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        'body': json.dumps(body, cls=DecimalEncoder, ensure_ascii=False),
    }


def list_perfumes() -> dict:
    """香水一覧を取得"""
    result = table.scan()
    items = result.get('Items', [])

    # updatedAtの降順でソート
    items.sort(key=lambda x: x.get('updatedAt', ''), reverse=True)

    perfumes = [
        {
            'brand': item.get('brand'),
            'name': item.get('name'),
            'country': item.get('country', ''),
            'topNotes': item.get('topNotes', []),
            'middleNotes': item.get('middleNotes', []),
            'baseNotes': item.get('baseNotes', []),
            'scenes': item.get('scenes', []),
            'seasons': item.get('seasons', []),
            'impression': item.get('impression', ''),
            'rating': item.get('rating', 0),
            'createdAt': item.get('createdAt'),
            'updatedAt': item.get('updatedAt'),
        }
        for item in items
    ]

    return response(200, {'perfumes': perfumes})


def get_perfume(brand: str, name: str) -> dict:
    """単一の香水を取得"""
    result = table.get_item(Key={'brand': brand, 'name': name})
    item = result.get('Item')

    if not item:
        return response(404, {'error': 'データが見つかりません'})

    return response(200, {
        'perfume': {
            'brand': item.get('brand'),
            'name': item.get('name'),
            'country': item.get('country', ''),
            'topNotes': item.get('topNotes', []),
            'middleNotes': item.get('middleNotes', []),
            'baseNotes': item.get('baseNotes', []),
            'scenes': item.get('scenes', []),
            'seasons': item.get('seasons', []),
            'impression': item.get('impression', ''),
            'rating': item.get('rating', 0),
            'createdAt': item.get('createdAt'),
            'updatedAt': item.get('updatedAt'),
        }
    })


def create_perfume(body: dict) -> dict:
    """香水を新規作成"""
    brand = body.get('brand')
    name = body.get('name')

    if not brand or not name:
        return response(400, {'error': 'ブランド名と商品名は必須です'})

    now = datetime.utcnow().isoformat() + 'Z'

    item = {
        'brand': brand,
        'name': name,
        'country': body.get('country', ''),
        'topNotes': body.get('topNotes', []),
        'middleNotes': body.get('middleNotes', []),
        'baseNotes': body.get('baseNotes', []),
        'scenes': body.get('scenes', []),
        'seasons': body.get('seasons', []),
        'impression': body.get('impression', ''),
        'rating': body.get('rating', 0),
        'createdAt': now,
        'updatedAt': now,
    }

    table.put_item(Item=item)

    return response(201, {'perfume': item})


def update_perfume(brand: str, name: str, body: dict) -> dict:
    """香水を更新"""
    # 既存データの確認
    result = table.get_item(Key={'brand': brand, 'name': name})
    existing = result.get('Item')

    if not existing:
        return response(404, {'error': 'データが見つかりません'})

    now = datetime.utcnow().isoformat() + 'Z'

    item = {
        'brand': brand,
        'name': name,
        'country': body.get('country', existing.get('country', '')),
        'topNotes': body.get('topNotes', existing.get('topNotes', [])),
        'middleNotes': body.get('middleNotes', existing.get('middleNotes', [])),
        'baseNotes': body.get('baseNotes', existing.get('baseNotes', [])),
        'scenes': body.get('scenes', existing.get('scenes', [])),
        'seasons': body.get('seasons', existing.get('seasons', [])),
        'impression': body.get('impression', existing.get('impression', '')),
        'rating': body.get('rating', existing.get('rating', 0)),
        'createdAt': body.get('createdAt', existing.get('createdAt', now)),
        'updatedAt': now,
    }

    table.put_item(Item=item)

    return response(200, {'perfume': item})


def delete_perfume(brand: str, name: str) -> dict:
    """香水を削除"""
    table.delete_item(Key={'brand': brand, 'name': name})
    return response(200, {'success': True})


def handler(event, context):
    """Lambda ハンドラー"""
    http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method'))
    path = event.get('path', event.get('rawPath', ''))
    path_parameters = event.get('pathParameters') or {}

    # OPTIONSリクエスト（CORS preflight）
    if http_method == 'OPTIONS':
        return response(200, {})

    # パスパラメータをデコード
    brand = unquote(path_parameters.get('brand', '')) if path_parameters.get('brand') else None
    name = unquote(path_parameters.get('name', '')) if path_parameters.get('name') else None

    # ルーティング
    if http_method == 'GET' and not brand:
        return list_perfumes()

    if http_method == 'GET' and brand and name:
        return get_perfume(brand, name)

    if http_method == 'POST':
        body = json.loads(event.get('body', '{}'))
        return create_perfume(body)

    if http_method == 'PUT' and brand and name:
        body = json.loads(event.get('body', '{}'))
        return update_perfume(brand, name, body)

    if http_method == 'DELETE' and brand and name:
        return delete_perfume(brand, name)

    return response(400, {'error': 'Invalid request'})
