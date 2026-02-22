# tonari-perfume-search

## 概要

香水データベースに対するキーワード全文検索を提供する。AgentCore Gatewayのツールとして公開されており、エージェントが香水を検索する際に使用する。

## 基本情報

| 項目 | 値 |
|------|-----|
| 関数名 | `tonari-perfume-search` |
| Runtime | Python 3.12 |
| Timeout | 30秒 |
| Memory | 128MB |
| ソース | `infra/lambda/perfume-search/` |
| トリガー | AgentCore Gateway (`PerfumeSearchTarget`) |

## Gateway ツールスキーマ

```json
{
  "name": "search_perfumes",
  "description": "Search perfume database by keyword.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search keyword" },
      "limit": { "type": "number", "description": "Maximum results (default 5)" }
    },
    "required": ["query"]
  }
}
```

## インターフェース

### Input

```json
{
  "query": "ラベンダー",
  "limit": 5
}
```

### Output

```json
{
  "perfumes": [
    {
      "brand": "string",
      "name": "string",
      "country": "string",
      "topNotes": ["string"],
      "middleNotes": ["string"],
      "baseNotes": ["string"],
      "scenes": ["string"],
      "seasons": ["string"],
      "impression": "string",
      "rating": 5
    }
  ],
  "count": 1,
  "message": "1件の香水が見つかりました。"
}
```

## 環境変数

| 変数 | 説明 |
|------|------|
| `TABLE_NAME` | DynamoDBテーブル名 (`tonari-perfumes`) |

## 依存関係

**Python パッケージ:** boto3（Lambda Runtime内蔵）

**外部サービス:**
- DynamoDB `tonari-perfumes` テーブル

**IAM 権限:**
- `dynamodb:Scan` on `tonari-perfumes`（`grantReadData`）

## 検索ロジック

- DynamoDB Scanで全件取得後、Pythonでフィルタリング
- 大文字小文字を区別しないキーワードマッチ
- 検索対象: brand, name, country, impression, topNotes, middleNotes, baseNotes, scenes, seasons
- 結果はrating降順でソート後、limit件に制限
