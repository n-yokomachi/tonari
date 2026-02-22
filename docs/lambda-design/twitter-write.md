# tonari-twitter-write

## 概要

TONaRiアカウント（@tonari_with）からツイートを投稿する。OAuth 1.0a認証を使用し、AgentCore Gatewayのツールとして公開されている。

## 基本情報

| 項目 | 値 |
|------|-----|
| 関数名 | `tonari-twitter-write` |
| Runtime | Python 3.12 |
| Timeout | 30秒 |
| Memory | 128MB |
| ソース | `infra/lambda/twitter-write/` |
| トリガー | AgentCore Gateway (`TwitterWriteTarget`) |

## Gateway ツールスキーマ

```json
{
  "name": "post_tweet",
  "description": "TONaRi（@tonari_with）のアカウントからツイートを投稿する。投稿前にツイート内容が140文字以内であることを確認すること。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "投稿するツイートのテキスト（140文字以内）" }
    },
    "required": ["text"]
  }
}
```

## インターフェース

### Input

```json
{
  "text": "投稿するツイートのテキスト"
}
```

### Output（正常）

```json
{
  "tweet_id": "1893456789012345678",
  "message": "Tweet posted successfully (ID: 1893456789012345678)"
}
```

### Output（エラー）

```json
{
  "tweet_id": null,
  "message": "エラーの説明",
  "error": true
}
```

## SSM パラメータ

SSM path `/tonari/twitter/` 配下を `GetParametersByPath` で一括取得:

| パス | 説明 |
|------|------|
| `/tonari/twitter/api_key` | Twitter API Consumer Key |
| `/tonari/twitter/api_secret` | Twitter API Consumer Secret |
| `/tonari/twitter/access_token` | OAuth 1.0a Access Token |
| `/tonari/twitter/access_token_secret` | OAuth 1.0a Access Token Secret |

## 依存関係

**Python パッケージ:**
- `tweepy>=4.14.0`

**外部サービス:**
- Twitter API v2（`POST /2/tweets`）
- SSM Parameter Store

**IAM 権限:**
- `ssm:GetParametersByPath` on `/tonari/twitter` and `/tonari/twitter/*`

## 処理フロー

1. SSMから `/tonari/twitter/` 配下のOAuth 1.0a認証情報を一括取得
2. 必須4キー（api_key, api_secret, access_token, access_token_secret）の存在チェック
3. `tweepy.Client(consumer_key=..., consumer_secret=..., access_token=..., access_token_secret=...)` で初期化
4. `create_tweet(text=text)` でツイート投稿
5. レスポンスの `data["id"]` をtweet_idとして返却

## テスト

6テストケース（`tests/test_index.py`）:
投稿成功、投稿失敗、空レスポンス、SSM失敗、認証情報不足、OAuth認証初期化検証
