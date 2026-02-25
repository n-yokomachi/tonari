# Research Log — AgentCore CDK Migration

## サマリー

AgentCore リソース（Runtime, Memory, Gateway, GatewayTarget）の CDK/CloudFormation サポート状況、およびコンテナデプロイパイプライン・Observability の構成方法を調査した。

## 調査ログ

### Topic 1: BedrockAgentCore L1 コンストラクトの利用可否

**調査方法:** CDK v2.240.0 の `aws-cdk-lib/aws-bedrockagentcore` モジュールを直接検査

**結果:**
- `CfnRuntime` / `CfnMemory` / `CfnGateway` / `CfnGatewayTarget` の 4 種類すべてが L1 コンストラクトとして利用可能
- その他: `CfnBrowserCustom`, `CfnCodeInterpreterCustom`, `CfnRuntimeEndpoint`, `CfnWorkloadIdentity` も存在するが本プロジェクトでは不要

### Topic 2: CfnRuntime — ContainerConfiguration によるデプロイ

**ソース:** AgentCore ドキュメント `examples/infrastructure-as-code/cdk/basic-runtime/basic-cdk-deploy-sample.md`

**主要プロパティ:**
- `agentRuntimeArtifact.containerConfiguration.containerUri` — ECR イメージ URI
- `networkConfiguration.networkMode` — `"PUBLIC"` or `"PRIVATE"`
- `protocolConfiguration` — `"HTTP"`
- `roleArn` — IAM ロール ARN（`bedrock-agentcore.amazonaws.com` を信頼）
- `environmentVariables` — `Record<string, string>`
- `authorizerConfiguration.customJwtAuthorizer` — JWT 認証設定

**JWT Authorizer 設定:**
```typescript
{
  discoveryUrl: string;           // Cognito OIDC discovery URL
  allowedClients?: string[];      // 許可する Client ID
  allowedAudience?: string[];     // 許可する Audience
  allowedScopes?: string[];       // 許可するスコープ
}
```

### Topic 3: CfnMemory — STM+LTM 構成

**ソース:** CDK 型定義 + AgentCore ドキュメント

**主要プロパティ:**
- `name` — メモリ名
- `eventExpiryDuration` — イベント保持日数
- `memoryStrategies` — LTM ストラテジー配列

**ストラテジー種別:**
- `semanticMemoryStrategy` — 事実・ファクト抽出（セマンティック検索）
- `summaryMemoryStrategy` — セッションサマリー
- `episodicMemoryStrategy` — エピソード記憶
- `userPreferenceMemoryStrategy` — ユーザー好み抽出
- `customMemoryStrategy` — カスタム

**現行構成（`.bedrock_agentcore.yaml` より）:**
- mode: `STM_AND_LTM`
- event_expiry_days: 30
- 名前空間: `/preferences/{actorId}/`, `/facts/{actorId}/`, `/summaries/{actorId}/`, `/episodes/{actorId}/`

### Topic 4: CfnGateway / CfnGatewayTarget — Lambda ターゲット

**ソース:** CDK 型定義

**CfnGateway 主要プロパティ:**
- `name` — Gateway 名
- `protocolType` — `"MCP"`
- `authorizerType` — 認証タイプ
- `authorizerConfiguration.customJwtAuthorizer` — JWT 認証（Runtime と同形式）
- `roleArn` — Gateway 実行ロール

**CfnGatewayTarget 主要プロパティ:**
- `gatewayIdentifier` — 親 Gateway の ID
- `name` — ターゲット名
- `targetConfiguration.mcp.lambda` — Lambda ターゲット設定
  - `lambdaArn` — Lambda 関数 ARN
  - `toolSchema.inlinePayload` — ツール定義配列

**ツール定義構造:**
```typescript
{
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}
```

**注:** 現行の Gateway は CLI で管理されており、ツールスキーマは Gateway 側に保持されている。CDK 移行時はツールスキーマを `inlinePayload` として定義する必要がある。

### Topic 5: Observability — CloudWatch Logs + X-Ray

**ソース:** AgentCore CloudFormation テンプレート `cloudformation-deploy-with-tools-and-memory-template.md`

**構成パターン（Vended Logs）:**
1. `AWS::Logs::LogGroup` — ロググループ作成（`/aws/vendedlogs/bedrock-agentcore/{runtimeId}`）
2. `AWS::Logs::DeliverySource` — ログソース（Runtime ARN、LogType: `APPLICATION_LOGS`）
3. `AWS::Logs::DeliveryDestination` — ログ配信先（CWL タイプ、LogGroup ARN）
4. `AWS::Logs::Delivery` — ソース→配信先の接続

**X-Ray トレース:**
1. `AWS::Logs::DeliverySource` — トレースソース（Runtime ARN、LogType: `TRACES`）
2. `AWS::Logs::DeliveryDestination` — トレース配信先（XRAY タイプ）
3. `AWS::Logs::Delivery` — ソース→配信先の接続

**IAM 権限:** Runtime 実行ロールに CloudWatch Logs / X-Ray / CloudWatch Metrics 権限が必要

### Topic 6: コンテナビルドパイプライン

**現状:**
- `deployment_type: direct_code_deploy`（S3 経由でソースコードをアップロード）
- Dockerfile は存在しない（CLI が自動生成）
- Python 3.12、ARM64 プラットフォーム

**移行先:**
- ECR リポジトリ + CodeBuild プロジェクトで Docker イメージをビルド
- `ContainerConfiguration.containerUri` で Runtime に紐付け
- Dockerfile を新規作成する必要あり
- OpenTelemetry インストルメンテーション（`aws-opentelemetry-distro`）をコンテナに含める

### Topic 7: Cognito M2M 認証

**現行リソース（CLI 作成済み）:**
- User Pool: `ap-northeast-1_9YLOHAYn6`
- App Client: `1qemnml5e11reu81d0jap2ele3`（client_credentials フロー）
- Resource Server: `agentcore-m2m-03ce8ee4` — スコープ: `read`, `write`
- Domain: `tonari-m2m-identity`
- Client Secret: SSM `/tonari/cognito/client_secret`

**CDK 移行時:** すべて新規作成。Client ID / Secret / Domain が変わるため、関連する全設定の更新が必要。

## アーキテクチャパターン評価

### パターン: 単一 CDK スタック拡張

既存の `TonariStack` に AgentCore リソースを追加する方式を採用。

**理由:**
- リソース間の参照（Lambda ARN → GatewayTarget、Cognito → Runtime/Gateway authorizer 等）がスタック内で完結
- 既存の Lambda / DynamoDB / API Gateway / EventBridge との依存関係が密
- プロジェクト規模として単一スタックで十分

**リスク:**
- スタックが大きくなるが、CloudFormation の 500 リソース制限には余裕あり

### カスタムリソース vs ネイティブ L1

Gateway は L1 コンストラクト（`CfnGateway` / `CfnGatewayTarget`）が利用可能なため、カスタムリソースは不要。

## 未解決事項

- Gateway のツールスキーマ定義は、各 Lambda のインタフェース仕様から手動で CDK コードに記述する必要がある
- Memory ストラテジーの CDK プロパティ名は型定義から確認済みだが、ドキュメントの CloudFormation サンプルにはストラテジー付きの例がない。型定義に従って実装し、デプロイ時に検証する
