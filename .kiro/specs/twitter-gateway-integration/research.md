# Research & Design Decisions

## Summary
- **Feature**: `twitter-gateway-integration`
- **Discovery Scope**: Extension（既存tweet-scheduler Lambdaのリファクタリング＋Gateway化）
- **Key Findings**:
  - 既存のperfume-search Lambdaパターンを踏襲でき、Gateway Lambdaターゲットの実装パターンは確立済み
  - Lambdaターゲットは単純なdict入出力（API Gateway形式不要）で、ツールスキーマ定義でMCPツールとして自動公開される
  - Twitter API認証は参照（Bearer Token）と投稿（OAuth 1.0a）で異なるため、Lambda分離が自然

## Research Log

### AgentCore Gateway Lambdaターゲットパターン
- **Context**: 既存のperfume-search Lambdaがどのようにgatewayターゲットとして動作しているか調査
- **Sources Consulted**: `infra/lambda/perfume-search/index.py`, AgentCore Gateway公式ドキュメント
- **Findings**:
  - ハンドラーは`handler(event, context) -> dict`形式
  - eventは単純なPython dict（ツールパラメータがそのまま渡される）
  - レスポンスも単純なdict（API Gateway形式の`statusCode/headers/body`は不要）
  - Gatewayが自動的にMCPツールとしてエージェントに公開
  - ツールスキーマ（name, description, inputSchema）をGatewayターゲット作成時に定義
- **Implications**: twitter-read/twitter-writeも同じパターンで実装可能。既存のtweet_fetcher/tweet_posterのロジックを再利用できる

### Twitter API認証方式の分離
- **Context**: 参照と投稿で異なる認証方式が必要
- **Sources Consulted**: 既存の`twitter_client.py`, tweepy公式ドキュメント
- **Findings**:
  - 参照（GET endpoints）: Bearer Token（OAuth 2.0 App-Only）で十分
  - 投稿（POST endpoints）: OAuth 1.0a（api_key, api_secret, access_token, access_token_secret）が必要
  - SSM Parameter Storeに既に全認証情報が格納済み（`/tonari/twitter/*`）
- **Implications**: Lambda分離により、各Lambdaは必要最小限の認証情報のみアクセスする設計が可能

### Trigger Lambdaの簡素化
- **Context**: 現在のtweet-scheduler Lambdaは全パイプラインを実行しているが、Gateway化によりエージェント自律実行に変更
- **Sources Consulted**: 既存の`index.py`, `agentcore_invoker.py`, `app.py`
- **Findings**:
  - 現在のLambdaはfetch→generate→post（→notify）のパイプラインを手続き的に実行
  - Gateway化後は、Lambdaの役割はAgentCore Runtimeの呼び出しのみ
  - エージェントがツールを使って自律的にパイプラインを実行
  - 既存のCognito M2M認証でAgentCore Runtimeを呼び出す仕組みはそのまま活用
- **Implications**: tweet_fetcher, tweet_poster, twitter_client, agentcore_invokerは不要になり、Trigger Lambdaは極めてシンプルになる

### エージェントによるセルフレビュー
- **Context**: ツイート品質チェックをエージェント自身の推論で実行する方法
- **Sources Consulted**: 既存のシステムプロンプト、AgentCore Memory統合
- **Findings**:
  - エージェントはStrands Agentフレームワーク上で動作し、ツール呼び出しと推論を自律的に実行
  - プロンプトにレビュー指示を含めることで、生成→レビュー→投稿のフローをエージェントに委ねられる
  - LTMはセッション記録として自動的に保存されるため、明示的な通知ステップは不要
- **Implications**: システムプロンプトまたはTrigger Lambdaからのプロンプトにレビュー指示を含める

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Gateway Lambda Target | Twitter操作をLambdaターゲットとしてGateway経由で公開 | 既存パターン踏襲、ツール再利用可能、エージェント自律実行 | Gatewayの追加レイテンシ | 採用 |
| Direct Tool Integration | エージェントコード内にTwitter操作を直接埋め込み | レイテンシ最小 | 再利用不可、エージェントコード肥大化 | 不採用 |
| Separate API Gateway | REST APIとしてTwitter操作を公開 | 標準的なAPI | MCP統合に別途アダプタ必要 | 不採用 |

## Design Decisions

### Decision: Lambda分離戦略
- **Context**: Twitter参照と投稿をどのように分離するか
- **Alternatives Considered**:
  1. 1つのLambdaで参照・投稿を両方処理（ツール名で分岐）
  2. 参照と投稿を別々のLambdaとして分離
- **Selected Approach**: 2. 参照と投稿を別々のLambdaとして分離
- **Rationale**: 認証方式が異なる（Bearer Token vs OAuth 1.0a）、責務が明確に分離、IAM権限の最小化原則に合致
- **Trade-offs**: Lambda数は増えるが、各Lambdaのシンプルさが向上
- **Follow-up**: CDKスタックで両Lambdaを定義

### Decision: Trigger Lambdaのプロンプト設計
- **Context**: エージェントに自律的パイプラインを実行させるためのプロンプト
- **Alternatives Considered**:
  1. システムプロンプトにツイート手順を常時含める
  2. Trigger Lambdaからのプロンプトに手順を含める
- **Selected Approach**: 2. Trigger Lambdaからのプロンプトに手順を含める
- **Rationale**: Webチャット利用時にツイート手順が不要に混入しない。Trigger Lambda専用のプロンプトとして分離できる
- **Trade-offs**: プロンプト管理箇所が増える
- **Follow-up**: プロンプト内容はagentcore_invoker.pyの_build_promptを参考に設計

### Decision: 既存Gatewayへのターゲット追加
- **Context**: 新しいGatewayを作成するか、既存のtonarigatewayにターゲットを追加するか
- **Selected Approach**: 既存のtonarigatewayにTwitterターゲットを追加
- **Rationale**: 既存のIAM認証設定を再利用、エージェントのGateway URL変更不要
- **Follow-up**: `agentcore gateway create-mcp-gateway-target`コマンドで追加

## Risks & Mitigations
- **Gateway障害時のフォールバック**: 既存のapp.pyにGateway失敗時のフォールバック機構あり。ツイートパイプラインではツール必須のため、失敗時はツイートスキップで対応
- **Lambdaコールドスタート**: Twitter API呼び出しのレイテンシ（数秒）に比べれば無視可能
- **Twitter API Rate Limit**: 現在と同等のAPI呼び出し頻度（1日2回）のため問題なし

## References
- AgentCore Gateway Integration: https://aws.github.io/bedrock-agentcore-starter-toolkit/examples/gateway-integration.md
- 既存perfume-search Lambda: `infra/lambda/perfume-search/index.py`
- 既存tweet-scheduler Lambda: `infra/lambda/tweet-scheduler/index.py`
