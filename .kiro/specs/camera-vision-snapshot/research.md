# Research & Design Decisions

## Summary
- **Feature**: `camera-vision-snapshot`
- **Discovery Scope**: Extension（既存コード簡素化 + APIパイプライン新規構築）
- **Key Findings**:
  - AITuber-kit由来のマルチモーダルコードは複雑すぎるため削除し、シンプルに新規構築する方針に決定
  - 状態管理パターン（`modalImage` / `triggerShutter`）のみ流用。画像送信パイプラインは全レイヤーで新規実装
  - Strands Agentsは `{"image": {"format": "jpeg", "source": {"bytes": raw_bytes}}}` 形式で画像を受け付ける

## Research Log

### 既存マルチモーダルインフラの分析
- **Context**: カメラ連携機能の実装に先立ち、AITuber-kitベースの既存コードにどの程度のマルチモーダル基盤があるかを調査
- **Sources Consulted**: `src/components/common/VideoDisplay.tsx`, `src/components/form.tsx`, `src/features/stores/home.ts`, `src/features/messages/messages.ts`
- **Findings**:
  - `VideoDisplay`コンポーネント: getUserMediaでカメラアクセス、Canvas APIでキャプチャ、data URL(PNG)として`homeStore.modalImage`に保存
  - `form.tsx`: `triggerShutter` → `delayedText` → 送信の制御フロー実装済み
  - `Message`型: `content: [{ type: 'text', text: string }, { type: 'image', image: string }]` のマルチモーダル対応済み
  - `messageInput.tsx`: 画像プレビュー、ドラッグ&ドロップ、ファイルバリデーション（10MB、4096x4096）実装済み
  - `isMultiModalAvailable()`: モデル対応状況 + 設定 + モードの包括的判定関数あり
- **Implications**:
  - 既存のVideoDisplayはドラッグ/リサイズ/背景動画など過剰な機能を含み、Tonariには不要
  - `isMultiModalAvailable()`等のマルチサービス判定もTonariでは不要（AgentCoreのみ）
  - **方針**: 複雑な既存コードを削除し、シンプルなCameraPreviewコンポーネントを新規作成
  - 状態管理パターン（`modalImage` / `triggerShutter` / `webcamStatus`）のみ流用

### 画像送信パイプラインのギャップ分析
- **Context**: 既存インフラで画像がどこまでAPIに到達しているかを確認
- **Sources Consulted**: `src/features/chat/agentCoreChat.ts`, `src/features/chat/handlers.ts`, `src/pages/api/ai/agentcore.ts`, `agentcore/app.py`
- **Findings**:
  - `handleSendChatFn()`: ユーザーメッセージをテキストのみでchatLogに追加し、`processAIResponse(newMessage)`に文字列のみ渡す
  - `getAgentCoreChatResponseStream()`: `{ message: userMessage, sessionId, actorId }` — 画像フィールドなし
  - Next.js API: `{ prompt: message, session_id, actor_id }` — 画像フィールドなし
  - Python backend: `prompt = payload.get("prompt", "")` → `agent.stream_async(prompt)` — 文字列のみ
  - **modalImageはフロントエンドの表示にのみ使用され、APIに一切送信されていない**
- **Implications**:
  - フロントエンド → Next.js API → AgentCore Runtime → Strands Agent の全レイヤーで画像送信対応が必要
  - 各レイヤーのインターフェースを拡張する必要がある

### Strands Agents マルチモーダル入力形式
- **Context**: バックエンドでStrands Agentに画像を渡す正確な形式を確認
- **Sources Consulted**: [Strands Agents Multimodal Documentation](https://strandsagents.com/latest/documentation/docs/examples/python/multimodal/), [AWS Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-examples.html)
- **Findings**:
  - ContentBlock形式: `{"image": {"format": "jpeg", "source": {"bytes": raw_bytes}}}`
  - **raw bytes**を渡す（base64ではない）— SDKが内部でエンコード処理
  - テキスト+画像の複合メッセージ: `agent([{"text": "..."}, {"image": {...}}])`
  - 対応フォーマット: `png`, `jpeg`, `gif`, `webp`
  - サイズ制限: 最大3.75MB/画像、8000x8000px、リクエストあたり20枚まで
  - 画像は `"role": "user"` メッセージのみに使用可能
- **Implications**:
  - フロントエンドからbase64で送信 → バックエンドで`base64.b64decode()`してraw bytesに変換
  - `agent.stream_async(prompt)` を `agent.stream_async([content_blocks])` に変更
  - JPEG推奨（PNG data URLの既存実装からJPEGへの変更が必要）

### 既存タグパーシングパターン
- **Context**: Phase 2の`[camera]`タグ実装のため、既存の感情・ジェスチャータグ処理を分析
- **Sources Consulted**: `src/features/chat/handlers.ts`
- **Findings**:
  - 感情タグ: `extractEmotion()` — 正規表現 `^\s*\[(.*?)\]` で先頭タグを抽出
  - ジェスチャータグ: `detectAndTriggerGestures()` — `text.includes('[bow]')` / `'[present]'` でテキスト内検出
  - タグ除去: `removeGestureTags()` — `/\[(bow|present)\]/g` で置換
  - ジェスチャーは1チャンクにつき1つのみトリガー（重複防止Set使用）
- **Implications**:
  - `[camera]`タグはジェスチャータグと同じパターン（テキスト内検出+除去）で実装可能
  - ただし、`[camera]`はキャプチャ→API送信→応答待ちの非同期処理が伴うため、ジェスチャーより複雑
  - ストリーミング中に`[camera]`を検出した時点でキャプチャをトリガーし、応答完了後に画像を送信する必要あり

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 既存インフラ拡張 | VideoDisplay + modalImage + triggerShutterを流用し、APIパイプラインのみ追加 | 変更最小限 | VideoDisplayの複雑さがTonariに不要、保守性低下 | 不採用 |
| 既存コード簡素化 + 新規構築 | 複雑な既存コードを削除し、状態管理パターンのみ流用。シンプルなCameraPreviewを新規作成 | クリーンな設計、保守性高い | 多少の工数増 | **選択** |

## Design Decisions

### Decision: 既存コード簡素化 + シンプルなCameraPreview新規構築
- **Context**: カメラキャプチャ機能の実装方式の選択
- **Alternatives Considered**:
  1. 既存インフラ流用 — VideoDisplay, triggerShutter, modalImageをそのまま活用
  2. 既存コード削除 + 新規構築 — 複雑なコードを削除し、状態管理パターンのみ流用
- **Selected Approach**: 既存コード削除 + 新規構築
- **Rationale**: AITuber-kitのVideoDisplayはドラッグ/リサイズ/背景動画などTonariに不要な機能が多く、保守性が低い。マルチサービスのマルチモーダル判定（isMultiModalAvailable等）もTonariはAgentCore専用のため不要。状態管理パターン（modalImage/triggerShutter/webcamStatus）のみ流用し、シンプルなCameraPreviewコンポーネントを新規作成する。
- **Trade-offs**: 多少の工数増だが、保守性とコードの理解しやすさが大幅に向上
- **Follow-up**: 削除対象ファイルの依存関係確認、useDraggable/useResizableの他箇所での使用確認

### Decision: 画像データのbase64文字列送信
- **Context**: フロントエンド→バックエンド間の画像転送方式
- **Alternatives Considered**:
  1. base64文字列をJSONボディに含める
  2. multipart/form-dataで送信
  3. 画像をS3にアップロードしてURLを送信
- **Selected Approach**: base64文字列をJSONボディに含める
- **Rationale**: 既存のJSON APIを最小限の変更で拡張可能。画像サイズをリサイズ（長辺1024px）+ JPEG圧縮で100-200KB程度に抑えられるため、base64でも問題ない。
- **Trade-offs**: base64は33%のオーバーヘッドがあるが、リサイズ後のサイズなら許容範囲
- **Follow-up**: リサイズ・圧縮のパフォーマンス確認

### Decision: Phase 2の[camera]タグ処理をストリーミング完了後に実行
- **Context**: LLM応答のストリーミング中に`[camera]`タグを検出した場合の処理タイミング
- **Alternatives Considered**:
  1. ストリーミング中にタグ検出時点で即座にキャプチャ → 応答完了後に画像送信
  2. ストリーミング完了後にタグを検出 → キャプチャ → 画像送信
- **Selected Approach**: ストリーミング中にタグ検出してキャプチャ、ストリーミング完了後に画像を自動送信
- **Rationale**: ユーザーに「エージェントが見ている」感覚を与えるために、ストリーミング中にキャプチャを実行。ただし画像の送信は応答完了後にする（応答の途中で新しいリクエストを送るとストリームが中断される）
- **Trade-offs**: キャプチャのタイミングと送信のタイミングにズレが生じる
- **Follow-up**: キャプチャ時のシャッターアニメーション実装

## Risks & Mitigations
- base64画像データによるAPIペイロード肥大化 → JPEG圧縮 + リサイズ（長辺1024px, quality 0.85）で100-200KB程度に制限
- AgentCore Runtimeのペイロードサイズ制限 → リサイズで対応。制限値の確認が必要
- Phase 2のストリーミング中カメラ制御の複雑性 → Phase 1完了後に着手し、段階的に実装
- ブラウザ互換性（getUserMedia） → 主要ブラウザ対応済み、フォールバックUI実装

## References
- [Strands Agents Multimodal Documentation](https://strandsagents.com/latest/documentation/docs/examples/python/multimodal/)
- [AWS Bedrock Converse API Image Format](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-examples.html)
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: HTMLCanvasElement.toDataURL()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL)
- [AITuber-kit VideoDisplay Implementation](https://github.com/tegnike/aituber-kit) — 既存コードベース
