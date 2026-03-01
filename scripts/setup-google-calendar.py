"""
Google OAuth2 Setup Script

Authorization flow for Google Calendar and Gmail APIs.
Obtains a refresh token and stores credentials in AWS SSM Parameter Store.

Usage:
    pip install google-auth-oauthlib boto3
    python scripts/setup-google-calendar.py
"""

import sys

import boto3
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
]
SSM_PREFIX = "/tonari/google"
AWS_REGION = "ap-northeast-1"


def main():
    print("=== Google OAuth2 Setup (Calendar + Gmail) ===\n")

    # Collect credentials
    client_id = input("Client ID: ").strip()
    if not client_id:
        print("Error: Client ID is required.")
        sys.exit(1)

    client_secret = input("Client Secret: ").strip()
    if not client_secret:
        print("Error: Client Secret is required.")
        sys.exit(1)

    # Build OAuth2 client config
    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }

    # Run OAuth2 authorization flow
    print("\nBrowser will open for Google account authorization...")
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    credentials = flow.run_local_server(port=0, prompt="consent")

    if not credentials or not credentials.refresh_token:
        print("Error: Failed to obtain refresh token.")
        sys.exit(1)

    print(f"\nRefresh token obtained successfully.")

    # Store in SSM Parameter Store
    print(f"\nStoring credentials in SSM Parameter Store ({SSM_PREFIX}/*)...")
    params = {
        f"{SSM_PREFIX}/client_id": client_id,
        f"{SSM_PREFIX}/client_secret": client_secret,
        f"{SSM_PREFIX}/refresh_token": credentials.refresh_token,
    }

    try:
        ssm = boto3.client("ssm", region_name=AWS_REGION)
        for name, value in params.items():
            ssm.put_parameter(
                Name=name,
                Value=value,
                Type="SecureString",
                Overwrite=True,
            )
            print(f"  Stored: {name}")
        print("\nSetup complete! Credentials stored in SSM Parameter Store.")
    except Exception as e:
        print(f"\nSSM storage failed: {e}")
        print("\n=== Manual Storage Commands ===")
        print("Run the following commands to store credentials manually:\n")
        for name, value in params.items():
            print(
                f'aws ssm put-parameter --name "{name}" '
                f'--value "{value}" --type "SecureString" '
                f"--overwrite --region {AWS_REGION}"
            )
        print()


if __name__ == "__main__":
    main()
