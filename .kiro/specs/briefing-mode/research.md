# Research & Design Decisions

---
**Purpose**: ブリーフィングモード機能の設計判断を裏付ける調査記録
---

## Summary
- **Feature**: `briefing-mode`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Gmail API v1 の `messages.list` はIDのみ返却。メタデータ取得に2パス必要
  - `gmail.modify` + `gmail.compose` の2スコープで全要件をカバー可能
  - チャット分割は `processAIResponse()` のストリーム処理ループ内で `\n\n` / `tool_start` を検出して実現可能

## Research Log

### Gmail API v1 メッセージ操作

- **Context**: Gmail連携ツール（Requirement 1）の設計に必要なAPI仕様調査
- **Sources Consulted**:
  - Gmail API Reference (messages.list, messages.get, messages.modify, drafts.create)
  - Gmail Search Operators Documentation
- **Findings**:
  - `messages.list`: `q` パラメータでGmail検索構文が使える（`is:unread`, `newer_than:1d`, `from:` 等）。レスポンスは `id` と `threadId` のみ
  - `messages.get`: `format` パラメータで取得粒度を制御。`metadata`（ヘッダ+snippet、5 units）、`full`（本文含む、5 units）
  - `messages.modify`: `removeLabelIds: ["UNREAD", "INBOX"]` で既読+アーカイブを1リクエストで実現
  - `drafts.create`: RFC 2822形式のbase64urlエンコードメッセージを `raw` フィールドに格納
  - `messages.batchModify`: 最大1000件を一括操作可能（50 units）
- **Implications**:
  - ブリーフィングのメールトリアージには2パスアプローチが必要（list → get metadata）
  - バッチリクエストで複数メールのメタデータ取得を効率化可能
  - 既読+アーカイブは1回の `messages.modify` で完結

### Gmail OAuth2 スコープと認証

- **Context**: 既存のGoogle Calendar OAuth2認証との統合方針
- **Sources Consulted**:
  - Google OAuth2 Scopes Documentation
  - Google Incremental Authorization Documentation
- **Findings**:
  - 必要スコープ: `gmail.modify`（読取+ラベル操作）+ `gmail.compose`（下書き作成）
  - `gmail.modify` は `gmail.readonly` を包含するため、readonly は不要
  - Google の incremental authorization: `include_granted_scopes=true` で既存スコープを維持しつつ新スコープを追加可能
  - refresh token の再取得が必要（OAuth consent flow の再実行）
  - 同一の `client_id` / `client_secret` を使用可能
- **Implications**:
  - SSMの `/tonari/google/refresh_token` を更新すれば calendar-tool と gmail-tool の両方で使用可能
  - calendar-tool のコード変更は不要（既存スコープは維持される）
  - 初回セットアップ時に手動でOAuth consent flow を再実行する必要あり

### Gmail API レート制限

- **Context**: ブリーフィング時の大量API呼び出しの実現可能性
- **Findings**:
  - Per-user: 15,000 quota units/分
  - ブリーフィング想定（未読20件）: list(5) + get×20(100) + batchModify(50) ≈ 155 units
  - 制限値に対して十分な余裕あり
- **Implications**: レート制限は実用上の問題にならない

### SSEストリーミングとチャット分割

- **Context**: チャットログ分割表示（Requirement 4）の実現方法調査
- **Sources Consulted**: 既存コードベース分析
  - `src/features/chat/handlers.ts` processAIResponse()
  - `src/features/chat/agentCoreChat.ts` ReadableStream
  - `src/features/stores/home.ts` upsertMessage()
- **Findings**:
  - 現在の処理: `currentMessageId` を1つ保持し、全テキストチャンクを同一メッセージに蓄積
  - `StreamChunk = string | ToolEvent` 型。`tool_start`/`tool_end` は既に別イベントとして検出済み
  - `currentMessageContent` に逐次テキストを追加し `upsertMessage()` で更新
  - `\n\n` はチャンク境界をまたぐ可能性あり。蓄積テキスト内で検出する方式が安全
- **Implications**:
  - 分割ロジックは `processAIResponse()` 内に閉じて実装可能
  - `tool_start` 検出時: `currentMessageId = null` にリセット → 次のテキストで新メッセージ開始
  - `\n\n` 検出時: 蓄積テキストを分割位置で確定 → 残りテキストで新メッセージ開始
  - chatLog store や UI コンポーネントの変更は不要（既存の `upsertMessage` パターンを活用）

### ブリーフィングのオーケストレーション方式

- **Context**: ブリーフィングモードの実装アプローチ選定
- **Sources Consulted**: 既存のシステムプロンプト構造、AgentCore Runtime の動作
- **Findings**:
  - エージェントは既にカレンダー・タスク・天気（Tavily）ツールを持っている
  - Gmail ツール追加後、ブリーフィングに必要な全リソースへのアクセスが揃う
  - 専用の「ブリーフィングモード」状態管理は不要。システムプロンプトで手順を指示すれば、エージェントが自律的に順次ツールを呼び出す
- **Implications**:
  - バックエンドにブリーフィング専用のロジックは不要
  - システムプロンプトにブリーフィング手順・出力フォーマットを記述するだけで実現可能
  - フロントエンドはボタン押下時に定型メッセージを送信するだけ

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: プロンプト駆動 | システムプロンプトでブリーフィング手順を記述 | 実装シンプル、既存パターン踏襲 | プロンプト依存で手順が不安定になる可能性 | 採用 |
| B: 専用エンドポイント | ブリーフィング専用APIを作成 | 手順が確実、エラーハンドリング容易 | 過度な複雑化、既存アーキテクチャと乖離 | 不採用 |
| C: ワークフロー | Step Functions等で順次実行 | 確実な順序制御 | インフラ複雑化、コスト増 | 不採用 |

## Design Decisions

### Decision: Gmail ツールを独立Lambdaとして実装

- **Context**: Gmail APIアクセスの実装場所
- **Alternatives Considered**:
  1. calendar-tool Lambda に統合
  2. 新規 gmail-tool Lambda として独立
- **Selected Approach**: 新規 gmail-tool Lambda
- **Rationale**: 既存パターン（1ツール＝1Lambda）に準拠。calendar-tool のコード変更不要。責務分離が明確
- **Trade-offs**: Lambda数が増加するが、コールドスタートは許容範囲（Gmailアクセス頻度は低い）
- **Follow-up**: 同一OAuth2認証情報（SSM）を共有するため、refresh token のスコープ拡張が必要

### Decision: チャット分割をフロントエンド handler で実装

- **Context**: チャットバブル分割の実装レイヤー
- **Alternatives Considered**:
  1. バックエンド（AgentCore）でメッセージを分割して送信
  2. フロントエンド handler で分割
  3. チャットUI コンポーネントで分割表示
- **Selected Approach**: フロントエンド handler（processAIResponse）
- **Rationale**: SSEストリームのパース処理が既にhandlerに集約されている。ストリーム処理のタイミングで分割判定するのが最も自然。store/UIの変更不要
- **Trade-offs**: handler の複雑度が若干増加するが、変更箇所が1関数に閉じる

### Decision: 支出トラッキングをLLM推論で実装

- **Context**: 購入メールからの金額抽出・重複排除の実装方法
- **Alternatives Considered**:
  1. 専用パーサーLambda（正規表現ベースの金額抽出）
  2. LLM推論（エージェントがメール本文を読んで判断）
- **Selected Approach**: LLM推論
- **Rationale**: 購入確認メールのフォーマットはサイトごとに異なり、正規表現での網羅が困難。LLMは多様なフォーマットに対応可能。重複排除も金額・日付・店舗名の類似性をLLMが判断する方が柔軟
- **Trade-offs**: LLM推論はトークン消費が増加するが、正確性と柔軟性で優位

## Risks & Mitigations

- OAuth2 スコープ追加時にconsent flow再実行が必要 → セットアップ手順をドキュメント化
- Gmail API のメール本文パースが複雑（multipart MIME） → text/plain を優先取得、fallback で text/html をstrip
- チャンク境界での `\n\n` 検出漏れ → 蓄積テキスト全体で検出する方式で回避
- 支出計算の精度 → 不確実な場合は注記を出す（Requirement 3.6）

## References

- [Gmail API v1 Reference](https://developers.google.com/gmail/api/reference/rest)
- [Gmail Search Operators](https://support.google.com/mail/answer/7190)
- [Gmail API Quota](https://developers.google.com/gmail/api/reference/quota)
- [Google OAuth2 Incremental Authorization](https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth)
- [google-api-python-client](https://github.com/googleapis/google-api-python-client)
