# AivisSpeech Engine セットアップガイド

AivisSpeech Engineをローカル環境で起動し、Tonariの音声出力として使用するための手順。

## 前提条件

- Docker Desktop がインストール済みであること（Windows / macOS 対応）
- GPU版を使用する場合: NVIDIA GPU + NVIDIA Container Toolkit（Windows のみ。macOS は GPU パススルー非対応のため CPU 版を使用）

## Docker起動

### CPU版

```bash
docker run -d \
  --name aivisspeech-engine \
  -p 10101:10101 \
  -v aivisspeech-models:/home/user/.local/share/AivisSpeech-Engine \
  ghcr.io/aivis-project/aivisspeech-engine:latest-cpu
```

### GPU版（NVIDIA）

```bash
docker run -d \
  --name aivisspeech-engine \
  --gpus all \
  -p 10101:10101 \
  -v aivisspeech-models:/home/user/.local/share/AivisSpeech-Engine \
  ghcr.io/aivis-project/aivisspeech-engine:latest-nvidia
```

## 動作確認

### バージョン確認

```bash
curl http://localhost:10101/version
```

### 話者一覧の取得

```bash
curl http://localhost:10101/speakers
```

レスポンスに含まれる `styles[].id` が Speaker ID として設定画面で使用する値。

## 音声モデルのインストール

1. [AivisSpeech公式サイト](https://aivis-project.com/) から `.aivmx` ファイルをダウンロード
2. AivisSpeech Engine の `/install_model` エンドポイントでインストール、またはボリュームマウント先にファイルを配置
3. `/speakers` エンドポイントで話者IDを確認
4. Tonari設定画面の Speaker ID に入力

## Tonari設定

1. 設定画面 → Voice Output → ON
2. TTS Engine → AivisSpeech を選択
3. Engine URL: `http://localhost:10101`（デフォルト）
4. Speaker ID: `/speakers` で確認した値を入力

## トラブルシューティング

### 音声が再生されない

- AivisSpeech Engine が起動しているか確認: `curl http://localhost:10101/version`
- ブラウザのコンソールにエラーが出ていないか確認
- Engine URL が正しいか確認（デフォルト: `http://localhost:10101`）

### CORS エラー

AivisSpeech Engine はデフォルトで全オリジンを許可しているため、通常は発生しない。
カスタム設定でCORSを制限している場合は、Tonariのオリジンを許可する。

### ポート競合

他のアプリケーションが10101ポートを使用している場合:

```bash
docker run -d \
  --name aivisspeech-engine \
  -p 10102:10101 \
  -v aivisspeech-models:/home/user/.local/share/AivisSpeech-Engine \
  ghcr.io/aivis-project/aivisspeech-engine:latest-cpu
```

Tonari設定画面の Engine URL を `http://localhost:10102` に変更する。

### Engine未起動時の挙動

AivisSpeech Engine が起動していない状態で音声出力をONにした場合、
通信エラーを検知してテキストベースのリップシンク（口パク）にフォールバックする。
ブラウザのコンソールにエラーログが出力される。
