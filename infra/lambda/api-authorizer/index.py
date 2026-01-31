"""
API Gateway Lambda Authorizer for M2M (Client Credentials) Tokens

Validates JWT access tokens from Cognito client_credentials flow.
"""
import json
import os
import urllib.request
from typing import Any

from jose import jwt, JWTError

# Cognito User Pool configuration
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
REGION = os.environ.get('AWS_REGION', 'ap-northeast-1')

# Cache for JWKS
_jwks_cache: dict[str, Any] | None = None


def get_jwks() -> dict[str, Any]:
    """Fetch JWKS from Cognito User Pool (cached)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = f'https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json'
    with urllib.request.urlopen(jwks_url, timeout=10) as response:
        _jwks_cache = json.loads(response.read().decode('utf-8'))
    return _jwks_cache


def validate_token(token: str) -> dict[str, Any]:
    """
    Validate JWT access token from Cognito.

    Args:
        token: JWT access token

    Returns:
        Decoded token claims if valid

    Raises:
        JWTError: If token is invalid
    """
    jwks = get_jwks()

    # Get the key ID from the token header
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get('kid')

    # Find the matching key
    key = None
    for k in jwks.get('keys', []):
        if k.get('kid') == kid:
            key = k
            break

    if key is None:
        raise JWTError('Public key not found in JWKS')

    # Verify and decode the token
    expected_issuer = f'https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}'

    claims = jwt.decode(
        token,
        key,
        algorithms=['RS256'],
        issuer=expected_issuer,
        options={
            'verify_aud': False,  # M2M tokens don't have aud claim
        },
    )

    # Verify token_use is 'access'
    if claims.get('token_use') != 'access':
        raise JWTError('Invalid token_use claim')

    return claims


def generate_policy(principal_id: str, effect: str, resource: str) -> dict[str, Any]:
    """Generate IAM policy for API Gateway."""
    policy = {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource,
                }
            ],
        },
    }
    return policy


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Lambda authorizer handler.

    Args:
        event: API Gateway authorizer event
        context: Lambda context

    Returns:
        IAM policy allowing or denying access
    """
    # Extract token from Authorization header
    auth_header = event.get('authorizationToken', '')

    # Remove 'Bearer ' prefix if present
    if auth_header.lower().startswith('bearer '):
        token = auth_header[7:]
    else:
        token = auth_header

    if not token:
        print('No token provided')
        raise Exception('Unauthorized')

    try:
        claims = validate_token(token)

        # Use client_id as principal for M2M tokens
        principal_id = claims.get('client_id', claims.get('sub', 'unknown'))

        # Generate Allow policy
        # Use wildcard for resource to allow all methods/paths
        method_arn = event.get('methodArn', '')
        # Convert specific method ARN to wildcard ARN
        # arn:aws:execute-api:region:account:api-id/stage/method/path
        # -> arn:aws:execute-api:region:account:api-id/stage/*
        arn_parts = method_arn.split('/')
        if len(arn_parts) >= 2:
            resource_arn = '/'.join(arn_parts[:2]) + '/*'
        else:
            resource_arn = method_arn

        policy = generate_policy(principal_id, 'Allow', resource_arn)

        # Add token claims as context (available in integration mapping)
        policy['context'] = {
            'client_id': claims.get('client_id', ''),
            'scope': claims.get('scope', ''),
        }

        print(f'Authorized: {principal_id}')
        return policy

    except JWTError as e:
        print(f'JWT validation error: {e}')
        raise Exception('Unauthorized')
    except Exception as e:
        print(f'Authorization error: {e}')
        raise Exception('Unauthorized')
