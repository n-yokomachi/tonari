# Research & Design Decisions

## Summary
- **Feature**: `tts-polly-lipsync`
- **Discovery Scope**: Extension（既存の無効化された音声インフラの再有効化 + Amazon Polly統合）
- **Key Findings**:
  - Polly PCM出力は8kHz/16kHzのみ対応（24kHzはMP3/OGG限定）。PCM 16kHzを採用し、LipSyncクラスのsampleRateパラメータで対応
  - SpeakQueueはmodel.speak()呼び出し・セッション管理・Stop機能が完備。変更不要
  - AWS SDKは既にプロジェクトに3パッケージ導入済み。@aws-sdk/client-polly追加は既存パターンに合致

## Research Log

### Amazon Polly Kazuha音声の仕様
- **Context**: TTS音声としてKazuhaを選定。仕様確認が必要
- **Sources Consulted**: [Available voices - Amazon Polly](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html), [Neural voices - Amazon Polly](https://docs.aws.amazon.com/polly/latest/dg/neural-voices.html)
- **Findings**:
  - Voice ID: `Kazuha`, Language: `ja-JP`, Gender: Female
  - エンジン: Neural（Standard も対応）
  - 出力形式: MP3, OGG, Raw PCM
  - サンプルレート: MP3/OGG: 8/16/22/24kHz、**PCM: 8/16kHz のみ**（ニューラルデフォルト: 24kHz はPCMでは不可）
  - SSML prosodyタグ対応（rate, pitch, volume）
- **Implications**: PCM 16kHz出力を使用。LipSyncクラスの`playFromArrayBuffer(buffer, onEnded, false, 16000)`でsampleRate指定。デコード不要パス使用可能

### 既存LipSyncクラスの互換性
- **Context**: 無効化されたLipSyncが現行の音声パイプラインに適合するか確認
- **Sources Consulted**: `src/features/lipSync/lipSync.ts` コード解析
- **Findings**:
  - PCM16パス: `isNeedDecode: false` でInt16Array→Float32Array変換、任意サンプルレート対応
  - AudioContext制約対応: `setupUserInteractionDetection()` でclick/touchstart/keydown/mousedownを検出
  - `pendingPlaybacks`キュー: AudioContext未開始時の再生リクエストを保留し、インタラクション後に再生
  - `stopCurrentPlayback()`: 再生中の音声を即座に停止
  - `update()`: 時間ドメインデータからボリューム計算（シグモイド関数で正規化）
- **Implications**: 変更なしでそのまま利用可能。model.tsでインスタンスを作成しupdate()を呼ぶだけ

### SpeakQueueの動作フロー
- **Context**: SpeakQueueがmodel.speak()にどう接続するか確認
- **Sources Consulted**: `src/features/messages/speakQueue.ts` コード解析
- **Findings**:
  - Singleton: `SpeakQueue.getInstance()`
  - タスク追加: `addTask({ sessionId, audioBuffer, talk, isNeedDecode, onComplete })`
  - processQueue: `await hs.viewer.model?.speak(audioBuffer, talk, isNeedDecode)` を呼び出し
  - セッション管理: `checkSessionId()` で新セッション開始時にキューリセット
  - stopAll: `model.stopSpeaking()` + キュークリア + stopTokenインクリメント
- **Implications**: model.speak()がPromiseを返すように修正すれば、SpeakQueueは変更なしで動作

### speakCharacterの呼び出しパターン
- **Context**: speakCharacterがどこから呼ばれるか、分岐ロジックの影響範囲を確認
- **Sources Consulted**: `src/features/chat/handlers.ts` コード解析
- **Findings**:
  - `handleSpeakAndStateUpdate()` から呼び出し: `speakCharacter(sessionId, {message, emotion}, onStart, onComplete)`
  - `handleReceiveTextFromWsFn()` からも同シグネチャで呼び出し
  - onStart: `hs.incrementChatProcessingCount()` — 処理中カウント増加
  - onComplete: `hs.decrementChatProcessingCount()` — 処理中カウント減少
- **Implications**: speakCharacter内部で分岐するだけで、呼び出し元(handlers.ts)の変更は不要

## Design Decisions

### Decision: PCM16直接再生 vs AudioBuffer経由
- **Context**: Pollyの出力形式とLipSyncの入力形式の整合
- **Alternatives Considered**:
  1. PCM16バイナリをそのままLipSyncに渡す（isNeedDecode: false）
  2. Polly出力をMP3にしてdecodeAudioData経由で渡す
- **Selected Approach**: PCM16直接再生
- **Rationale**: LipSyncクラスにPCM16パスが既に実装済み。デコード処理不要でレイテンシが小さい。PCM出力は16kHz上限だが音声品質は十分
- **Trade-offs**: PCM16はMP3より転送サイズが大きい（約3倍）が、1文あたり数十KB程度で問題なし。16kHzは電話品質以上で会話用途には十分

### Decision: LipSync遅延初期化
- **Context**: LipSyncにはAudioContextが必要だが、音声OFF時は不要
- **Alternatives Considered**:
  1. Model初期化時にLipSyncを常に作成
  2. 音声ON時に初めてLipSyncを作成（遅延初期化）
- **Selected Approach**: 遅延初期化
- **Rationale**: AudioContextはブラウザのリソースを消費する。音声OFFユーザーに不要なリソース確保を避ける
- **Trade-offs**: 初回音声再生時に微小な初期化遅延（無視できるレベル）

### Decision: speakCharacter内部分岐 vs 呼び出し元分岐
- **Context**: 音声ON/OFFの分岐をどこに配置するか
- **Alternatives Considered**:
  1. handlers.tsで分岐し、speakCharacterとspeakWithAudioを使い分ける
  2. speakCharacter内部でvoiceEnabled設定を参照して分岐する
- **Selected Approach**: speakCharacter内部分岐
- **Rationale**: handlers.tsの変更を最小限にし、既存の呼び出しパターンを維持。handlers.ts内の2箇所（handleSpeakAndStateUpdate, handleReceiveTextFromWsFn）を個別に修正する必要がなくなる
- **Trade-offs**: speakCharacterの責務が若干増えるが、外部インターフェースが変わらない利点が上回る

## Risks & Mitigations
- **Polly APIレイテンシ**: 各文200-500ms + ネットワーク往復 → テキスト表示は即座に行い、音声は遅延して再生。SpeakQueueが順序を保証
- **AudioContext制約**: リロード後にvoiceEnabledがONでも、ブラウザがAutoPlayをブロック → LipSyncのpendingPlaybacksキューが自動対応
- **コスト**: ニューラル音声 $16/100万文字。個人利用レベルでは問題なし

## References
- [Amazon Polly Available Voices](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html) — Kazuha音声の仕様確認
- [Amazon Polly Neural Voices](https://docs.aws.amazon.com/polly/latest/dg/neural-voices.html) — ニューラル音声の出力形式・サンプルレート
- [Optimizing Japanese TTS with Amazon Polly](https://aws.amazon.com/blogs/machine-learning/optimizing-japanese-text-to-speech-with-amazon-polly/) — 日本語TTS最適化ガイド
