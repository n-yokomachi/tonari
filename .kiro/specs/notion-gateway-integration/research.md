# Research & Design Decisions

## Summary
- **Feature**: notion-gateway-integration
- **Discovery Scope**: Extension（既存MCP Gateway + Lambda Toolパターンの拡張）
- **Key Findings**:
  - Notion APIは5つの汎用ツール（search, get, create, update, query_database）を完全にサポート
  - 既存のGmailツールと同じaction-basedディスパッチパターンを踏襲可能
  - notion-sdk-py (Python) がNotion公式SDKとして利用可能

## Research Log

### Notion API エンドポイント検証
- **Context**: 要件で定義した5ツールがすべてNotion APIで実現可能か確認
- **Sources Consulted**: Notion API公式ドキュメント (developers.notion.com)、notion-sdk-py GitHub
- **Findings**:
  - `POST /v1/search` — ワークスペース内のページ/DB検索。filter, sort, page_size対応
  - `GET /v1/pages/{page_id}` — ページプロパティ取得
  - `GET /v1/blocks/{block_id}/children` — ページコンテンツ（ブロック）取得。page_size最大100
  - `POST /v1/pages` — ページ作成。parent（database_id or page_id）、properties、children指定可能
  - `PATCH /v1/pages/{page_id}` — プロパティ更新、archived設定（ゴミ箱移動）
  - `POST /v1/databases/{database_id}/query` — DB検索。filter, sorts, page_size対応
  - `PATCH /v1/blocks/{block_id}/children` — ブロック追加（コンテンツ追記）
- **Implications**: すべてのツールがAPIで実現可能。制約なし

### Notion API 認証方式
- **Context**: Lambda関数からNotion APIへの認証方法
- **Sources Consulted**: Notion API認証ドキュメント
- **Findings**:
  - Internal Integration Token方式を使用
  - トークンは `ntn_` プレフィクスの文字列
  - HTTPヘッダ `Authorization: Bearer {token}` で認証
  - notion-sdk-pyでは `Client(auth=token)` で初期化
  - Integration はワークスペース内の特定ページ/DBに手動で「接続」が必要
- **Implications**: SSM Parameter Store (SecureString) に保存し、Lambda起動時に取得するパターンが適切

### Notion API レート制限
- **Context**: Lambda実行中のレート制限対策
- **Findings**:
  - Notion APIは429レスポンスでレート制限を通知
  - 平均3リクエスト/秒が目安
  - notion-sdk-pyはデフォルトでリトライ機能あり（APIResponseError.status == 429）
- **Implications**: Lambda30秒タイムアウトで十分。明示的なリトライ実装は不要（SDKが対応）

### 既存Lambda Toolパターン分析
- **Context**: 既存ツール（Gmail, Calendar等）と統一的なパターンで実装するための分析
- **Findings**:
  - Gmailツール: action-basedディスパッチ。Gateway schemaでaction必須フィールドを定義
  - PythonFunction: requirements.txtから依存を自動バンドル
  - SSM権限: `addToRolePolicy()` でLambda個別にSSM読み取り権限付与
  - Gateway IAM: lambdaFunctions配列にpush → Role policyでmap
  - Props: required `lambda.IFunction` で定義（notion-toolは必須ツール扱い）
- **Implications**: Gmailツールのaction-basedパターンをそのまま踏襲

### notion-sdk-py ライブラリ
- **Context**: Lambda依存ライブラリの選定
- **Sources Consulted**: PyPI notion-client, GitHub ramnes/notion-sdk-py
- **Findings**:
  - パッケージ名: `notion-client`（PyPI）
  - Notion公式JavaScript SDKのPython移植
  - pages.retrieve, pages.create, pages.update, blocks.children.list, blocks.children.append, databases.query, searchなど網羅
  - APIResponseErrorクラスでエラーハンドリング
- **Implications**: requirements.txtに `notion-client` を記載

### オーナーのNotionワークスペース構成
- **Context**: システムプロンプトに記載するDB情報のヒアリング結果
- **Findings**:
  - **Quick Notes**: 日常メモ用DB。Tags(multi_select: アイデア/メモ/リマインダー)を持つ
  - **Bookmarks**: WebブックマークDB（Knowledge Baseテンプレートベース）。Category(select)を持ち、選択肢はget_databaseで動的取得
  - **Product Idea**: 個人開発アイデアDB。Status(status: 未着手/進行中/完了)のみ
  - **Blog Idea**: 技術ブログアイデアDB。Status(status: アイデア/執筆中/執筆完了/公開済み)を持つ
  - DB IDはNotion Integration作成・接続後に取得予定
  - **プロパティスキーマはシステムプロンプトにハードコードしない**。操作時にget_databaseツールで動的取得する方針
- **Implications**: システムプロンプトにはDB名・ID・用途・活用パターンのみ記載。スキーマはget_databaseで動的に取得し、選択肢の追加・変更にも自動対応する

### get_databaseツール追加の決定
- **Context**: BookmarksのCategoryなど、select/statusプロパティの選択肢をエージェントが知る必要がある
- **Alternatives Considered**:
  1. システムプロンプトに選択肢をハードコード — シンプルだがNotion側の変更と同期が必要
  2. get_databaseツールを追加 — 動的取得で全DBに対応。Notion API `GET /v1/databases/{id}` で実現
- **Selected Approach**: get_databaseツールを追加（6ツール構成）
- **Rationale**: オーナーがNotionで選択肢を追加・変更してもエージェントが自動的に追従できる。システムプロンプトの保守コストも削減

## Design Decisions

### Decision: action-basedディスパッチの採用
- **Context**: 5ツールを1つのLambda関数で処理するためのルーティング方式
- **Alternatives Considered**:
  1. フィールド存在ベース（Calendarツール方式） — イベントの特定フィールド有無で判定
  2. action フィールドベース（Gmailツール方式） — 明示的なactionフィールドで判定
- **Selected Approach**: action フィールドベース
- **Rationale**: 5ツールすべてpage_idやdatabase_idを持つため、フィールド存在ベースでは曖昧になる。Gmailツールと同じ明示的なaction方式が最も安全
- **Trade-offs**: Gatewayスキーマに毎回actionフィールドの定義が必要だが、ルーティングの確実性が担保される

### Decision: notion-toolは必須ツール（optional不要）
- **Context**: AgentCoreConstructPropsでのLambda参照を必須にするかoptionalにするか
- **Selected Approach**: 必須（gmail, calendar等と同じ扱い）
- **Rationale**: Notion連携は今後常に利用する基本機能として位置づけるため

## Risks & Mitigations
- **Notion Integration未接続**: 対象ページ/DBにIntegrationが接続されていないと403エラー → エラーハンドリングでユーザーフレンドリーなメッセージを返す
- **ブロック100件制限**: 長大なページでは100ブロックまでしか取得できない → 初期実装ではpage_size=100で対応。必要に応じてページネーション追加
- **プロパティ型の多様性**: Notionプロパティは多数の型がある → 主要な型（title, rich_text, number, select, multi_select, date, checkbox, url, status, people）をサポートし、未対応型は型名を返す

## References
- [Notion API Reference](https://developers.notion.com/reference) — 公式APIリファレンス
- [notion-sdk-py](https://github.com/ramnes/notion-sdk-py) — Python SDK
- [Notion API Search](https://developers.notion.com/reference/post-search) — Search API仕様
- [Notion API Database Query](https://developers.notion.com/reference/post-database-query) — Database Query API仕様
