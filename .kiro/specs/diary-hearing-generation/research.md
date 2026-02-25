# Research & Design Decisions

## Summary
- **Feature**: `diary-hearing-generation`
- **Discovery Scope**: Extension（既存システムへの機能追加）
- **Key Findings**:
  - ヒアリングモードはシステムプロンプトの指示のみで実現可能（コードロジック不要）
  - 既存のperfume-search/perfume-crudパターンに従い、diary-tool Lambda（エージェント用）とdiary-admin用Next.js APIルートを構築
  - DynamoDB PK=userId, SK=date（YYYY-MM-DD）で1日1エントリのシンプルな設計

## Research Log

### エージェントのヒアリングモード実現方式
- **Context**: 日記ヒアリングの会話フローをどのように実装するか
- **Sources Consulted**: `agentcore/src/agent/prompts.py`、`tonari_agent.py`の既存パターン
- **Findings**:
  - 現在のシステムプロンプト（prompts.py）は出力フォーマット指示（感情タグ、ジェスチャー等）を含む
  - ツール呼び出しの自然化指示がある（「データベース検索」ではなく「自分の経験」として語る）
  - ヒアリングモードはプロンプト指示のみで制御可能。特別なコード分岐やステートマシンは不要
- **Implications**: prompts.pyに日記ヒアリング用のセクションを追加するだけでRequirement 1, 2を実現

### Lambda関数の設計パターン
- **Context**: 既存のLambda関数パターンとの整合性
- **Sources Consulted**: `infra/lambda/perfume-search/index.py`、`infra/lambda/perfume-crud/index.py`
- **Findings**:
  - perfume-searchはAgentCore Gateway target用（シンプルなeventフォーマット）
  - perfume-crudはREST API Gateway用（httpMethod, path等のproxy format）
  - 同一DynamoDBテーブルを2つのLambdaで共有するパターンが既に確立されている
- **Implications**: diary-tool Lambda（Gateway target用）を作成。管理画面はNext.js APIルートからDynamoDBを直接操作（Lambda不要）

### 管理画面アクセスパターンの簡素化
- **Context**: 日記管理画面のデータアクセス方法
- **Sources Consulted**: `src/pages/api/admin/perfumes/index.ts`、`infra/lib/workload-construct.ts`
- **Findings**:
  - 既存のperfumes管理はNext.js API route → REST API Gateway → Lambda → DynamoDBの3層
  - 日記管理は読み取り専用（一覧・詳細表示のみ）で、CRUDの複雑さは不要
  - Next.js API routeからAWS SDKでDynamoDBに直接アクセスすれば、Lambda+API Gatewayを省略可能
- **Implications**: diary-admin用にはLambdaを追加せず、Next.js API routeからDynamoDBを直接クエリ。AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY環境変数が必要

## Design Decisions

### Decision: ヒアリングモードの実現方式
- **Context**: ユーザーが「日記を書きたい」と言った際のモード切替
- **Alternatives Considered**:
  1. コード内ステートマシン — agent_state変数でモード管理
  2. システムプロンプト指示 — LLMのin-context能力で会話フローを制御
- **Selected Approach**: システムプロンプト指示のみ
- **Rationale**: Strands AgentのLLMは十分な会話制御能力を持つ。コード内ステートマシンは不要な複雑性を追加する
- **Trade-offs**: LLMの判断に依存するため、完全に決定的なフロー制御はできないが、日記ヒアリングの性質上柔軟性が望ましい

### Decision: 管理画面からのDynamoDBアクセス方式
- **Context**: 管理画面の日記閲覧APIをどう実装するか
- **Alternatives Considered**:
  1. REST API Gateway + Lambda（perfumeパターン踏襲）
  2. Next.js API routeからDynamoDB直接アクセス
- **Selected Approach**: Next.js API routeからDynamoDB直接アクセス（AWS SDK使用）
- **Rationale**: 読み取り専用の単純なクエリにLambda+API Gateway層は過剰。環境変数にAWSクレデンシャルを追加するだけで実現可能
- **Trade-offs**: perfumeパターンとの不一致。ただし日記の管理画面は参照のみなのでシンプルさを優先

### Decision: DynamoDBキー設計
- **Context**: 日記テーブルのパーティションキー・ソートキー設計
- **Alternatives Considered**:
  1. PK=userId, SK=date（YYYY-MM-DD）— 1日1エントリ
  2. PK=userId, SK=createdAt（ISO8601）— 1日複数エントリ可
- **Selected Approach**: PK=userId, SK=date（YYYY-MM-DD）
- **Rationale**: 日記は1日1エントリが自然。同じ日に再度書くと上書き。シンプルなキー設計でクエリも容易
- **Trade-offs**: 1日に複数の日記を書けない制約。ただし日記の性質上これは合理的

## Risks & Mitigations
- ヒアリングモードでLLMが意図通りに動作しない場合 → プロンプトの反復改善で対応
- DynamoDB直接アクセスのAWSクレデンシャル管理 → Vercel環境変数で適切に管理、IAMポリシーで最小権限
- 管理画面で大量の日記を表示する際のパフォーマンス → DynamoDBクエリのLimit + ページネーション対応

## References
- [Strands Agents Documentation](https://strandsagents.com/) — エージェントのシステムプロンプト設計
- [AWS CDK DynamoDB](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb-readme.html) — テーブル設計
- [AgentCore Gateway Targets](https://docs.aws.amazon.com/bedrock-agentcore/) — ツール登録パターン
