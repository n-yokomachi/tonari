# Research & Design Decisions

## Summary
- **Feature**: `wake-word-detection`
- **Discovery Scope**: New Feature（グリーンフィールド）
- **Key Findings**:
  - Porcupine Web SDKはSharedArrayBuffer非対応時にArrayBufferへフォールバック → COEP/COOPヘッダー不要
  - Chromeは別ウィンドウ（visible but unfocused）をForeground扱い → AudioContextスロットリングなし
  - `@picovoice/porcupine-react`がReact Hookを提供 → Next.js統合が容易

## Research Log

### Porcupine Web SDK API
- **Context**: ウェイクワード検知エンジンのブラウザ統合方式調査
- **Sources Consulted**:
  - https://picovoice.ai/docs/quick-start/porcupine-web/
  - https://picovoice.ai/docs/quick-start/porcupine-react/
  - https://picovoice.ai/docs/api/porcupine-react/
  - https://github.com/Picovoice/porcupine/tree/master/binding/web
- **Findings**:
  - `@picovoice/porcupine-react`パッケージが`usePorcupine` Hookを提供
  - Hook戻り値: `keywordDetection`, `isLoaded`, `isListening`, `error`, `init`, `start`, `stop`, `release`
  - 初期化: `init(accessKey, keyword, model)` — キーワード(.ppn)とモデル(.pv)はpublicディレクトリまたはbase64で提供
  - カスタムウェイクワード「TONaRi」はPicovoice Consoleで無料作成可能
  - 対応言語にJapaneseが含まれる（ウェイクワード検知用）
  - WebVoiceProcessorが内部でマイクアクセスとオーディオダウンサンプリングを処理
- **Implications**: React Hookパターンで統合でき、既存のhookマウントパターン（useSleepMode等）と整合

### SharedArrayBufferとCOEP/COOPヘッダー
- **Context**: Porcupine WASMがSharedArrayBufferを必要とし、COEP/COOPヘッダーがアプリ全体に影響する懸念
- **Sources Consulted**:
  - https://github.com/Picovoice/porcupine/tree/master/binding/web
  - https://vercel.com/kb/guide/fix-shared-array-buffer-not-defined-nextjs-react
  - https://web.dev/articles/cross-origin-isolation-guide
- **Findings**:
  - **SharedArrayBuffer非対応時、Porcupineは標準ArrayBufferにフォールバック**
  - フォールバック時はマルチスレッド処理が無効化されシングルスレッド動作
  - ウェイクワード検知の処理負荷ではシングルスレッドで十分
  - COEP/COOPヘッダー設定は不要
- **Implications**: 既存リソース（VRM、画像、CDN等）への影響なし。next.config.js変更不要

### ブラウザタブの可視性とAudioContext
- **Context**: Tonariが別ディスプレイに表示（visible but unfocused）時のAudioContext動作
- **Sources Consulted**:
  - https://developer.chrome.com/blog/background_tabs
  - https://groups.google.com/a/chromium.org/g/blink-dev/c/XRqy8mIOWps
- **Findings**:
  - **Chromeは「別ウィンドウのタブ」をForeground扱い** → スロットリングなし
  - Background（同一ウィンドウの隠れたタブ）のみがタイマー制限を受ける
  - 音声再生中のタブはBackground扱いでもスロットリング免除
  - AudioContext数の上限はハードウェア依存（Chrome 66+で6個制限を撤廃）
- **Implications**: ユーザーの使用環境（別ディスプレイ表示）ではAudioContextが正常動作する

### Web Speech API（STT）
- **Context**: ウェイクワード検知後の音声→テキスト変換方式
- **Sources Consulted**:
  - https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
  - https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous
  - https://developer.chrome.com/blog/new-in-chrome-139
- **Findings**:
  - Chrome 139（2025年8月）でオンデバイス音声認識が追加（SODA: Speech On-Device API）
  - `continuous: false`（デフォルト）で話し終わり時に自動停止
  - `speechend`イベントで音声終了を検知
  - `result`イベントの`isFinal`フラグで中間結果と確定結果を区別
  - 日本語対応（`lang: 'ja-JP'`）
  - Web Speech APIは内部でマイクを管理 → Porcupineのマイクとは独立
- **Implications**: `continuous: false`とspeechendイベントで無音検出を実現。Porcupine停止後にSpeechRecognition開始でマイク切り替え

### マイク共有/切り替え
- **Context**: Porcupine（WebVoiceProcessor）とWeb Speech APIのマイク競合
- **Sources Consulted**: Picovoice docs, Web Speech API MDN
- **Findings**:
  - Porcupine: WebVoiceProcessorが`getUserMedia`でマイクストリームを取得・管理
  - Web Speech API: 内部で独自にマイクを管理（MediaStreamを外部から渡せない）
  - 同時使用は不可 → 逐次切り替えが必要
  - 切り替えフロー: Porcupine `stop()` → SpeechRecognition `start()` → 認識完了 → Porcupine `start()`
  - 切り替え時に数百ms〜1sの遅延が発生する可能性あり
- **Implications**: ウェイクワード「TONaRi」の後、最初の数語が聞き漏れるリスクは許容可能（ユーザーは「TONaRi」の後に自然なポーズを入れるため）

### 既存コードベース統合ポイント
- **Context**: 既存アーキテクチャへの統合方式
- **Sources Consulted**: コードベース分析
- **Findings**:
  - Hookマウント: `src/pages/index.tsx`（useSleepMode, useIdleMotion等と同列）
  - 設定: `src/features/stores/settings.ts`（Zustand + persist、voiceEnabled等と同パターン）
  - メッセージ送信: `handleSendChatFn()`（`src/features/chat/handlers.ts`）
  - 睡眠検知/起床: `homeStore.getState().isSleeping` + `viewer.model.wakeUp()`
  - AudioContext: `src/features/lipSync/lipSync.ts`（TTS出力分析用、入力側とは独立）
  - next.config.js: ヘッダー設定なし（追加不要と確認済み）
- **Implications**: 既存パターンに完全に沿った統合が可能

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| React Hook + Zustand Store | カスタムHookでPorcupine/STTを管理、状態はZustandで共有 | 既存パターンと整合、テスト容易 | Hook内の状態管理が複雑になる可能性 | 採用 |
| Context Provider | React Contextで音声サービスを提供 | 依存注入が明確 | 既存コードがContext不使用（Zustand中心） | 不採用 |
| Service Worker | バックグラウンドで音声処理 | タブ非表示時も動作 | 実装複雑、マイクアクセス制限 | 不採用 |

## Design Decisions

### Decision: Porcupine React Hook直接利用
- **Context**: Porcupine統合方式の選択
- **Alternatives Considered**:
  1. `@picovoice/porcupine-web`を直接利用して低レベルAPI操作
  2. `@picovoice/porcupine-react`の`usePorcupine` Hookを利用
- **Selected Approach**: `@picovoice/porcupine-react`のusePorcupine Hook
- **Rationale**: React Hookパターンがプロジェクト全体と整合。ライフサイクル管理（mount/unmount時のリソース解放）が自動化される
- **Trade-offs**: 低レベル制御は制限されるが、ウェイクワード検知には不要
- **Follow-up**: usePorcupineの内部WebVoiceProcessorがマイクを解放するタイミングを実装時に検証

### Decision: Web Speech APIによるSTT
- **Context**: ウェイクワード検知後の音声認識方式
- **Alternatives Considered**:
  1. Web Speech API（ブラウザ内蔵）
  2. Picovoice Cheetah/Leopard（日本語非対応）
  3. OpenAI Whisper API（サーバー往復、有料）
- **Selected Approach**: Web Speech API
- **Rationale**: 日本語対応、無料、追加依存なし、Chrome 139でオンデバイス認識も追加
- **Trade-offs**: Chrome依存。認識精度はクラウドSTTに劣る可能性があるが、ユーザーテストで十分と確認済み
- **Follow-up**: 品質が不十分な場合、STTサービスインターフェースの差し替えで対応可能な設計とする

### Decision: COEP/COOPヘッダー不要
- **Context**: SharedArrayBuffer要件によるアプリ全体への影響
- **Selected Approach**: ヘッダーを追加しない（Porcupineのシングルスレッドフォールバックを利用）
- **Rationale**: ウェイクワード検知はCPU負荷が低く、シングルスレッドで十分。ヘッダー追加による既存リソースへの影響リスクを回避
- **Trade-offs**: マルチスレッド最適化は利用不可（パフォーマンス影響は軽微）

### Decision: Porcupine/STT逐次切り替え
- **Context**: マイク共有の競合問題
- **Selected Approach**: Porcupine停止 → STT開始 → STT完了 → Porcupine再開の逐次フロー
- **Rationale**: 同時利用は技術的に不可。逐次切り替えが唯一の選択肢
- **Trade-offs**: 切り替え時に数百msの遅延。ユーザーは「TONaRi」の後に自然なポーズを入れるため実用上問題なし

### Decision: サイレンスタイマー付きSTT再開
- **Context**: Web Speech API（continuous: false）では発話途中のポーズでspeechendが発火し、テキストが途中で確定される問題
- **Alternatives Considered**:
  1. `continuous: true`を使用 → 終了タイミングの制御が困難（ブラウザ間で挙動が異なる）
  2. `continuous: false` + 即時確定 → 途中のポーズで途切れる
  3. `continuous: false` + サイレンスタイマー付き再開 → ポーズを吸収
- **Selected Approach**: speechend発火時に3秒のサイレンスタイマーを開始。タイマー内にSTTを再開しユーザーが話し始めればバッファに追記。3秒間完全に沈黙すればバッファ確定
- **Rationale**: `continuous: false`の安定した終了検知を活かしつつ、自然なポーズを許容。タイマーベースのため制御が明確
- **Trade-offs**: 3秒の追加遅延が発生するが、会話のテンポとしては自然な範囲

### Decision: 会話モード（エージェント応答後の自動STT再開）
- **Context**: ウェイクワード→発話→応答の1往復で終わると、連続した会話をするために毎回ウェイクワードが必要になる
- **Alternatives Considered**:
  1. 毎回ウェイクワード必須 → UX的にストレスフル
  2. TTS完了後に自動STT再開（会話モード） → 自然な対話体験
  3. 常時STT on → プライバシー・リソース消費の懸念
- **Selected Approach**: TTS完了（chatProcessing=false AND isSpeaking=false）後に自動でSTTを再開し、10秒のフォローアップタイマーを開始。ユーザーが話せば会話続行、沈黙すればPorcupine待機に戻る
- **Rationale**: 人間同士の会話に近い体験。ウェイクワードは会話の「きっかけ」のみ
- **Trade-offs**: TTS再生中にSTTを停止する必要がある（Tonari自身の声を拾わないように）。TTS無効時はテキスト応答完了時点で再開
- **Follow-up**: FOLLOW_UP_TIMEOUT（10秒）は実際の使用感を見て調整が必要かもしれない

## Risks & Mitigations
- **マイク切り替え遅延**: Porcupine stop → STT start間の聞き漏れ → 「TONaRi」後の自然なポーズで吸収。UIでリスニング開始を通知
- **Web Speech API品質**: 日本語認識精度が不十分な可能性 → STTサービスを抽象化し差し替え可能に設計
- **Porcupineモデルファイルサイズ**: WASMモデル(.pv)とキーワード(.ppn)の初回ダウンロード → publicディレクトリに配置、ブラウザキャッシュ活用
- **ブラウザ互換性**: Web Speech APIはChrome中心 → Porcupineのみ有効化しSTT無効の部分的動作をサポート
- **サイレンスタイマーの精度**: 3秒が短すぎる/長すぎる可能性 → 定数化して調整容易に。実使用でチューニング
- **TTS中のマイク音拾い**: エージェントのTTS再生中にSTTがTonariの声を拾うリスク → processing中はSTTを停止、TTS完了後に再開
- **フォローアップタイムアウト**: 10秒では短い/長い可能性 → 定数化して調整容易に

## References
- [Porcupine Web SDK Quick Start](https://picovoice.ai/docs/quick-start/porcupine-web/)
- [Porcupine React Hook API](https://picovoice.ai/docs/api/porcupine-react/)
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [SpeechRecognition - MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Chrome Background Tabs](https://developer.chrome.com/blog/background_tabs)
- [Chrome 139 On-Device Speech](https://developer.chrome.com/blog/new-in-chrome-139)
- [Vercel SharedArrayBuffer Guide](https://vercel.com/kb/guide/fix-shared-array-buffer-not-defined-nextjs-react)
- [Porcupine GitHub](https://github.com/Picovoice/porcupine)
