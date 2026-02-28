# Research & Design Decisions

## Summary
- **Feature**: `google-calendar-integration`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Google Calendar API v3はOAuth2必須。個人カレンダーにはService Account不可（Google Workspace管理者権限が必要なため）
  - 既存のtask-tool/diary-tool Lambdaパターン（Lambda → MCP Gateway Target）にそのまま乗せられる
  - `google-api-python-client` + `google-auth` でPython Lambda実装が可能。リフレッシュトークンはSSM Parameter Storeに保存

## Research Log

### Google Calendar API 認証方式
- **Context**: 個人のGoogleカレンダーにアクセスするための認証方式の選定
- **Sources Consulted**:
  - [Google OAuth2 Server to Server](https://developers.google.com/identity/protocols/oauth2/service-account)
  - [Google Calendar API Python Quickstart](https://developers.google.com/workspace/calendar/api/quickstart/python)
  - [Google Calendar API Reference](https://developers.google.com/workspace/calendar/api/v3/reference)
- **Findings**:
  - Service AccountはGoogle Workspaceのドメイン全体委任が必要で、個人の@gmail.comカレンダーには直接アクセス不可
  - OAuth2 Installed App Flowで初回のみブラウザ認可を行い、リフレッシュトークンを取得
  - リフレッシュトークンは6ヶ月未使用で失効する可能性があるが、日常的にアクセスすれば問題なし
  - 必要スコープ: `https://www.googleapis.com/auth/calendar`（読み書き両方）
- **Implications**: OAuth2リフレッシュトークンをSSM Parameter Storeに保存し、Lambda実行時にアクセストークンを自動取得する方式を採用

### Google Calendar API エンドポイント
- **Context**: 要件を満たすために必要なAPIエンドポイントの特定
- **Sources Consulted**:
  - [Events API Reference](https://googleapis.github.io/google-api-python-client/docs/dyn/calendar_v3.events.html)
  - [Freebusy API Reference](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- **Findings**:
  - `events.list()`: timeMin/timeMax指定でイベント一覧取得（Req 1, 2, 5）
  - `events.insert()`: イベント作成（Req 3）
  - `events.patch()`: イベント部分更新（Req 4）
  - `events.delete()`: イベント削除（Req 4）
  - `freebusy.query()`: 空き時間照会（Req 2, 5）— timeMin/timeMax/items で照会可能
- **Implications**: 6つのMCPツールに分割して実装（list_events, create_event, update_event, delete_event, check_availability, suggest_schedule）

### 既存ツールパターンとの整合性
- **Context**: 既存のtask-tool/diary-tool Lambdaとの実装パターンの比較
- **Sources Consulted**: `infra/lambda/task-tool/index.py`, `infra/lib/agentcore-construct.ts`, `infra/lib/workload-construct.ts`
- **Findings**:
  - 既存パターン: 単一Lambda + イベントフィールドでツール識別 + DynamoDB直接操作
  - calendar-toolは外部API（Google）への中継が主で、DynamoDBは不要
  - google-api-python-clientの依存があるため`@aws-cdk/aws-lambda-python-alpha`の`PythonFunction`でpipインストール
  - SSM Parameter Storeからの認証情報取得パターンはtwitter-read/writeと同様
- **Implications**: Lambda構造はtask-toolを踏襲しつつ、DynamoDBの代わりにGoogle Calendar APIを呼び出す

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Lambda Gateway Target | 既存パターンと同一。Lambda内でGoogle Calendar APIを呼び出す | 実績あり、CDK既存構造に自然に統合 | Google APIのレイテンシ（Lambda 30秒タイムアウト内） | 採用 |
| AgentCore直接統合 | Runtimeコンテナ内でgoogle-api-python-clientを直接使用 | レイテンシ削減 | Runtimeのイメージ肥大化、認証情報管理が複雑化 | 不採用 |

## Design Decisions

### Decision: OAuth2リフレッシュトークンのSSM保存
- **Context**: Google Calendar APIの認証情報の安全な管理方法
- **Alternatives Considered**:
  1. AWS Secrets Manager — 高機能だが高コスト（月$0.40/シークレット）
  2. SSM Parameter Store SecureString — 既存パターン（Twitter Bearer Token）と同一、無料枠内
  3. DynamoDB暗号化 — 過剰な設計
- **Selected Approach**: SSM Parameter Store SecureString
- **Rationale**: Twitter認証情報と同じパターンで統一。コスト面でも最適。KMS暗号化で安全性も確保
- **Trade-offs**: Secrets Managerの自動ローテーション機能は使えないが、Google OAuth2のリフレッシュトークンは手動ローテーション不要
- **Follow-up**: 初回のOAuth2認可フローはローカルスクリプトで実施し、取得したトークンをSSMに手動保存

### Decision: 6ツール構成
- **Context**: Google Calendar操作をMCPツールとしてどう分割するか
- **Alternatives Considered**:
  1. 全操作を1ツールに集約（actionパラメータで分岐）— ツールスキーマが複雑化
  2. CRUD操作単位で分割（list/create/update/delete + availability + suggest）— 各ツールの責務が明確
- **Selected Approach**: 6ツール分割（list_events, create_event, update_event, delete_event, check_availability, suggest_schedule）
- **Rationale**: LLMがツール選択しやすい。各ツールのinputSchemaがシンプル
- **Trade-offs**: Gateway Targetのツールスキーマ定義が長くなるが、メンテナンス性は向上

## Risks & Mitigations
- Google OAuth2リフレッシュトークン失効 — 日常的なアクセスで防止。失効時はローカルスクリプトで再取得
- Google Calendar API レート制限（1,000,000クエリ/日） — 個人利用では問題なし
- Lambda コールドスタート + Google API レイテンシ — 30秒タイムアウトで十分。エージェントのtool-status表示で体感を緩和

## References
- [Google Calendar API v3 Reference](https://developers.google.com/workspace/calendar/api/v3/reference)
- [Google Calendar API Python Client](https://googleapis.github.io/google-api-python-client/docs/dyn/calendar_v3.events.html)
- [Freebusy Query API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [google-auth Python Library](https://google-auth.readthedocs.io/en/latest/)
