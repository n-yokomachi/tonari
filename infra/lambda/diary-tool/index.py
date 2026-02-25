"""
AgentCore Gateway から呼び出される日記ツールLambda

Tools:
- save_diary: 日記を保存する
- get_diaries: 日記一覧を取得する
"""
import os
import boto3
from datetime import datetime, timezone, timedelta

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])


def handler(event, context):
    """日記の保存・取得を行う"""
    # bodyフィールドの有無で操作を判別
    if 'body' in event:
        return save_diary(event)
    else:
        return get_diaries(event)


def save_diary(event):
    """日記を保存する"""
    user_id = event.get('user_id', '')
    date = event.get('date', '')
    body = event.get('body', '')

    if not user_id or not date or not body:
        return {
            'success': False,
            'message': 'user_id, date, body は必須です。'
        }

    JST = timezone(timedelta(hours=9))
    created_at = datetime.now(JST).isoformat()

    try:
        table.put_item(Item={
            'userId': user_id,
            'date': date,
            'body': body,
            'createdAt': created_at,
        })
        return {
            'success': True,
            'message': f'{date}の日記を保存しました。',
            'diary': {
                'userId': user_id,
                'date': date,
                'createdAt': created_at,
            }
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'日記の保存に失敗しました: {str(e)}'
        }


def get_diaries(event):
    """日記一覧を取得する"""
    user_id = event.get('user_id', '')
    limit = int(event.get('limit', 10))

    if not user_id:
        return {
            'diaries': [],
            'count': 0,
            'message': 'user_id は必須です。'
        }

    try:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('userId').eq(user_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        items = response.get('Items', [])
        return {
            'diaries': [
                {
                    'date': item.get('date'),
                    'body': item.get('body', ''),
                    'createdAt': item.get('createdAt'),
                }
                for item in items
            ],
            'count': len(items),
            'message': f'{len(items)}件の日記が見つかりました。' if items else '日記が見つかりませんでした。'
        }
    except Exception as e:
        return {
            'diaries': [],
            'count': 0,
            'message': f'日記の取得に失敗しました: {str(e)}'
        }
