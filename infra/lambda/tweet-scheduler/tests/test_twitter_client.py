"""TwitterClient unit tests."""

import unittest
from unittest.mock import patch, MagicMock

from twitter_client import TwitterClient


class TestTwitterClient(unittest.TestCase):
    """TwitterClient initialization and credential loading tests."""

    @patch("twitter_client.boto3")
    def test_loads_credentials_from_ssm(self, mock_boto3):
        """SSM Parameter Storeから認証情報を正しく取得する。"""
        mock_ssm = MagicMock()
        mock_boto3.client.return_value = mock_ssm
        mock_ssm.get_parameters_by_path.return_value = {
            "Parameters": [
                {"Name": "/tonari/twitter/api_key", "Value": "test-api-key"},
                {"Name": "/tonari/twitter/api_secret", "Value": "test-api-secret"},
                {"Name": "/tonari/twitter/access_token", "Value": "test-access-token"},
                {
                    "Name": "/tonari/twitter/access_token_secret",
                    "Value": "test-access-secret",
                },
                {"Name": "/tonari/twitter/bearer_token", "Value": "test-bearer"},
            ]
        }

        client = TwitterClient(ssm_prefix="/tonari/twitter", region="ap-northeast-1")

        mock_ssm.get_parameters_by_path.assert_called_once_with(
            Path="/tonari/twitter", WithDecryption=True
        )
        self.assertIsNotNone(client.client)

    @patch("twitter_client.tweepy")
    @patch("twitter_client.boto3")
    def test_initializes_tweepy_client_with_oauth(self, mock_boto3, mock_tweepy):
        """OAuth 1.0aでtweepy.Clientを初期化する。"""
        mock_ssm = MagicMock()
        mock_boto3.client.return_value = mock_ssm
        mock_ssm.get_parameters_by_path.return_value = {
            "Parameters": [
                {"Name": "/tonari/twitter/api_key", "Value": "key"},
                {"Name": "/tonari/twitter/api_secret", "Value": "secret"},
                {"Name": "/tonari/twitter/access_token", "Value": "token"},
                {"Name": "/tonari/twitter/access_token_secret", "Value": "token_secret"},
                {"Name": "/tonari/twitter/bearer_token", "Value": "bearer"},
            ]
        }

        TwitterClient(ssm_prefix="/tonari/twitter", region="ap-northeast-1")

        mock_tweepy.Client.assert_called_once_with(
            bearer_token="bearer",
            consumer_key="key",
            consumer_secret="secret",
            access_token="token",
            access_token_secret="token_secret",
        )

    @patch("twitter_client.boto3")
    def test_raises_on_missing_credentials(self, mock_boto3):
        """認証情報が不足している場合はValueErrorを送出する。"""
        mock_ssm = MagicMock()
        mock_boto3.client.return_value = mock_ssm
        mock_ssm.get_parameters_by_path.return_value = {
            "Parameters": [
                {"Name": "/tonari/twitter/api_key", "Value": "key"},
            ]
        }

        with self.assertRaises(ValueError):
            TwitterClient(ssm_prefix="/tonari/twitter", region="ap-northeast-1")

    @patch("twitter_client.boto3")
    def test_credentials_not_in_str_repr(self, mock_boto3):
        """認証情報がstr表現に含まれない。"""
        mock_ssm = MagicMock()
        mock_boto3.client.return_value = mock_ssm
        mock_ssm.get_parameters_by_path.return_value = {
            "Parameters": [
                {"Name": "/tonari/twitter/api_key", "Value": "secret-key-123"},
                {"Name": "/tonari/twitter/api_secret", "Value": "secret-val"},
                {"Name": "/tonari/twitter/access_token", "Value": "secret-token"},
                {"Name": "/tonari/twitter/access_token_secret", "Value": "secret-ts"},
                {"Name": "/tonari/twitter/bearer_token", "Value": "secret-bearer"},
            ]
        }

        client = TwitterClient(ssm_prefix="/tonari/twitter", region="ap-northeast-1")
        repr_str = repr(client)

        self.assertNotIn("secret-key-123", repr_str)
        self.assertNotIn("secret-val", repr_str)
        self.assertNotIn("secret-token", repr_str)


if __name__ == "__main__":
    unittest.main()
