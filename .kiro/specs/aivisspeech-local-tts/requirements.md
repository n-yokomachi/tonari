# Requirements Document

## Introduction
現在のTTS実装（ブラウザ → Vercel API Route → Lambda → Amazon Polly）を、ブラウザからローカルのAivisSpeech Engine（localhost:10101）に直接リクエストする構成に置き換える。これにより、キャラクターらしい自然な音声合成をコスト不要で実現する。AivisSpeech EngineのDockerセットアップ手順（ユーザー手動作業）もドキュメントとして含める。既存のLipSync・SpeakQueueは流用する。

## Requirements

### Requirement 1: AivisSpeech Engineのセットアップ手順
**Objective:** ユーザーとして、AivisSpeech EngineをWindows PCにDockerで簡単にセットアップしたい。音声合成サーバーをローカルで稼働させるため。

#### Acceptance Criteria
1. The project shall 開発者向けセットアップ手順をドキュメント（`docs/aivisspeech-setup.md`）として提供する
2. The documentation shall Docker起動コマンド（CPU版・GPU版）、動作確認方法、話者一覧の確認方法を含める
3. When ユーザーがドキュメントの手順に従ってDockerコンテナを起動した場合, the AivisSpeech Engine shall `http://localhost:10101/version` でバージョン情報を返す
4. The documentation shall AivisSpeech Engineで利用する音声モデルのインストール手順を含める

### Requirement 2: ブラウザからのAivisSpeech API直接通信
**Objective:** フロントエンドとして、ブラウザからローカルのAivisSpeech Engine APIに直接リクエストを送り、音声データ（WAV）を取得したい。Vercel API Routeを経由せずに低レイテンシで音声合成を行うため。

#### Acceptance Criteria
1. When 音声合成リクエストが発生した場合, the フロントエンド shall AivisSpeech Engineの `/audio_query` エンドポイントにテキストとspeaker IDをPOSTし、音声クエリJSONを取得する
2. When 音声クエリの取得に成功した場合, the フロントエンド shall `/synthesis` エンドポイントに音声クエリをPOSTし、WAV形式の音声バイナリを取得する
3. The フロントエンド shall 取得したWAVバイナリを既存のLipSync（`playFromArrayBuffer` with `isNeedDecode: true`）に渡して音声再生・リップシンクを実行する
4. If AivisSpeech Engineへの通信に失敗した場合, the フロントエンド shall テキストベースの母音リップシンク（既存のフォールバック動作）に切り替える

### Requirement 3: 話者（Speaker）の選択
**Objective:** ユーザーとして、AivisSpeechの話者（キャラクター・スタイル）を設定画面から選択したい。好みの声質でTonariの音声を聞くため。

#### Acceptance Criteria
1. The 設定Store shall AivisSpeech用のspeaker ID設定項目を持つ
2. The 設定UI shall 音声出力ON時に、話者を選択できるUIを表示する
3. When ユーザーが話者を変更した場合, the 設定Store shall 選択されたspeaker IDを永続化する
4. The フロントエンド shall 音声合成リクエスト時に、設定Storeから取得したspeaker IDを使用する

### Requirement 4: AivisSpeech Engine接続設定
**Objective:** ユーザーとして、AivisSpeech EngineのURLを設定画面から変更できるようにしたい。デフォルトのlocalhost:10101以外の環境にも対応するため。

#### Acceptance Criteria
1. The 設定Store shall AivisSpeech EngineのベースURL設定項目を持つ（デフォルト: `http://localhost:10101`）
2. The 設定UI shall 音声出力ON時に、AivisSpeech EngineのURL入力欄を表示する
3. When ユーザーがURLを変更した場合, the 設定Store shall 変更されたURLを永続化する

### Requirement 5: 既存Polly TTS実装との切り替え
**Objective:** 開発者として、AivisSpeech導入後も既存のPolly TTS実装を残し、設定で切り替え可能にしたい。AivisSpeechが利用できない環境（サーバー未起動時など）でもPolly経由の音声合成を使えるようにするため。

#### Acceptance Criteria
1. The 設定Store shall TTSエンジンの選択設定項目を持つ（`aivisspeech` / `polly`）
2. When TTSエンジンが `aivisspeech` に設定されている場合, the フロントエンド shall ブラウザからローカルAivisSpeech Engineに直接リクエストする
3. When TTSエンジンが `polly` に設定されている場合, the フロントエンド shall 既存の `/api/tts` API Route経由でPollyにリクエストする
4. The 設定UI shall 音声出力ON時に、TTSエンジンの選択UIを表示する

### Requirement 6: Polly TTS実装の削除
**Objective:** 開発者として、AivisSpeechへの移行が完了した後にPolly TTS関連のコード・インフラを削除したい。不要なコードとインフラコストを排除するため。

#### Acceptance Criteria
1. When AivisSpeechへの移行が確認された場合, the プロジェクト shall `/api/tts` API Route、TTS Lambda関数、関連するCDK定義を削除する
2. When Polly関連コードを削除した場合, the 設定Store shall TTSエンジン選択設定を削除し、AivisSpeech固定とする
3. When Polly関連コードを削除した場合, the 設定UI shall Pollyの音声モデル（Tomoko/Kazuha）選択UIを削除する
