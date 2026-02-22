# tonari-tweet-trigger

## 概要

EventBridgeスケジュールから定時起動され、AgentCore Runtimeにツイートパイプラインの実行を指示する。Cognito M2Mトークンを取得し、パイプラインの手順と品質基準を含むプロンプトを構築してエージェントに送信する。

## 基本情報

| 項目 | 値 |
|------|-----|
| 関数名 | `tonari-tweet-trigger` |
| Runtime | Python 3.12 |
| Timeout | 5分 |
| Memory | 128MB |
| ソース | `infra/lambda/tweet-trigger/` |
| トリガー | EventBridge Scheduler |

## スケジュール

| スケジュール名 | 時刻 | タイムゾーン |
|---------------|------|-------------|
| `tonari-tweet-noon` | 12:00 | Asia/Tokyo |
| `tonari-tweet-evening` | 18:00 | Asia/Tokyo |

## インターフェース

### Input

EventBridgeイベント（内容は使用しない）。

### Output

```json
{
  "statusCode": 200,
  "body": "Tweet pipeline completed"
}
```

エラー時:

```json
{
  "statusCode": 500,
  "body": "SSM Parameter Store access failed | AgentCore HTTP {code}: {detail}"
}
```

## 環境変数

| 変数 | 説明 | 値の例 |
|------|------|--------|
| `OWNER_TWITTER_USER_ID` | オーナーのTwitterユーザーID | `1330596368` |
| `AGENTCORE_REGION` | AgentCoreリージョン | `ap-northeast-1` |
| `AGENTCORE_RUNTIME_ARN` | AgentCore Runtime ARN | `arn:aws:bedrock-agentcore:...` |
| `COGNITO_TOKEN_ENDPOINT` | Cognito OAuth2 Token URL | `https://tonari-m2m-identity.auth...` |
| `COGNITO_CLIENT_ID` | Cognito Client ID | `1qemnml5e11reu81d0jap2ele3` |
| `COGNITO_SCOPE` | OAuth2 スコープ | `agentcore-m2m-.../read write` |
| `SSM_COGNITO_CLIENT_SECRET` | SSMパラメータパス | `/tonari/cognito/client_secret` |

## SSM パラメータ

| パス | 説明 |
|------|------|
| `/tonari/cognito/client_secret` | Cognito M2M Client Secret（SecureString） |

## 依存関係

**Python パッケージ:** 標準ライブラリのみ（urllib, json, base64）+ boto3（Runtime内蔵）

**外部サービス:**
- SSM Parameter Store（Cognito Secret取得）
- Cognito（client_credentials grant でM2Mトークン取得）
- AgentCore Runtime（エージェント呼び出し）

**IAM 権限:**
- `ssm:GetParameter` on `/tonari/cognito/client_secret`

## ツイートパイプライン

エージェントに送信するプロンプトで以下のパイプラインを指示する:

```
1. fetch_owner_tweets ツールでオーナーの今日のツイートを確認
2. ツイート内容を生成
3. セルフレビュー（品質基準チェック）
4. post_tweet ツールで投稿（またはスキップ）
```

### 品質基準

| 項目 | 基準 |
|------|------|
| 文字数目標 | 120文字以内 |
| 文字数上限 | 140文字（絶対超過不可） |
| 日本語品質 | 自然で読みやすいこと |
| 禁止要素 | 感情タグ・ジェスチャータグ |
| 修正不能時 | 投稿スキップ |

### セッション管理

| 項目 | 値 |
|------|-----|
| session_id | `tonari-tweet-pipeline-{YYYY-MM-DD}-{HH}` |
| actor_id | `tonari-owner` |

session_idは日付+時間単位で一意。AgentCore Memoryのセッション記録としてLTMに自動保存される。

## 処理フロー

1. 環境変数から設定値を読み取り
2. SSMからCognito Client Secretを取得
3. プロンプトを構築（現在時刻JST、owner_user_id、品質基準を埋め込み）
4. Cognito client_credentials grant でM2Mアクセストークン取得
5. AgentCore Runtime API呼び出し（SSE）
6. エージェントがGatewayツール経由でパイプライン実行
7. 結果返却

## テスト

8テストケース（`tests/test_index.py`）:
正常呼び出し、owner_user_id埋め込み、品質基準含有、パイプライン手順含有、session_id形式、SSM失敗、Cognito失敗、AgentCore失敗
