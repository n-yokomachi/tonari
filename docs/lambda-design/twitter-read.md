# tonari-twitter-read

## 概要

Twitter API v2経由でオーナー（@_cityside）の当日ツイートを取得する。AgentCore Gatewayのツールとして公開されており、エージェントがツイート生成の参考にするために使用する。

## 基本情報

| 項目 | 値 |
|------|-----|
| 関数名 | `tonari-twitter-read` |
| Runtime | Python 3.12 |
| Timeout | 30秒 |
| Memory | 128MB |
| ソース | `infra/lambda/twitter-read/` |
| トリガー | AgentCore Gateway (`TwitterReadTarget`) |

## Gateway ツールスキーマ

```json
{
  "name": "fetch_owner_tweets",
  "description": "オーナー（@_cityside）の今日のツイートを取得する。ツイート生成の参考にするために使用する。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "owner_user_id": { "type": "string", "description": "オーナーのTwitterユーザーID" },
      "max_count": { "type": "number", "description": "取得する最大件数（デフォルト: 3）" }
    },
    "required": ["owner_user_id"]
  }
}
```

## インターフェース

### Input

```json
{
  "owner_user_id": "1330596368",
  "max_count": 3
}
```

### Output（正常）

```json
{
  "tweets": [
    {
      "id": "1893456789012345678",
      "text": "ツイートのテキスト",
      "created_at": "2026-02-22T12:00:00+00:00"
    }
  ],
  "count": 1,
  "message": "1件のツイートが見つかりました。"
}
```

### Output（エラー）

```json
{
  "tweets": [],
  "count": 0,
  "message": "SSM Parameter Store access failed",
  "error": true
}
```

## SSM パラメータ

| パス | 説明 |
|------|------|
| `/tonari/twitter/bearer_token` | Twitter API v2 Bearer Token（SecureString） |

## 依存関係

**Python パッケージ:**
- `tweepy>=4.14.0`

**外部サービス:**
- Twitter API v2（`GET /2/users/:id/tweets`）
- SSM Parameter Store

**IAM 権限:**
- `ssm:GetParameter` on `/tonari/twitter/bearer_token`

## 処理フロー

1. SSMからBearer Tokenを取得（WithDecryption）
2. `tweepy.Client(bearer_token=...)` で参照専用クライアント初期化
3. `get_users_tweets()` で最新5件取得（リツイート・リプライ除外）
4. JST基準で当日のツイートのみフィルタリング
5. `max_count` 件に制限して返却

## テスト

8テストケース（`tests/test_index.py`）:
当日ツイート取得、日付フィルタ、max_count制限、空結果、当日分なし、SSM失敗、API失敗、デフォルトmax_count
