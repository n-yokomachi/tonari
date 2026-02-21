"""Lambda handler integration tests."""

import unittest
from unittest.mock import patch, MagicMock

from tweet_fetcher import OwnerTweet


class TestHandler(unittest.TestCase):
    """Tests for the Lambda handler pipeline."""

    @patch.dict(
        "os.environ",
        {
            "OWNER_TWITTER_USER_ID": "12345",
            "SSM_TWITTER_PREFIX": "/tonari/twitter",
            "AGENTCORE_REGION": "ap-northeast-1",
            "AGENTCORE_RUNTIME_ARN": "arn:aws:test:runtime",
            "COGNITO_TOKEN_ENDPOINT": "https://example.com/token",
            "COGNITO_CLIENT_ID": "client-id",
            "SSM_COGNITO_CLIENT_SECRET": "/tonari/cognito/client_secret",
            "COGNITO_SCOPE": "read write",
        },
    )
    @patch("index._get_ssm_parameter", return_value="mock-cognito-secret")
    @patch("index.post_tweet")
    @patch("index.invoke_tonari_for_tweet")
    @patch("index.fetch_owner_tweets")
    @patch("index.TwitterClient")
    def test_full_pipeline_success(
        self, mock_tc_cls, mock_fetch, mock_invoke, mock_post, mock_ssm
    ):
        """正常系: 取得→生成→投稿のパイプラインが成功する。"""
        from index import handler

        mock_tc = MagicMock()
        mock_tc_cls.return_value = mock_tc

        mock_fetch.return_value = [
            OwnerTweet(id="1", text="Hello", created_at="2026-02-21T12:00:00+09:00")
        ]
        mock_invoke.return_value = "Tonariのツイート"
        mock_post.return_value = "999"

        result = handler({}, None)

        self.assertEqual(result["statusCode"], 200)
        mock_fetch.assert_called_once()
        mock_invoke.assert_called_once()
        mock_post.assert_called_once_with(mock_tc.client, "Tonariのツイート")

    @patch.dict(
        "os.environ",
        {
            "OWNER_TWITTER_USER_ID": "12345",
            "SSM_TWITTER_PREFIX": "/tonari/twitter",
            "AGENTCORE_REGION": "ap-northeast-1",
            "AGENTCORE_RUNTIME_ARN": "arn:aws:test:runtime",
            "COGNITO_TOKEN_ENDPOINT": "https://example.com/token",
            "COGNITO_CLIENT_ID": "client-id",
            "SSM_COGNITO_CLIENT_SECRET": "/tonari/cognito/client_secret",
            "COGNITO_SCOPE": "read write",
        },
    )
    @patch("index._get_ssm_parameter", return_value="mock-cognito-secret")
    @patch("index.post_tweet")
    @patch("index.invoke_tonari_for_tweet")
    @patch("index.fetch_owner_tweets")
    @patch("index.TwitterClient")
    def test_skips_post_when_generation_fails(
        self, mock_tc_cls, mock_fetch, mock_invoke, mock_post, mock_ssm
    ):
        """生成失敗時は投稿をスキップする。"""
        from index import handler

        mock_tc_cls.return_value = MagicMock()
        mock_fetch.return_value = []
        mock_invoke.return_value = None

        result = handler({}, None)

        self.assertEqual(result["statusCode"], 200)
        mock_post.assert_not_called()

    @patch.dict(
        "os.environ",
        {
            "OWNER_TWITTER_USER_ID": "12345",
            "SSM_TWITTER_PREFIX": "/tonari/twitter",
            "AGENTCORE_REGION": "ap-northeast-1",
            "AGENTCORE_RUNTIME_ARN": "arn:aws:test:runtime",
            "COGNITO_TOKEN_ENDPOINT": "https://example.com/token",
            "COGNITO_CLIENT_ID": "client-id",
            "SSM_COGNITO_CLIENT_SECRET": "/tonari/cognito/client_secret",
            "COGNITO_SCOPE": "read write",
        },
    )
    @patch("index._get_ssm_parameter", return_value="mock-cognito-secret")
    @patch("index.post_tweet")
    @patch("index.invoke_tonari_for_tweet")
    @patch("index.fetch_owner_tweets")
    @patch("index.TwitterClient")
    def test_continues_without_owner_tweets(
        self, mock_tc_cls, mock_fetch, mock_invoke, mock_post, mock_ssm
    ):
        """オーナーのツイートがなくても生成・投稿を継続する。"""
        from index import handler

        mock_tc_cls.return_value = MagicMock()
        mock_fetch.return_value = []
        mock_invoke.return_value = "可愛いツイート"
        mock_post.return_value = "888"

        result = handler({}, None)

        self.assertEqual(result["statusCode"], 200)
        mock_invoke.assert_called_once()
        mock_post.assert_called_once()

    @patch.dict(
        "os.environ",
        {
            "OWNER_TWITTER_USER_ID": "12345",
            "SSM_TWITTER_PREFIX": "/tonari/twitter",
            "AGENTCORE_REGION": "ap-northeast-1",
            "AGENTCORE_RUNTIME_ARN": "arn:aws:test:runtime",
            "COGNITO_TOKEN_ENDPOINT": "https://example.com/token",
            "COGNITO_CLIENT_ID": "client-id",
            "SSM_COGNITO_CLIENT_SECRET": "/tonari/cognito/client_secret",
            "COGNITO_SCOPE": "read write",
        },
    )
    @patch("index._get_ssm_parameter", return_value="mock-cognito-secret")
    @patch("index.TwitterClient")
    def test_handles_twitter_client_init_failure(self, mock_tc_cls, mock_ssm):
        """TwitterClient初期化失敗時も正常に終了する。"""
        from index import handler

        mock_tc_cls.side_effect = Exception("SSM error")

        result = handler({}, None)

        self.assertEqual(result["statusCode"], 500)


if __name__ == "__main__":
    unittest.main()
