# Requirements Document

## Project Description (Input)
AgentCore CDK移行：CLI/手動で管理しているAgentCoreリソースおよび関連リソースをすべてCDKに移行する。

### 現状の課題
現在のTonariプロジェクトでは、インフラが以下のように分散管理されている：
- **CDK管理**: Lambda, DynamoDB, API Gateway, EventBridge（infra/lib/tonari-stack.ts）
- **Starter Toolkit CLI管理**: AgentCore Runtime, Memory, Gateway（agentcore deploy / agentcore gateway）
- **CLI作成で未管理**: Cognito User Pool, App Client, Resource Server（agentcore identity setup-cognito で作成、CDKスタックでは props 経由で ID を参照しているのみ）

これを統一し、全リソースをCDK管理下に置く。

### 移行対象
1. **AgentCore Runtime** — CfnRuntime として CDK に追加。ECR + CodeBuild によるコンテナイメージビルドパイプラインを構築（現在の direct_code_deploy から移行）
2. **AgentCore Memory** — CfnMemory として CDK に新規作成（既存データの移行は行わない）
3. **AgentCore Gateway** — CDK/CloudFormation サポート状況を調査し、対応可能であれば CDK 管理に含める
4. **Cognito** — User Pool, App Client, Resource Server を CDK で新規作成（現在は agentcore identity setup-cognito で作成したリソースの ID を props で渡しているだけ）
5. **Observability** — CloudWatch Logs, X-Ray を CDK で設定
6. **デプロイフロー** — agentcore deploy コマンドに依存しないデプロイフローを確立

### 調査結果（CloudFormation サポート状況）
| リソース | CFn リソースタイプ | CDK L1 コンストラクト | サポート状況 |
|---------|-------------------|---------------------|-------------|
| Runtime | `AWS::BedrockAgentCore::Runtime` | `CfnRuntime` | ✅ 確認済み |
| Memory | `AWS::BedrockAgentCore::Memory` | `CfnMemory` | ✅ 確認済み |
| Gateway | `AWS::BedrockAgentCore::Gateway` | `CfnGateway` | ✅ 確認済み |
| Gateway Target | `AWS::BedrockAgentCore::GatewayTarget` | `CfnGatewayTarget` | ✅ 確認済み |
| Cognito | `AWS::Cognito::UserPool` 等 | 標準AWSコンストラクト | ✅ 完全サポート |
| Observability | `AWS::Logs::DeliverySource` 等 | 標準AWSコンストラクト | ✅ 確認済み |

**CDK バージョン:** 2.240.0（全 BedrockAgentCore L1 コンストラクト利用可能）
**L2 コンストラクト:** `@aws-cdk/aws-bedrock-agentcore-alpha` も利用可能（`Gateway.addLambdaTarget()` 等の便利メソッド付き）

## Introduction

Tonariプロジェクトのインフラ管理を統一するため、AgentCore Starter Toolkit CLIおよび手動で管理している全リソースをAWS CDKに移行する。既存のCDKスタック（Lambda, DynamoDB, API Gateway, EventBridge）と合わせ、単一の `cdk deploy` コマンドで全インフラをプロビジョニングできる状態を目指す。

## Requirements

### Requirement 1: AgentCore Runtime のCDK管理

**Objective:** 開発者として、AgentCore RuntimeをCDKで管理したい。これにより `agentcore deploy` コマンドへの依存を排除し、他のインフラと統一的に管理できるようにする。

#### Acceptance Criteria
1.1. When `cdk deploy` を実行した時, the CDKスタック shall AgentCore Runtimeリソースを作成する
1.2. The CDKスタック shall ECRリポジトリを作成し、エージェントのコンテナイメージを格納する
1.3. The CDKスタック shall CodeBuildプロジェクトを作成し、agentcore/配下のソースからDockerイメージをビルドする
1.4. The CDKスタック shall Runtime に必要な環境変数（MEMORY_ID, GATEWAY_URL, AWS_REGION等）を設定する
1.5. The CDKスタック shall Runtimeの実行ロール（IAM Role）を作成し、Bedrock モデル呼び出し・Memory アクセス・Gateway アクセスに必要な権限を付与する
1.6. The CDKスタック shall Runtimeのネットワーク設定をPUBLICモードで構成する
1.7. The CDKスタック shall RuntimeにJWT認証（Cognito）のauthorizer設定を適用する

### Requirement 2: AgentCore Memory のCDK管理

**Objective:** 開発者として、AgentCore MemoryをCDKで管理したい。これにより新しい環境を再現可能な形で構築できるようにする。

#### Acceptance Criteria
2.1. When `cdk deploy` を実行した時, the CDKスタック shall AgentCore Memoryリソースを新規作成する
2.2. The CDKスタック shall MemoryをSTM+LTMモードで構成する
2.3. The CDKスタック shall イベント保持期間を30日に設定する
2.4. The CDKスタック shall 作成されたMemory IDをRuntime環境変数に自動的に渡す

### Requirement 3: AgentCore Gateway のCDK管理

**Objective:** 開発者として、AgentCore GatewayをCDKで管理したい。これにより `agentcore gateway` CLIへの依存を排除し、Gateway とターゲットを他のインフラと統一的に管理できるようにする。

#### Acceptance Criteria
3.1. When `cdk deploy` を実行した時, the CDKスタック shall CfnGateway を使用して MCP Gateway リソースを作成する
3.2. The CDKスタック shall CfnGatewayTarget を使用して Lambda ターゲット（perfume-search, twitter-read, twitter-write）を登録する
3.3. The CDKスタック shall Gateway の認証設定に Cognito JWT authorizer を適用する
3.4. The CDKスタック shall Gateway の実行ロール（IAM Role）を作成し、Lambda ターゲットの invoke 権限を付与する
3.5. The CDKスタック shall Gateway の URL を Runtime 環境変数に自動的に渡す

### Requirement 4: Cognito Identity のCDK管理

**Objective:** 開発者として、Cognito リソースをCDKで管理したい。これにより `agentcore identity setup-cognito` への依存を排除し、環境の再現性を確保する。

#### Acceptance Criteria
4.1. The CDKスタック shall Cognito User Pool を作成する
4.2. The CDKスタック shall M2M認証用の App Client（client_credentials フロー）を作成する
4.3. The CDKスタック shall Resource Server とスコープ（read, write）を作成する
4.4. The CDKスタック shall User Pool ドメインを設定する
4.5. The CDKスタック shall 作成された Client ID と User Pool ID を Runtime の authorizer 設定および Lambda 環境変数に自動的に渡す
4.6. The CDKスタック shall Client Secret を SSM Parameter Store または Secrets Manager に格納し、フロントエンドおよび Lambda から参照可能にする

### Requirement 5: Observability のCDK管理

**Objective:** 開発者として、AgentCore の監視・トレーシング設定をCDKで管理したい。これによりログとトレースを自動的に構成できるようにする。

#### Acceptance Criteria
5.1. The CDKスタック shall Runtime 用の CloudWatch Logs ロググループを作成する
5.2. The CDKスタック shall ログ配信ソース・配信先・配信リソースを構成し、Runtime ログを CloudWatch Logs に送信する
5.3. The CDKスタック shall トレース配信ソース・配信先・配信リソースを構成し、Runtime トレースを X-Ray に送信する
5.4. The CDKスタック shall ロググループの保持期間を14日に設定する

### Requirement 6: コンテナビルドパイプライン

**Objective:** 開発者として、エージェントコードの変更をコンテナイメージとしてビルド・デプロイしたい。これにより `direct_code_deploy` から標準的なコンテナデプロイに移行する。

#### Acceptance Criteria
6.1. The CDKスタック shall ARM64アーキテクチャのDockerイメージをビルドするCodeBuildプロジェクトを作成する
6.2. The CDKスタック shall `agentcore/` 配下のソースコード、`pyproject.toml`、依存関係をコンテナイメージに含める
6.3. When `cdk deploy` を実行した時, the CDKスタック shall CodeBuild をトリガーしてイメージをビルド・ECRにプッシュする
6.4. The CDKスタック shall ビルドされたイメージのURIをRuntimeのContainerConfigurationに設定する
6.5. The CDKスタック shall Python 3.12ランタイムとOpenTelemetryインストルメンテーションをコンテナに含める

### Requirement 7: 設定ファイルの更新

**Objective:** 開発者として、CDK移行後の新しいリソースIDやARNが各設定ファイルに正しく反映されるようにしたい。

#### Acceptance Criteria
7.1. When CDKスタックのデプロイが完了した時, the CDKスタック shall 新しい Runtime ARN、Memory ID、Gateway URL、Cognito 設定を CfnOutput として出力する
7.2. The 設定管理 shall `config/agentcore.json` を CDK 出力値で更新する手順を文書化する
7.3. The 設定管理 shall フロントエンド環境変数（`.env`）に必要な Cognito Client Secret の参照方法を文書化する
7.4. The CDKスタック shall 既存の `cdk.json` のコンテキスト値（cognitoUserPoolId, cognitoClientId 等）を、CDKスタック内部で直接参照する形に変更する（外部からの props 注入を廃止する）

### Requirement 8: 既存機能との互換性

**Objective:** 開発者として、CDK移行後も既存のフロントエンド・バックエンド連携が正常に動作することを確認したい。

#### Acceptance Criteria
8.1. When CDK移行後にフロントエンドからAgentCoreを呼び出した時, the システム shall Cognito M2Mトークン取得 → Runtime呼び出し → SSEストリーミング応答の一連のフローが正常に動作する
8.2. When CDK移行後にGatewayツールを使用した時, the システム shall perfume-search, twitter-read, twitter-write の各ツールが正常に応答する
8.3. When CDK移行後にMemoryを使用した時, the システム shall STM（セッション内会話履歴）とLTM（長期記憶の蓄積・検索）が正常に動作する
8.4. When CDK移行後にEventBridgeスケジュールが発火した時, the システム shall ツイート自動投稿フローが正常に動作する

### Requirement 9: デプロイフローの確立

**Objective:** 開発者として、`agentcore deploy` に依存しないデプロイフローを確立したい。これにより全インフラを単一コマンドで管理できるようにする。

#### Acceptance Criteria
9.1. The デプロイフロー shall `cd infra && cdk deploy` のみで全リソース（Runtime, Memory, Gateway, Cognito, Lambda, DynamoDB, API Gateway, EventBridge, Observability）をプロビジョニングできる
9.2. The デプロイフロー shall エージェントコードの変更時に `cdk deploy` でコンテナイメージの再ビルドとRuntimeの更新を実行できる
9.3. The デプロイフロー shall `cdk destroy` で全リソースをクリーンアップできる
9.4. The デプロイフロー shall 初回デプロイ時に CDK Bootstrap が完了していることを前提条件として文書化する
