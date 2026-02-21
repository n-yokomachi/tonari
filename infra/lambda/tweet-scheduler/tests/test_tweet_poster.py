"""TweetPoster unit tests."""

import unittest
from unittest.mock import MagicMock

from tweet_poster import post_tweet


class TestPostTweet(unittest.TestCase):
    """Tests for post_tweet function."""

    def test_posts_tweet_successfully(self):
        """ツイートを正常に投稿し、ツイートIDを返す。"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = {"id": "123456789"}
        mock_client.create_tweet.return_value = mock_response

        result = post_tweet(mock_client, "Hello from Tonari!")

        mock_client.create_tweet.assert_called_once_with(text="Hello from Tonari!")
        self.assertEqual(result, "123456789")

    def test_returns_none_on_failure(self):
        """投稿失敗時はNoneを返す。"""
        mock_client = MagicMock()
        mock_client.create_tweet.side_effect = Exception("Tweet failed")

        result = post_tweet(mock_client, "Hello")

        self.assertIsNone(result)

    def test_returns_none_on_empty_response(self):
        """レスポンスにデータがない場合はNoneを返す。"""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.data = None
        mock_client.create_tweet.return_value = mock_response

        result = post_tweet(mock_client, "Hello")

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
