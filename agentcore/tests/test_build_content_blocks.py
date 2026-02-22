"""build_content_blocks のユニットテスト"""

import base64

import pytest

from app import build_content_blocks


class TestBuildContentBlocks:
    """build_content_blocks: テキストと画像データからStrands Agent ContentBlockを構築"""

    def test_text_only_returns_string(self):
        """画像なしの場合、テキスト文字列をそのまま返す"""
        result = build_content_blocks("hello", None)
        assert result == "hello"

    def test_text_only_with_empty_string_image(self):
        """画像が空文字列の場合、テキスト文字列をそのまま返す"""
        result = build_content_blocks("hello", "")
        assert result == "hello"

    def test_text_and_image_returns_content_blocks(self):
        """テキスト+画像の場合、ContentBlockリストを返す"""
        image_data = base64.b64encode(b"fake image data").decode()
        result = build_content_blocks("describe this", image_data)

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0] == {"text": "describe this"}
        assert result[1]["image"]["format"] == "jpeg"
        assert result[1]["image"]["source"]["bytes"] == b"fake image data"

    def test_image_only_returns_content_blocks_with_placeholder_text(self):
        """画像のみ（テキスト空）の場合、プレースホルダーテキスト+imageブロックを返す"""
        image_data = base64.b64encode(b"fake image data").decode()
        result = build_content_blocks("", image_data)

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0] == {"text": " "}
        assert "image" in result[1]
        assert result[1]["image"]["format"] == "jpeg"
        assert result[1]["image"]["source"]["bytes"] == b"fake image data"

    def test_invalid_base64_falls_back_to_text(self):
        """不正なbase64データの場合、テキストのみにフォールバックする"""
        result = build_content_blocks("hello", "!!!invalid-base64!!!")
        assert result == "hello"

    def test_custom_image_format(self):
        """カスタム画像フォーマットが正しく設定される"""
        image_data = base64.b64encode(b"fake png data").decode()
        result = build_content_blocks("describe", image_data, image_format="png")

        assert isinstance(result, list)
        assert result[1]["image"]["format"] == "png"
