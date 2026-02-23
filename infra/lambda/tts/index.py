"""
TTS Lambda - Amazon Polly音声合成

テキストと感情を受け取り、SSMLでPollyに音声合成をリクエストし、
base64エンコードされたPCM16バイナリをJSON形式で返却する。
"""
import base64
import json
import logging
from html import escape as html_escape

import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

polly = boto3.client('polly')

PROSODY_MAP = {
    'happy':     {'rate': '105%', 'volume': 'medium'},
    'angry':     {'rate': '110%', 'volume': 'loud'},
    'sad':       {'rate': '85%',  'volume': 'soft'},
    'surprised': {'rate': '115%', 'volume': 'medium'},
    'relaxed':   {'rate': '90%',  'volume': 'soft'},
    'neutral':   {},
}


def response(status_code: int, body: dict) -> dict:
    """API Gateway形式のレスポンスを生成"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        'body': json.dumps(body, ensure_ascii=False),
    }


def escape_xml(text: str) -> str:
    """XML特殊文字をエスケープする（SSMLインジェクション防止）"""
    return html_escape(text, quote=True)


def build_ssml(text: str, emotion: str) -> str:
    """感情に応じたSSMLテキストを構築する"""
    escaped_text = escape_xml(text)
    params = PROSODY_MAP.get(emotion, {})

    if params:
        attrs = ' '.join(f'{k}="{v}"' for k, v in params.items())
        return f'<speak><prosody {attrs}>{escaped_text}</prosody></speak>'

    return f'<speak>{escaped_text}</speak>'


def handler(event, context):
    """Lambda handler"""
    try:
        body_str = event.get('body')
        if not body_str:
            return response(400, {'error': 'Request body is required'})

        try:
            body = json.loads(body_str)
        except (json.JSONDecodeError, TypeError):
            return response(400, {'error': 'Invalid JSON body'})

        text = body.get('text', '')
        if not text:
            return response(400, {'error': 'Text is required'})

        emotion = body.get('emotion', 'neutral')
        voice = body.get('voice', 'Tomoko')
        if voice not in ('Tomoko', 'Kazuha'):
            voice = 'Tomoko'
        ssml_text = build_ssml(text, emotion)

        result = polly.synthesize_speech(
            Engine='neural',
            VoiceId=voice,
            LanguageCode='ja-JP',
            Text=ssml_text,
            TextType='ssml',
            OutputFormat='pcm',
            SampleRate='16000',
        )

        audio_bytes = result['AudioStream'].read()
        audio_b64 = base64.b64encode(audio_bytes).decode()

        return response(200, {
            'audio': audio_b64,
            'sampleRate': 16000,
        })

    except Exception:
        logger.exception('TTS synthesis failed')
        return response(500, {'error': 'TTS synthesis failed'})
