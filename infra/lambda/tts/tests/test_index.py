"""TTS Lambda unit tests"""
import base64
import json
import unittest
from unittest.mock import MagicMock, patch


class TestHandler(unittest.TestCase):
    """handler() integration tests"""

    def _make_event(self, body: dict) -> dict:
        return {
            'httpMethod': 'POST',
            'body': json.dumps(body),
        }

    @patch('index.polly')
    def test_synthesize_success(self, mock_polly):
        """Normal text synthesis returns base64 PCM16 audio"""
        from index import handler

        fake_audio = b'\x00\x01\x02\x03'
        mock_stream = MagicMock()
        mock_stream.read.return_value = fake_audio
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'こんにちは', 'emotion': 'neutral'})
        result = handler(event, None)

        self.assertEqual(result['statusCode'], 200)
        body = json.loads(result['body'])
        self.assertEqual(body['audio'], base64.b64encode(fake_audio).decode())
        self.assertEqual(body['sampleRate'], 16000)

        call_args = mock_polly.synthesize_speech.call_args
        self.assertEqual(call_args.kwargs['Engine'], 'neural')
        self.assertEqual(call_args.kwargs['VoiceId'], 'Tomoko')
        self.assertEqual(call_args.kwargs['LanguageCode'], 'ja-JP')
        self.assertEqual(call_args.kwargs['OutputFormat'], 'pcm')
        self.assertEqual(call_args.kwargs['SampleRate'], '16000')

    @patch('index.polly')
    def test_synthesize_with_happy_emotion(self, mock_polly):
        """Happy emotion applies correct SSML prosody"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'やった', 'emotion': 'happy'})
        handler(event, None)

        call_args = mock_polly.synthesize_speech.call_args
        ssml_text = call_args.kwargs['Text']
        self.assertIn('<speak>', ssml_text)
        self.assertIn('rate="105%"', ssml_text)
        self.assertNotIn('pitch=', ssml_text)
        self.assertEqual(call_args.kwargs['TextType'], 'ssml')

    @patch('index.polly')
    def test_synthesize_with_angry_emotion(self, mock_polly):
        """Angry emotion applies rate and volume"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'ふざけないで', 'emotion': 'angry'})
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertIn('rate="110%"', ssml_text)
        self.assertNotIn('pitch=', ssml_text)
        self.assertIn('volume="loud"', ssml_text)

    @patch('index.polly')
    def test_synthesize_with_sad_emotion(self, mock_polly):
        """Sad emotion applies slow rate and soft volume"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': '悲しい', 'emotion': 'sad'})
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertIn('rate="85%"', ssml_text)
        self.assertNotIn('pitch=', ssml_text)
        self.assertIn('volume="soft"', ssml_text)

    @patch('index.polly')
    def test_synthesize_with_surprised_emotion(self, mock_polly):
        """Surprised emotion applies fast rate"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'えっ', 'emotion': 'surprised'})
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertIn('rate="115%"', ssml_text)
        self.assertNotIn('pitch=', ssml_text)

    @patch('index.polly')
    def test_synthesize_with_relaxed_emotion(self, mock_polly):
        """Relaxed emotion applies slow rate and soft volume"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'のんびり', 'emotion': 'relaxed'})
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertIn('rate="90%"', ssml_text)
        self.assertNotIn('pitch=', ssml_text)
        self.assertIn('volume="soft"', ssml_text)

    @patch('index.polly')
    def test_neutral_emotion_no_prosody(self, mock_polly):
        """Neutral emotion uses plain SSML without prosody tag"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'はい', 'emotion': 'neutral'})
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertIn('<speak>', ssml_text)
        self.assertNotIn('<prosody', ssml_text)

    @patch('index.polly')
    def test_unknown_emotion_falls_back_to_neutral(self, mock_polly):
        """Unknown emotion is treated as neutral"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'テスト', 'emotion': 'unknown_emotion'})
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertNotIn('<prosody', ssml_text)

    @patch('index.polly')
    def test_voice_kazuha(self, mock_polly):
        """Kazuha voice is used when specified"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'テスト', 'voice': 'Kazuha'})
        handler(event, None)

        self.assertEqual(
            mock_polly.synthesize_speech.call_args.kwargs['VoiceId'], 'Kazuha'
        )

    @patch('index.polly')
    def test_invalid_voice_defaults_to_tomoko(self, mock_polly):
        """Invalid voice falls back to Tomoko"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = self._make_event({'text': 'テスト', 'voice': 'InvalidVoice'})
        handler(event, None)

        self.assertEqual(
            mock_polly.synthesize_speech.call_args.kwargs['VoiceId'], 'Tomoko'
        )


class TestValidation(unittest.TestCase):
    """Input validation tests"""

    def _make_event(self, body) -> dict:
        return {
            'httpMethod': 'POST',
            'body': json.dumps(body) if isinstance(body, dict) else body,
        }

    def test_empty_text_returns_400(self):
        """Empty text string returns 400 error"""
        from index import handler

        event = self._make_event({'text': '', 'emotion': 'neutral'})
        result = handler(event, None)

        self.assertEqual(result['statusCode'], 400)
        body = json.loads(result['body'])
        self.assertIn('error', body)

    def test_missing_text_returns_400(self):
        """Missing text field returns 400 error"""
        from index import handler

        event = self._make_event({'emotion': 'neutral'})
        result = handler(event, None)

        self.assertEqual(result['statusCode'], 400)

    def test_missing_body_returns_400(self):
        """Null body returns 400 error"""
        from index import handler

        event = {'httpMethod': 'POST', 'body': None}
        result = handler(event, None)

        self.assertEqual(result['statusCode'], 400)

    def test_invalid_json_body_returns_400(self):
        """Non-JSON body returns 400 error"""
        from index import handler

        event = {'httpMethod': 'POST', 'body': 'not json'}
        result = handler(event, None)

        self.assertEqual(result['statusCode'], 400)

    def test_missing_emotion_defaults_to_neutral(self):
        """Missing emotion field defaults to neutral"""
        from index import handler

        with patch('index.polly') as mock_polly:
            mock_stream = MagicMock()
            mock_stream.read.return_value = b'\x00'
            mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

            event = self._make_event({'text': 'テスト'})
            result = handler(event, None)

            self.assertEqual(result['statusCode'], 200)
            ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
            self.assertNotIn('<prosody', ssml_text)


class TestXmlEscaping(unittest.TestCase):
    """XML special character escaping tests"""

    @patch('index.polly')
    def test_escape_ampersand(self, mock_polly):
        """Ampersand in text is escaped"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = {
            'httpMethod': 'POST',
            'body': json.dumps({'text': 'A & B', 'emotion': 'neutral'}),
        }
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertIn('A &amp; B', ssml_text)
        self.assertNotIn('A & B', ssml_text)

    @patch('index.polly')
    def test_escape_angle_brackets(self, mock_polly):
        """Angle brackets in text are escaped"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = {
            'httpMethod': 'POST',
            'body': json.dumps({'text': '<script>alert(1)</script>', 'emotion': 'neutral'}),
        }
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertNotIn('<script>', ssml_text)
        self.assertIn('&lt;script&gt;', ssml_text)

    @patch('index.polly')
    def test_escape_quotes(self, mock_polly):
        """Quotes in text are escaped"""
        from index import handler

        mock_stream = MagicMock()
        mock_stream.read.return_value = b'\x00'
        mock_polly.synthesize_speech.return_value = {'AudioStream': mock_stream}

        event = {
            'httpMethod': 'POST',
            'body': json.dumps({'text': 'He said "hello" & \'bye\'', 'emotion': 'neutral'}),
        }
        handler(event, None)

        ssml_text = mock_polly.synthesize_speech.call_args.kwargs['Text']
        self.assertIn('&quot;', ssml_text)
        # html.escape converts ' to &#x27; (valid XML numeric character reference)
        self.assertIn('&#x27;', ssml_text)


class TestPollyError(unittest.TestCase):
    """Polly API error handling tests"""

    @patch('index.polly')
    def test_polly_error_returns_500(self, mock_polly):
        """Polly API failure returns 500"""
        from index import handler

        mock_polly.synthesize_speech.side_effect = Exception('Polly error')

        event = {
            'httpMethod': 'POST',
            'body': json.dumps({'text': 'テスト', 'emotion': 'neutral'}),
        }
        result = handler(event, None)

        self.assertEqual(result['statusCode'], 500)
        body = json.loads(result['body'])
        self.assertIn('error', body)


if __name__ == '__main__':
    unittest.main()
