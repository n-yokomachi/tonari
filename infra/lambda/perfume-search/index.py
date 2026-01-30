"""
AgentCore Gateway から呼び出される香水検索Lambda

Parameters:
- query: 検索キーワード（すべてのフィールドを横断検索）
- limit: 取得件数（デフォルト5）
"""
import os
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])


def handler(event, context):
    """香水を検索する（全フィールド横断検索）"""
    query = event.get('query', '')
    limit = int(event.get('limit', 5))

    # フルスキャン（小規模データ想定）
    response = table.scan()
    items = response.get('Items', [])

    # キーワード検索（全フィールド横断）
    if query:
        query_lower = query.lower()
        items = [
            i for i in items
            if query_lower in i.get('name', '').lower()
            or query_lower in i.get('brand', '').lower()
            or query_lower in i.get('country', '').lower()
            or query_lower in i.get('impression', '').lower()
            or any(query_lower in note.lower() for note in i.get('topNotes', []))
            or any(query_lower in note.lower() for note in i.get('middleNotes', []))
            or any(query_lower in note.lower() for note in i.get('baseNotes', []))
            or any(query_lower in s.lower() for s in i.get('scenes', []))
            or any(query_lower in s.lower() for s in i.get('seasons', []))
        ]

    # ratingの降順でソート
    items.sort(key=lambda x: x.get('rating', 0), reverse=True)

    # 上位N件を返却
    results = items[:limit]

    return {
        'perfumes': [
            {
                'brand': item.get('brand'),
                'name': item.get('name'),
                'country': item.get('country', ''),
                'topNotes': item.get('topNotes', []),
                'middleNotes': item.get('middleNotes', []),
                'baseNotes': item.get('baseNotes', []),
                'scenes': item.get('scenes', []),
                'seasons': item.get('seasons', []),
                'impression': item.get('impression'),
                'rating': int(item.get('rating', 0)) if item.get('rating') else None,
            }
            for item in results
        ],
        'count': len(results),
        'message': f'{len(results)}件の香水が見つかりました。' if results else '該当する香水が見つかりませんでした。'
    }
