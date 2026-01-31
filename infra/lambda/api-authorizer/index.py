"""Lambda Authorizer for API Gateway - M2M Token Validation"""

import json
import os
import urllib.request
from jose import jwt, JWTError

# Cognito設定
COGNITO_REGION = os.environ.get("COGNITO_REGION", "ap-northeast-1")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")

# JWKSキャッシュ
_jwks_cache = None


def get_jwks():
    """Cognito JWKSを取得"""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache

    jwks_url = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    with urllib.request.urlopen(jwks_url) as response:
        _jwks_cache = json.loads(response.read().decode())
    return _jwks_cache


def verify_token(token: str) -> dict:
    """JWTトークンを検証"""
    jwks = get_jwks()

    # ヘッダーからkidを取得
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    # 対応するキーを見つける
    rsa_key = None
    for key in jwks["keys"]:
        if key["kid"] == kid:
            rsa_key = key
            break

    if not rsa_key:
        raise JWTError("Key not found")

    # トークンを検証
    issuer = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    payload = jwt.decode(
        token,
        rsa_key,
        algorithms=["RS256"],
        issuer=issuer,
        options={"verify_aud": False},  # M2Mトークンはaudがないことがある
    )

    # client_idの検証
    if COGNITO_CLIENT_ID and payload.get("client_id") != COGNITO_CLIENT_ID:
        raise JWTError("Invalid client_id")

    return payload


def generate_policy(principal_id: str, effect: str, resource: str) -> dict:
    """IAMポリシードキュメントを生成"""
    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": resource,
                }
            ],
        },
    }


def handler(event, context):
    """Lambda Authorizer handler"""
    try:
        # Authorizationヘッダーからトークンを取得
        auth_header = event.get("authorizationToken", "")
        if not auth_header.startswith("Bearer "):
            return generate_policy("user", "Deny", event["methodArn"])

        token = auth_header[7:]  # "Bearer "を除去

        # トークンを検証
        payload = verify_token(token)

        # 認証成功 - APIの全リソースに対してAllowを返す
        principal_id = payload.get("sub", payload.get("client_id", "user"))
        # methodArn: arn:aws:execute-api:region:account:api-id/stage/method/path
        # -> arn:aws:execute-api:region:account:api-id/stage/* にしてキャッシュを有効活用
        arn_parts = event["methodArn"].split("/")
        api_arn = "/".join(arn_parts[:2]) + "/*"
        return generate_policy(principal_id, "Allow", api_arn)

    except Exception as e:
        print(f"Authorization failed: {e}")
        return generate_policy("user", "Deny", event["methodArn"])
