"""Tweet Trigger Lambda unit tests."""

import json
import unittest
from unittest.mock import patch, MagicMock, ANY
from datetime import datetime, timezone, timedelta


JST = timezone(timedelta(hours=9))


class TestHandler(unittest.TestCase):
    """Tests for the Tweet Trigger Lambda handler."""

    def setUp(self):
        """Set up common environment variables."""
        self.env = {
            "AGENTCORE_RUNTIME_ARN": "arn:aws:bedrock-agentcore:ap-northeast-1:123456:runtime/test-runtime",
            "COGNITO_TOKEN_ENDPOINT": "https://test.auth.ap-northeast-1.amazoncognito.com/oauth2/token",
            "COGNITO_CLIENT_ID": "test-client-id",
            "SSM_COGNITO_CLIENT_SECRET": "/tonari/cognito/client_secret",
            "COGNITO_SCOPE": "agentcore/invoke",
            "OWNER_TWITTER_USER_ID": "1234567890",
        }

    @patch("index.urllib.request.urlopen")
    @patch("index.boto3.client")
    def test_invokes_agentcore_successfully(self, mock_boto_client, mock_urlopen):
        """Cognito認証後、AgentCore Runtimeを正常に呼び出す。"""
        import index

        with patch.dict("os.environ", self.env):
            # Mock SSM
            ssm = MagicMock()
            ssm.get_parameter.return_value = {
                "Parameter": {"Value": "test-cognito-secret"}
            }
            mock_boto_client.return_value = ssm

            # Mock Cognito token response
            cognito_response = MagicMock()
            cognito_response.read.return_value = json.dumps(
                {"access_token": "test-access-token"}
            ).encode()
            cognito_response.__enter__ = MagicMock(return_value=cognito_response)
            cognito_response.__exit__ = MagicMock(return_value=False)

            # Mock AgentCore response
            agentcore_response = MagicMock()
            agentcore_response.read.return_value = b'data: "Tweet posted"\n\n'
            agentcore_response.__enter__ = MagicMock(return_value=agentcore_response)
            agentcore_response.__exit__ = MagicMock(return_value=False)

            mock_urlopen.side_effect = [cognito_response, agentcore_response]

            result = index.handler({}, None)

            self.assertEqual(result["statusCode"], 200)
            self.assertEqual(mock_urlopen.call_count, 2)

    @patch("index.urllib.request.urlopen")
    @patch("index.boto3.client")
    def test_prompt_contains_owner_user_id(self, mock_boto_client, mock_urlopen):
        """プロンプトにオーナーのユーザーIDが埋め込まれている。"""
        import index

        with patch.dict("os.environ", self.env):
            ssm = MagicMock()
            ssm.get_parameter.return_value = {
                "Parameter": {"Value": "test-cognito-secret"}
            }
            mock_boto_client.return_value = ssm

            cognito_response = MagicMock()
            cognito_response.read.return_value = json.dumps(
                {"access_token": "test-access-token"}
            ).encode()
            cognito_response.__enter__ = MagicMock(return_value=cognito_response)
            cognito_response.__exit__ = MagicMock(return_value=False)

            agentcore_response = MagicMock()
            agentcore_response.read.return_value = b'data: "ok"\n\n'
            agentcore_response.__enter__ = MagicMock(return_value=agentcore_response)
            agentcore_response.__exit__ = MagicMock(return_value=False)

            mock_urlopen.side_effect = [cognito_response, agentcore_response]

            index.handler({}, None)

            # Verify AgentCore call contains owner_user_id in prompt
            agentcore_call = mock_urlopen.call_args_list[1]
            request_obj = agentcore_call[0][0]
            body = json.loads(request_obj.data)
            self.assertIn("1234567890", body["prompt"])

    @patch("index.urllib.request.urlopen")
    @patch("index.boto3.client")
    def test_prompt_contains_quality_criteria(self, mock_boto_client, mock_urlopen):
        """プロンプトに品質基準（120文字目標、140文字上限）が含まれている。"""
        import index

        with patch.dict("os.environ", self.env):
            ssm = MagicMock()
            ssm.get_parameter.return_value = {
                "Parameter": {"Value": "test-cognito-secret"}
            }
            mock_boto_client.return_value = ssm

            cognito_response = MagicMock()
            cognito_response.read.return_value = json.dumps(
                {"access_token": "test-access-token"}
            ).encode()
            cognito_response.__enter__ = MagicMock(return_value=cognito_response)
            cognito_response.__exit__ = MagicMock(return_value=False)

            agentcore_response = MagicMock()
            agentcore_response.read.return_value = b'data: "ok"\n\n'
            agentcore_response.__enter__ = MagicMock(return_value=agentcore_response)
            agentcore_response.__exit__ = MagicMock(return_value=False)

            mock_urlopen.side_effect = [cognito_response, agentcore_response]

            index.handler({}, None)

            agentcore_call = mock_urlopen.call_args_list[1]
            request_obj = agentcore_call[0][0]
            body = json.loads(request_obj.data)
            self.assertIn("120", body["prompt"])
            self.assertIn("140", body["prompt"])

    @patch("index.urllib.request.urlopen")
    @patch("index.boto3.client")
    def test_prompt_contains_pipeline_steps(self, mock_boto_client, mock_urlopen):
        """プロンプトにパイプライン手順（fetch, review, post）が含まれている。"""
        import index

        with patch.dict("os.environ", self.env):
            ssm = MagicMock()
            ssm.get_parameter.return_value = {
                "Parameter": {"Value": "test-cognito-secret"}
            }
            mock_boto_client.return_value = ssm

            cognito_response = MagicMock()
            cognito_response.read.return_value = json.dumps(
                {"access_token": "test-access-token"}
            ).encode()
            cognito_response.__enter__ = MagicMock(return_value=cognito_response)
            cognito_response.__exit__ = MagicMock(return_value=False)

            agentcore_response = MagicMock()
            agentcore_response.read.return_value = b'data: "ok"\n\n'
            agentcore_response.__enter__ = MagicMock(return_value=agentcore_response)
            agentcore_response.__exit__ = MagicMock(return_value=False)

            mock_urlopen.side_effect = [cognito_response, agentcore_response]

            index.handler({}, None)

            agentcore_call = mock_urlopen.call_args_list[1]
            request_obj = agentcore_call[0][0]
            body = json.loads(request_obj.data)
            self.assertIn("fetch_owner_tweets", body["prompt"])
            self.assertIn("post_tweet", body["prompt"])

    @patch("index.urllib.request.urlopen")
    @patch("index.boto3.client")
    def test_session_id_format(self, mock_boto_client, mock_urlopen):
        """セッションIDがtonari-tweet-{日付}-{時間}形式である。"""
        import index

        with patch.dict("os.environ", self.env):
            ssm = MagicMock()
            ssm.get_parameter.return_value = {
                "Parameter": {"Value": "test-cognito-secret"}
            }
            mock_boto_client.return_value = ssm

            cognito_response = MagicMock()
            cognito_response.read.return_value = json.dumps(
                {"access_token": "test-access-token"}
            ).encode()
            cognito_response.__enter__ = MagicMock(return_value=cognito_response)
            cognito_response.__exit__ = MagicMock(return_value=False)

            agentcore_response = MagicMock()
            agentcore_response.read.return_value = b'data: "ok"\n\n'
            agentcore_response.__enter__ = MagicMock(return_value=agentcore_response)
            agentcore_response.__exit__ = MagicMock(return_value=False)

            mock_urlopen.side_effect = [cognito_response, agentcore_response]

            now_jst = datetime.now(JST)
            expected_prefix = f"tonari-tweet-pipeline-{now_jst.strftime('%Y-%m-%d')}-"

            index.handler({}, None)

            agentcore_call = mock_urlopen.call_args_list[1]
            request_obj = agentcore_call[0][0]
            body = json.loads(request_obj.data)
            self.assertTrue(
                body["session_id"].startswith(expected_prefix),
                f"session_id '{body['session_id']}' should start with '{expected_prefix}'",
            )
            self.assertEqual(body["actor_id"], "tonari-owner")

    @patch("index.boto3.client")
    def test_returns_error_on_ssm_failure(self, mock_boto_client):
        """SSM取得失敗時はログ記録して正常終了する。"""
        import index

        with patch.dict("os.environ", self.env):
            ssm = MagicMock()
            ssm.get_parameter.side_effect = Exception("SSM error")
            mock_boto_client.return_value = ssm

            result = index.handler({}, None)

            self.assertEqual(result["statusCode"], 500)
            self.assertIn("SSM", result["body"])

    @patch("index.urllib.request.urlopen")
    @patch("index.boto3.client")
    def test_returns_error_on_cognito_failure(self, mock_boto_client, mock_urlopen):
        """Cognito認証失敗時はログ記録して正常終了する。"""
        import index

        with patch.dict("os.environ", self.env):
            ssm = MagicMock()
            ssm.get_parameter.return_value = {
                "Parameter": {"Value": "test-cognito-secret"}
            }
            mock_boto_client.return_value = ssm

            mock_urlopen.side_effect = Exception("Cognito error")

            result = index.handler({}, None)

            self.assertEqual(result["statusCode"], 500)

    @patch("index.urllib.request.urlopen")
    @patch("index.boto3.client")
    def test_returns_error_on_agentcore_failure(self, mock_boto_client, mock_urlopen):
        """AgentCore呼び出し失敗時はログ記録して正常終了する。"""
        import index

        with patch.dict("os.environ", self.env):
            ssm = MagicMock()
            ssm.get_parameter.return_value = {
                "Parameter": {"Value": "test-cognito-secret"}
            }
            mock_boto_client.return_value = ssm

            cognito_response = MagicMock()
            cognito_response.read.return_value = json.dumps(
                {"access_token": "test-access-token"}
            ).encode()
            cognito_response.__enter__ = MagicMock(return_value=cognito_response)
            cognito_response.__exit__ = MagicMock(return_value=False)

            mock_urlopen.side_effect = [
                cognito_response,
                Exception("AgentCore error"),
            ]

            result = index.handler({}, None)

            self.assertEqual(result["statusCode"], 500)


if __name__ == "__main__":
    unittest.main()
