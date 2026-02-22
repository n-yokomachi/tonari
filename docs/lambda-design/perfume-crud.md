# tonari-perfume-crud

## 概要

DynamoDBに保存された香水データに対するREST API（CRUD操作）を提供する。API Gateway + Lambda Authorizer経由でサーバーサイドからアクセスされる。

## 基本情報

| 項目 | 値 |
|------|-----|
| 関数名 | `tonari-perfume-crud` |
| Runtime | Python 3.12 |
| Timeout | 30秒 |
| Memory | 128MB |
| ソース | `infra/lambda/perfume-crud/` |
| トリガー | API Gateway（M2M認証付き） |

## インターフェース

### Input（API Gateway Proxy）

```json
{
  "httpMethod": "GET|POST|PUT|DELETE",
  "path": "/perfumes|/perfumes/{brand}/{name}",
  "pathParameters": { "brand": "string", "name": "string" },
  "body": "{ ...JSON... }"
}
```

### Output

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{ ...JSON response... }"
}
```

### エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/perfumes` | 全件取得 |
| POST | `/perfumes` | 新規作成 |
| GET | `/perfumes/{brand}/{name}` | 1件取得 |
| PUT | `/perfumes/{brand}/{name}` | 更新 |
| DELETE | `/perfumes/{brand}/{name}` | 削除 |

## 環境変数

| 変数 | 説明 |
|------|------|
| `TABLE_NAME` | DynamoDBテーブル名 (`tonari-perfumes`) |

## 依存関係

**Python パッケージ:** boto3（Lambda Runtime内蔵）

**外部サービス:**
- DynamoDB `tonari-perfumes` テーブル

**IAM 権限:**
- `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:DeleteItem`, `dynamodb:Scan` on `tonari-perfumes`

## データモデル

**DynamoDB テーブル:** `tonari-perfumes`（PK: `brand`, SK: `name`）

| 属性 | 型 | 説明 |
|------|-----|------|
| brand (PK) | String | ブランド名 |
| name (SK) | String | 香水名 |
| country | String | 生産国 |
| topNotes | List | トップノート |
| middleNotes | List | ミドルノート |
| baseNotes | List | ベースノート |
| scenes | List | おすすめシーン |
| seasons | List | おすすめ季節 |
| impression | String | 感想 |
| rating | Number | 評価（1-5） |
| createdAt | String | 作成日時 |
| updatedAt | String | 更新日時 |
