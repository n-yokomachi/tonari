# Implementation Plan

- [ ] 1. Settings Store拡張 — TTS設定項目の追加
- [ ] 1.1 TTSエンジン切り替え・AivisSpeech接続・話者設定をSettings Storeに追加する
  - `ttsEngine`（`'aivisspeech' | 'polly'`）、`aivisSpeechUrl`（デフォルト: `http://localhost:10101`）、`aivisSpeechSpeakerId`（デフォルト: `888753760`）の3項目をGeneral interfaceに追加
  - デフォルト値を初期化関数に設定
  - partializeに3項目を追加してlocalStorageに永続化
  - _Requirements: 3.1, 3.3, 4.1, 4.3, 5.1_

- [ ] 2. AivisSpeech APIクライアント実装
- [ ] 2.1 (P) AivisSpeech Engineの2ステップAPI呼び出し関数を作成する
  - テキスト、speaker ID、ベースURLを受け取り、`/audio_query` → `/synthesis` の順でAPIを呼び出す非同期関数を実装
  - 成功時はWAV形式のArrayBufferを返す
  - API呼び出し失敗時（ネットワークエラー、非OKレスポンス）はErrorをthrowする
  - _Requirements: 2.1, 2.2_

- [ ] 3. speakCharacter TTSエンジン分岐の統合
- [ ] 3.1 音声合成リクエスト時にTTSエンジン設定に基づいてAivisSpeechまたはPollyのパスに分岐する
  - `ttsEngine === 'aivisspeech'` の場合: Settings StoreからURL・speaker IDを取得し、AivisSpeech APIクライアントでWAVを取得。SpeakQueueには `isNeedDecode: true` で投入
  - `ttsEngine === 'polly'` の場合: 既存の `/api/tts` fetchを維持。SpeakQueueには `isNeedDecode: false` で投入（既存動作そのまま）
  - audioPromise生成部分のみ分岐し、SpeakQueueへの投入以降は共通処理を維持
  - _Requirements: 2.3, 3.4, 5.2, 5.3_

- [ ] 3.2 AivisSpeech API通信失敗時にテキストベースリップシンクへフォールバックする
  - AivisSpeechのfetch失敗をcatchし、既存の `speakWithTextLipSync` を呼び出す
  - console.errorでエラー内容をログ出力
  - _Requirements: 2.4_

- [ ] 4. (P) 設定UI拡張 — TTS設定画面の追加
- [ ] 4.1 音声出力設定セクションにTTSエンジン切り替えUIを追加する
  - `voiceEnabled` ON時に、TTSエンジン選択（AivisSpeech / Polly）をTextButtonで表示
  - AivisSpeech選択時: Engine URL入力欄、Speaker ID入力欄を表示
  - Polly選択時: 既存のTomoko/Kazuha音声モデル選択を表示
  - 既存の設定UIパターン（TextButton、条件付き表示）を踏襲
  - _Requirements: 3.2, 4.2, 5.4_

- [ ] 5. (P) AivisSpeech Engineセットアップドキュメント作成
- [ ] 5.1 Docker起動手順・音声モデル導入・トラブルシューティングを記載したセットアップガイドを作成する
  - 前提条件（Docker Desktop for Windows）
  - Docker起動コマンド（CPU版 / GPU版）、ボリュームマウント設定
  - 動作確認方法（`/version`、`/speakers` エンドポイント）
  - 音声モデル（.aivmx）のインストール手順と話者IDの確認方法
  - トラブルシューティング（CORS、ポート競合、Engine未起動時の挙動）
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

**Deferred**: Requirement 6（Polly TTS実装の削除）はAivisSpeech安定稼働確認後に別タスクとして実施。
