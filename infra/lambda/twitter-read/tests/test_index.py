"""Twitter Read Lambda unit tests."""

import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

JST = timezone(timedelta(hours=9))


class TestHandler(unittest.TestCase):
    """Tests for the Twitter Read Lambda handler."""

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_returns_today_tweets(self, mock_boto_client, mock_tweepy_cls):
        """当日のツイートを正しく取得して返す。"""
        from index import handler

        # SSM mock
        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "test-bearer-token"}
        }
        mock_boto_client.return_value = ssm

        # tweepy mock - today's tweets
        now_jst = datetime.now(JST)
        tweet1 = MagicMock()
        tweet1.id = 111
        tweet1.text = "Hello world"
        tweet1.created_at = now_jst

        tweet2 = MagicMock()
        tweet2.id = 222
        tweet2.text = "Good morning"
        tweet2.created_at = now_jst

        client = MagicMock()
        response = MagicMock()
        response.data = [tweet1, tweet2]
        client.get_users_tweets.return_value = response
        mock_tweepy_cls.return_value = client

        result = handler({"owner_user_id": "12345"}, None)

        self.assertEqual(result["count"], 2)
        self.assertEqual(len(result["tweets"]), 2)
        self.assertEqual(result["tweets"][0]["id"], "111")
        self.assertEqual(result["tweets"][0]["text"], "Hello world")
        self.assertIn("created_at", result["tweets"][0])
        self.assertNotIn("error", result)

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_filters_today_only(self, mock_boto_client, mock_tweepy_cls):
        """当日以外のツイートを除外する。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "test-bearer-token"}
        }
        mock_boto_client.return_value = ssm

        now_jst = datetime.now(JST)
        yesterday_jst = now_jst - timedelta(days=1)

        today_tweet = MagicMock()
        today_tweet.id = 111
        today_tweet.text = "Today"
        today_tweet.created_at = now_jst

        yesterday_tweet = MagicMock()
        yesterday_tweet.id = 222
        yesterday_tweet.text = "Yesterday"
        yesterday_tweet.created_at = yesterday_jst

        client = MagicMock()
        response = MagicMock()
        response.data = [today_tweet, yesterday_tweet]
        client.get_users_tweets.return_value = response
        mock_tweepy_cls.return_value = client

        result = handler({"owner_user_id": "12345"}, None)

        self.assertEqual(result["count"], 1)
        self.assertEqual(result["tweets"][0]["text"], "Today")

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_respects_max_count(self, mock_boto_client, mock_tweepy_cls):
        """max_countパラメータで取得件数を制限する。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "test-bearer-token"}
        }
        mock_boto_client.return_value = ssm

        now_jst = datetime.now(JST)
        tweets = []
        for i in range(5):
            t = MagicMock()
            t.id = i
            t.text = f"Tweet {i}"
            t.created_at = now_jst
            tweets.append(t)

        client = MagicMock()
        response = MagicMock()
        response.data = tweets
        client.get_users_tweets.return_value = response
        mock_tweepy_cls.return_value = client

        result = handler({"owner_user_id": "12345", "max_count": 2}, None)

        self.assertEqual(result["count"], 2)

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_returns_empty_when_no_tweets(self, mock_boto_client, mock_tweepy_cls):
        """ツイートがない場合は空リストを返す。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "test-bearer-token"}
        }
        mock_boto_client.return_value = ssm

        client = MagicMock()
        response = MagicMock()
        response.data = None
        client.get_users_tweets.return_value = response
        mock_tweepy_cls.return_value = client

        result = handler({"owner_user_id": "12345"}, None)

        self.assertEqual(result["count"], 0)
        self.assertEqual(result["tweets"], [])
        self.assertNotIn("error", result)

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_returns_empty_when_no_today_tweets(self, mock_boto_client, mock_tweepy_cls):
        """当日のツイートがない場合は空リストを返す。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "test-bearer-token"}
        }
        mock_boto_client.return_value = ssm

        yesterday = datetime.now(JST) - timedelta(days=1)
        tweet = MagicMock()
        tweet.id = 111
        tweet.text = "Yesterday"
        tweet.created_at = yesterday

        client = MagicMock()
        response = MagicMock()
        response.data = [tweet]
        client.get_users_tweets.return_value = response
        mock_tweepy_cls.return_value = client

        result = handler({"owner_user_id": "12345"}, None)

        self.assertEqual(result["count"], 0)
        self.assertEqual(result["tweets"], [])

    @patch("index.boto3.client")
    def test_returns_error_on_ssm_failure(self, mock_boto_client):
        """SSM取得失敗時はerrorフラグ付きレスポンスを返す。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameter.side_effect = Exception("SSM error")
        mock_boto_client.return_value = ssm

        result = handler({"owner_user_id": "12345"}, None)

        self.assertEqual(result["count"], 0)
        self.assertEqual(result["tweets"], [])
        self.assertTrue(result["error"])
        self.assertIn("SSM", result["message"])

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_returns_error_on_twitter_api_failure(self, mock_boto_client, mock_tweepy_cls):
        """Twitter API失敗時はerrorフラグ付きレスポンスを返す。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "test-bearer-token"}
        }
        mock_boto_client.return_value = ssm

        client = MagicMock()
        client.get_users_tweets.side_effect = Exception("API error")
        mock_tweepy_cls.return_value = client

        result = handler({"owner_user_id": "12345"}, None)

        self.assertEqual(result["count"], 0)
        self.assertEqual(result["tweets"], [])
        self.assertTrue(result["error"])

    @patch("index.tweepy.Client")
    @patch("index.boto3.client")
    def test_default_max_count_is_three(self, mock_boto_client, mock_tweepy_cls):
        """デフォルトのmax_countが3であることを確認する。"""
        from index import handler

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "test-bearer-token"}
        }
        mock_boto_client.return_value = ssm

        now_jst = datetime.now(JST)
        tweets = []
        for i in range(5):
            t = MagicMock()
            t.id = i
            t.text = f"Tweet {i}"
            t.created_at = now_jst
            tweets.append(t)

        client = MagicMock()
        response = MagicMock()
        response.data = tweets
        client.get_users_tweets.return_value = response
        mock_tweepy_cls.return_value = client

        result = handler({"owner_user_id": "12345"}, None)

        self.assertEqual(result["count"], 3)


if __name__ == "__main__":
    unittest.main()
