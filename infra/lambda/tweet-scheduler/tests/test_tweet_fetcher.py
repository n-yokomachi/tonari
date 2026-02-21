"""TweetFetcher unit tests."""

import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

from tweet_fetcher import fetch_owner_tweets, OwnerTweet

JST = timezone(timedelta(hours=9))


class TestFetchOwnerTweets(unittest.TestCase):
    """Tests for fetch_owner_tweets function."""

    def _make_tweet(self, tweet_id, text, created_at_str):
        """Create a mock tweet object."""
        tweet = MagicMock()
        tweet.id = tweet_id
        tweet.text = text
        tweet.created_at = datetime.fromisoformat(created_at_str)
        return tweet

    def test_returns_todays_tweets(self):
        """当日分のツイートのみを返す。"""
        mock_client = MagicMock()
        now_jst = datetime.now(JST)
        today_str = now_jst.strftime("%Y-%m-%dT10:00:00+09:00")
        yesterday_str = (now_jst - timedelta(days=1)).strftime(
            "%Y-%m-%dT23:00:00+09:00"
        )

        mock_response = MagicMock()
        mock_response.data = [
            self._make_tweet("1", "today tweet", today_str),
            self._make_tweet("2", "yesterday tweet", yesterday_str),
        ]
        mock_client.get_users_tweets.return_value = mock_response

        result = fetch_owner_tweets(mock_client, "12345")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].text, "today tweet")

    def test_limits_to_max_count(self):
        """max_count件までに制限する。"""
        mock_client = MagicMock()
        now_jst = datetime.now(JST)

        tweets = []
        for i in range(5):
            t_str = now_jst.strftime(f"%Y-%m-%dT{10+i:02d}:00:00+09:00")
            tweets.append(self._make_tweet(str(i), f"tweet {i}", t_str))

        mock_response = MagicMock()
        mock_response.data = tweets
        mock_client.get_users_tweets.return_value = mock_response

        result = fetch_owner_tweets(mock_client, "12345", max_count=3)

        self.assertEqual(len(result), 3)

    def test_returns_empty_list_on_no_data(self):
        """ツイートがない場合は空リストを返す。"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = None
        mock_client.get_users_tweets.return_value = mock_response

        result = fetch_owner_tweets(mock_client, "12345")

        self.assertEqual(result, [])

    def test_returns_empty_list_on_api_error(self):
        """API呼び出し失敗時は空リストを返す。"""
        mock_client = MagicMock()
        mock_client.get_users_tweets.side_effect = Exception("API error")

        result = fetch_owner_tweets(mock_client, "12345")

        self.assertEqual(result, [])

    def test_calls_api_with_correct_params(self):
        """正しいパラメータでAPIを呼び出す。"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = None
        mock_client.get_users_tweets.return_value = mock_response

        fetch_owner_tweets(mock_client, "12345")

        mock_client.get_users_tweets.assert_called_once_with(
            id="12345",
            max_results=5,
            exclude=["retweets", "replies"],
            tweet_fields=["created_at", "text"],
        )

    def test_returns_owner_tweet_dataclass(self):
        """OwnerTweetデータクラスを正しく返す。"""
        mock_client = MagicMock()
        now_jst = datetime.now(JST)
        today_str = now_jst.strftime("%Y-%m-%dT12:00:00+09:00")

        mock_response = MagicMock()
        mock_response.data = [self._make_tweet("999", "hello world", today_str)]
        mock_client.get_users_tweets.return_value = mock_response

        result = fetch_owner_tweets(mock_client, "12345")

        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], OwnerTweet)
        self.assertEqual(result[0].id, "999")
        self.assertEqual(result[0].text, "hello world")


if __name__ == "__main__":
    unittest.main()
