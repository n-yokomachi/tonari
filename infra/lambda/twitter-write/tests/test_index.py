"""Twitter Write Lambda unit tests."""

import unittest
from unittest.mock import patch, MagicMock


class TestHandler(unittest.TestCase):
    """Tests for the Twitter Write Lambda handler."""

    def _mock_ssm(self, mock_boto_client):
        """Set up SSM mock with OAuth 1.0a credentials."""
        ssm = MagicMock()
        ssm.get_parameters_by_path.return_value = {
            "Parameters": [
                {"Name": "/tonari/twitter/api_key", "Value": "test-api-key"},
                {"Name": "/tonari/twitter/api_secret", "Value": "test-api-secret"},
                {"Name": "/tonari/twitter/access_token", "Value": "test-access-token"},
                {"Name": "/tonari/twitter/access_token_secret", "Value": "test-access-secret"},
            ]
        }
        mock_boto_client.return_value = ssm
        return ssm

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_posts_tweet_successfully(self, mock_boto_client, mock_tweepy_cls):
        """ツイートを正常に投稿し、ツイートIDを返す。"""
        from index import handler

        self._mock_ssm(mock_boto_client)

        client = MagicMock()
        client.create_tweet.return_value = MagicMock(data={"id": "99999"})
        mock_tweepy_cls.return_value = client

        result = handler({"text": "Hello from TONaRi!"}, None)

        self.assertEqual(result["tweet_id"], "99999")
        self.assertNotIn("error", result)
        client.create_tweet.assert_called_once_with(text="Hello from TONaRi!")

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_returns_error_on_post_failure(self, mock_boto_client, mock_tweepy_cls):
        """投稿失敗時はerrorフラグ付きレスポンスを返す。"""
        from index import handler

        self._mock_ssm(mock_boto_client)

        client = MagicMock()
        client.create_tweet.side_effect = Exception("Tweet failed")
        mock_tweepy_cls.return_value = client

        result = handler({"text": "Hello"}, None)

        self.assertIsNone(result["tweet_id"])
        self.assertTrue(result["error"])

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_returns_error_on_empty_response(self, mock_boto_client, mock_tweepy_cls):
        """Twitter APIが空レスポンスを返した場合はerrorフラグを返す。"""
        from index import handler

        self._mock_ssm(mock_boto_client)

        client = MagicMock()
        client.create_tweet.return_value = MagicMock(data=None)
        mock_tweepy_cls.return_value = client

        result = handler({"text": "Hello"}, None)

        self.assertIsNone(result["tweet_id"])
        self.assertTrue(result["error"])

    @patch("index.boto3.client")
    def test_returns_error_on_ssm_failure(self, mock_boto_client):
        """SSM取得失敗時はerrorフラグ付きレスポンスを返す。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameters_by_path.side_effect = Exception("SSM error")
        mock_boto_client.return_value = ssm

        result = handler({"text": "Hello"}, None)

        self.assertIsNone(result["tweet_id"])
        self.assertTrue(result["error"])
        self.assertIn("SSM", result["message"])

    @patch("index.boto3.client")
    def test_returns_error_on_missing_credentials(self, mock_boto_client):
        """SSMから必要な認証情報が不足している場合はerrorフラグを返す。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameters_by_path.return_value = {
            "Parameters": [
                {"Name": "/tonari/twitter/api_key", "Value": "test-api-key"},
            ]
        }
        mock_boto_client.return_value = ssm

        result = handler({"text": "Hello"}, None)

        self.assertIsNone(result["tweet_id"])
        self.assertTrue(result["error"])
        self.assertIn("Missing", result["message"])

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_initializes_tweepy_with_oauth_credentials(self, mock_boto_client, mock_tweepy_cls):
        """tweepyクライアントをOAuth 1.0a認証情報で初期化する。"""
        from index import handler

        self._mock_ssm(mock_boto_client)

        client = MagicMock()
        client.create_tweet.return_value = MagicMock(data={"id": "123"})
        mock_tweepy_cls.return_value = client

        handler({"text": "Hello"}, None)

        mock_tweepy_cls.assert_called_once_with(
            consumer_key="test-api-key",
            consumer_secret="test-api-secret",
            access_token="test-access-token",
            access_token_secret="test-access-secret",
        )


if __name__ == "__main__":
    unittest.main()
