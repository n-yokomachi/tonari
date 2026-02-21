"""AgentCoreInvoker unit tests."""

import json
import unittest
from unittest.mock import patch, MagicMock

from tweet_fetcher import OwnerTweet
from agentcore_invoker import (
    invoke_tonari_for_tweet,
    _build_prompt,
    _parse_sse_response,
    _get_cognito_token,
)


class TestBuildPrompt(unittest.TestCase):
    """Tests for prompt construction."""

    def test_related_mode_with_owner_tweets(self):
        """オーナーのツイートがある場合、関連モードのプロンプトを生成する。"""
        tweets = [
            OwnerTweet(id="1", text="Today is sunny!", created_at="2026-02-21T12:00:00+09:00"),
            OwnerTweet(id="2", text="Coffee time", created_at="2026-02-21T10:00:00+09:00"),
        ]
        prompt = _build_prompt(tweets)

        self.assertIn("Today is sunny!", prompt)
        self.assertIn("Coffee time", prompt)
        self.assertIn("140文字以内", prompt)
        self.assertIn("感情タグ", prompt)

    def test_cute_mode_without_owner_tweets(self):
        """オーナーのツイートがない場合、可愛い系モードのプロンプトを生成する。"""
        prompt = _build_prompt([])

        self.assertIn("可愛い系", prompt)
        self.assertIn("140文字以内", prompt)
        self.assertIn("センシティブ", prompt)

    def test_prompt_contains_tweet_only_instruction(self):
        """プロンプトにツイート本文のみ出力の指示が含まれる。"""
        prompt = _build_prompt([])
        self.assertIn("ツイート本文のみ", prompt)


class TestParseSSEResponse(unittest.TestCase):
    """Tests for SSE response parsing."""

    def test_parses_json_string_data(self):
        """JSON文字列形式のSSEデータをパースする。"""
        sse_text = 'data: "Hello "\n\ndata: "World"\n\n'
        result = _parse_sse_response(sse_text)
        self.assertEqual(result, "Hello World")

    def test_parses_plain_text_data(self):
        """プレーンテキスト形式のSSEデータをパースする。"""
        sse_text = "data: Hello\n\ndata: World\n\n"
        result = _parse_sse_response(sse_text)
        self.assertEqual(result, "HelloWorld")

    def test_ignores_empty_data_lines(self):
        """空のdata行を無視する。"""
        sse_text = "data: Hello\n\ndata: \n\ndata: World\n\n"
        result = _parse_sse_response(sse_text)
        self.assertEqual(result, "HelloWorld")

    def test_returns_empty_on_no_data(self):
        """データなしの場合は空文字を返す。"""
        result = _parse_sse_response("")
        self.assertEqual(result, "")


class TestGetCognitoToken(unittest.TestCase):
    """Tests for Cognito M2M token retrieval."""

    @patch("agentcore_invoker.urllib.request.urlopen")
    def test_gets_access_token(self, mock_urlopen):
        """Cognito M2Mトークンを正しく取得する。"""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps(
            {"access_token": "test-token-123"}
        ).encode()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        token = _get_cognito_token(
            client_id="test-id",
            client_secret="test-secret",
            token_endpoint="https://example.com/oauth2/token",
            scope="read write",
        )

        self.assertEqual(token, "test-token-123")


class TestInvokeTonariForTweet(unittest.TestCase):
    """Tests for the main invoke function."""

    @patch("agentcore_invoker.urllib.request.urlopen")
    @patch("agentcore_invoker._get_cognito_token")
    def test_returns_generated_tweet(self, mock_token, mock_urlopen):
        """生成されたツイートを返す。"""
        mock_token.return_value = "test-token"
        mock_response = MagicMock()
        mock_response.read.return_value = b'data: "Hello from Tonari!"\n\n'
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        result = invoke_tonari_for_tweet(
            owner_tweets=[],
            cognito_client_id="cid",
            cognito_client_secret="csecret",
            cognito_token_endpoint="https://example.com/token",
            cognito_scope="scope",
            runtime_arn="arn:aws:test",
            region="ap-northeast-1",
        )

        self.assertEqual(result, "Hello from Tonari!")

    @patch("agentcore_invoker.urllib.request.urlopen")
    @patch("agentcore_invoker._get_cognito_token")
    def test_returns_none_on_error(self, mock_token, mock_urlopen):
        """エラー時はNoneを返す。"""
        mock_token.side_effect = Exception("Auth failed")

        result = invoke_tonari_for_tweet(
            owner_tweets=[],
            cognito_client_id="cid",
            cognito_client_secret="csecret",
            cognito_token_endpoint="https://example.com/token",
            cognito_scope="scope",
            runtime_arn="arn:aws:test",
            region="ap-northeast-1",
        )

        self.assertIsNone(result)

    @patch("agentcore_invoker.urllib.request.urlopen")
    @patch("agentcore_invoker._get_cognito_token")
    def test_retries_on_length_exceeded(self, mock_token, mock_urlopen):
        """140文字超過の場合、1回リトライする。"""
        mock_token.return_value = "test-token"

        long_text = "あ" * 141
        short_text = "短いツイート"

        mock_resp_long = MagicMock()
        mock_resp_long.read.return_value = f'data: "{long_text}"\n\n'.encode()
        mock_resp_long.__enter__ = lambda s: s
        mock_resp_long.__exit__ = MagicMock(return_value=False)

        mock_resp_short = MagicMock()
        mock_resp_short.read.return_value = f'data: "{short_text}"\n\n'.encode()
        mock_resp_short.__enter__ = lambda s: s
        mock_resp_short.__exit__ = MagicMock(return_value=False)

        mock_urlopen.side_effect = [mock_resp_long, mock_resp_short]

        result = invoke_tonari_for_tweet(
            owner_tweets=[],
            cognito_client_id="cid",
            cognito_client_secret="csecret",
            cognito_token_endpoint="https://example.com/token",
            cognito_scope="scope",
            runtime_arn="arn:aws:test",
            region="ap-northeast-1",
        )

        self.assertEqual(result, short_text)
        self.assertEqual(mock_urlopen.call_count, 2)

    @patch("agentcore_invoker.urllib.request.urlopen")
    @patch("agentcore_invoker._get_cognito_token")
    def test_returns_none_if_still_too_long(self, mock_token, mock_urlopen):
        """リトライ後もまだ長い場合はNoneを返す。"""
        mock_token.return_value = "test-token"

        long_text = "あ" * 141

        mock_resp = MagicMock()
        mock_resp.read.return_value = f'data: "{long_text}"\n\n'.encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)

        mock_urlopen.side_effect = [mock_resp, mock_resp]

        result = invoke_tonari_for_tweet(
            owner_tweets=[],
            cognito_client_id="cid",
            cognito_client_secret="csecret",
            cognito_token_endpoint="https://example.com/token",
            cognito_scope="scope",
            runtime_arn="arn:aws:test",
            region="ap-northeast-1",
        )

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
