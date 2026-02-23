# Implementation Plan

## Task 1: TTS Lambdaとインフラ構築

- [x] 1.1 TTS Lambda関数の作成
  - テキストと感情を受け取り、感情に応じたSSML prosodyタグでテキストをラップしてPollyに送信する
  - Amazon Polly SynthesizeSpeechでKazuhaニューラル音声を使い、PCM16 16kHzフォーマットで音声を合成する
  - 6種の感情（happy, sad, angry, surprised, relaxed, neutral）に対応するSSML prosodyパラメータマッピングを実装する
  - 未知の感情タグが渡された場合はneutralとして処理する
  - ユーザー入力テキスト内のXML特殊文字（`<>&"'`）をエスケープしてSSMLインジェクションを防止する
  - 空テキストや不正なリクエストボディに対してバリデーションエラーを返却する
  - 音声バイナリをbase64エンコードしてJSON形式で応答する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 1.2 CDKスタックにTTS LambdaとAPIルートを追加
  - 既存のPythonFunction Lambdaパターンに倣い、TTS Lambda関数をCDKスタックに定義する
  - LambdaのIAMロールにpolly:SynthesizeSpeechの実行権限を付与する
  - 既存のAPI Gatewayに/ttsリソースとPOSTメソッドを追加する
  - 既存のlambdaAuthorizerでエンドポイントを保護する
  - _Requirements: 1.4_

## Task 2: 音声設定の追加とUI

- [x] 2.1 (P) voiceEnabled設定をストアに追加し永続化する
  - 設定ストアにvoiceEnabled: boolean（デフォルトfalse）を追加する
  - partializeに含めてブラウザのlocalStorageに永続化する
  - _Requirements: 5.2, 5.3_

- [x] 2.2 設定画面に音声ON/OFFトグルと翻訳キーを追加
  - 既存のTextButtonトグルパターンに準拠したON/OFFボタンを設定画面に追加する
  - 日本語（「音声出力」）と英語（"Voice Output"）の翻訳キーを追加する
  - _Requirements: 5.1_

## Task 3: Next.js TTS APIルートの作成

- [x] 3. (P) Cognito M2M認証経由のTTSプロキシルートを作成
  - テキストと感情を受け取り、Cognito M2Mトークンを取得してAPI Gatewayの/ttsエンドポイントにプロキシする
  - Lambdaからのbase64エンコード応答をデコードし、PCM16バイナリとしてクライアントに返却する
  - 空テキストや不正リクエストに対するバリデーションエラーを返却する
  - Cognito認証失敗やAPI Gateway到達不可の場合に適切なエラーレスポンスを返却する
  - _Requirements: 1.3, 1.4_

## Task 4: ModelへのLipSync統合復元

- [x] 4. (P) LipSyncの遅延初期化、音声再生・停止、音量連動リップシンクを復元
  - 音声ON時に初めてLipSyncインスタンスを作成する遅延初期化メソッドを追加する
  - 音声バッファを受け取りPCM16として再生し、再生完了までPromiseで待機するspeak()メソッドを復元する
  - 再生中の音声を即座に停止するstopSpeaking()メソッドを復元する
  - 毎フレームのupdate()ループでLipSyncの音量解析結果を取得し、音量に応じた口の開閉を駆動する
  - 音量が小さい時は口をほぼ閉じ、大きい時は大きく開け、再生完了時は口を閉じた状態に戻す
  - _Requirements: 3.1, 3.2, 3.3_

## Task 5: speakCharacterの音声分岐とエラーハンドリング

- [x] 5.1 voiceEnabled分岐と音声合成・キュー再生フローの実装
  - 設定ストアからvoiceEnabledを参照し、ON/OFFで処理を分岐する
  - ON時: TTS APIルートに音声合成をリクエストし、SpeakQueueにタスクを追加して順序付きキュー再生する
  - OFF時: 既存のテキストベース母音リップシンクアニメーションをそのまま実行する
  - onStart/onCompleteコールバックで発話中状態の管理を維持する
  - 新しいセッション開始時やStop操作時にキューを適切にリセットする
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.4, 5.5_

- [x] 5.2 エラーハンドリングとテキストリップシンクへのフォールバック
  - 音声合成APIがエラーを返した場合にテキストベースリップシンクにフォールバックする
  - ネットワーク不安定時にテキスト表示を維持しつつ音声再生のみスキップする
  - AutoPlay制約はLipSyncクラスのpendingPlaybacksキューで自動対応する（既存実装を活用）
  - _Requirements: 6.1, 6.2, 6.3_

## Task 6: ビルド検証

- [x] 6. 全コンポーネントの統合ビルド検証
  - npm run buildでビルドが成功し、型エラーやLintエラーがないことを確認する
  - 全要件のカバレッジを最終確認する
