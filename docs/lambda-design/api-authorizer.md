# tonari-api-authorizer

## 概要

API GatewayのLambda Authorizerとして動作し、Cognito M2M (Machine-to-Machine) JWTトークンを検証する。

## 基本情報

| 項目 | 値 |
|------|-----|
| 関数名 | `tonari-api-authorizer` |
| Runtime | Python 3.12 |
| Timeout | 10秒 |
| Memory | 128MB |
| ソース | `infra/lambda/api-authorizer/` |
| トリガー | API Gateway Token Authorizer |
| キャッシュTTL | 5分 |

## インターフェース

### Input

```json
{
  "authorizationToken": "Bearer <JWT_token>",
  "methodArn": "arn:aws:execute-api:region:account:api-id/stage/method/path"
}
```

### Output

```json
{
  "principalId": "client_id|subject",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [{
      "Action": "execute-api:Invoke",
      "Effect": "Allow",
      "Resource": "arn:aws:execute-api:region:account:api-id/stage/*"
    }]
  }
}
```

## 環境変数

| 変数 | 説明 |
|------|------|
| `COGNITO_REGION` | Cognitoリージョン (`ap-northeast-1`) |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Cognito Client ID |

## 依存関係

**Python パッケージ:**
- `python-jose[cryptography]>=3.3.0`

**外部サービス:**
- Cognito JWKS エンドポイント（公開鍵取得、RS256検証）

**IAM 権限:** なし（公開エンドポイントのみアクセス）

## 処理フロー

1. `authorizationToken` から Bearer トークンを抽出
2. Cognito JWKS エンドポイントから公開鍵を取得
3. JWT署名を検証（RS256）
4. クレーム（client_id, token_use, iss）を検証
5. Allow/Deny ポリシードキュメントを返却
