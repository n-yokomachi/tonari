# Implementation Plan

- [x] 1. (P) Agent コンテナ用 Dockerfile を作成する
  - Python 3.12 slim ベースイメージで ARM64 互換のコンテナを定義する
  - uv を使った高速な依存関係インストールを構成する
  - `pyproject.toml` の全依存関係と `aws-opentelemetry-distro` をインストールする
  - agentcore 配下のソースコードをコンテナにコピーする
  - OpenTelemetry インストルメンテーション付きのエントリポイントを設定する
  - _Requirements: 6.2, 6.5_

- [x] 2. CognitoConstruct を実装する
- [x] 2.1 (P) User Pool、Resource Server、App Client、Domain を作成するコンストラクトを実装する
  - M2M 認証専用の User Pool を作成する（セルフサインアップ無効）
  - Resource Server を `agentcore-m2m` 識別子で作成し、`read` / `write` スコープを定義する
  - `client_credentials` フロー対応の App Client を作成する（シークレット生成有効）
  - User Pool Domain を設定する（グローバル一意の prefix を使用）
  - User Pool ID、Client ID、OIDC Discovery URL、Token Endpoint をコンストラクトのプロパティとして公開する
  - `removalPolicy: DESTROY` で `cdk destroy` 時のクリーンアップを可能にする
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.2 App Client の Client Secret を SSM Parameter Store に格納する仕組みを追加する
  - Custom Resource で Cognito の Client Secret を取得し、SSM SecureString パラメータに書き込む
  - パラメータパスは `/tonari/cognito/client_secret` とする
  - SSM パラメータ ARN をコンストラクトのプロパティとして公開する
  - _Requirements: 4.6_

- [x] 3. (P) WorkloadConstruct を実装する（既存リソースの移設）
  - `tonari-stack.ts` から Lambda（perfume-search, perfume-crud, api-authorizer, tts, twitter-read, twitter-write, tweet-trigger）、DynamoDB、API Gateway、EventBridge Schedules を切り出す
  - 各 Lambda 関数と DynamoDB テーブルをコンストラクトのプロパティとして公開する（Gateway ターゲット登録やスタック出力に必要）
  - Cognito User Pool ID / Client ID を Props として受け取り、api-authorizer Lambda の環境変数に渡す
  - Runtime ARN / Cognito Token Endpoint / Cognito Scope を Props として受け取り、tweet-trigger Lambda の環境変数に渡す
  - 既存のリソース名（`tonari-perfumes`、`tonari-perfume-search` 等）は維持して CloudFormation の置換を防ぐ
  - _Requirements: 7.4, 8.1, 8.2, 8.3, 8.4_

- [x] 4. AgentCoreConstruct を実装する
- [x] 4.1 (P) AgentCore Memory リソースを CDK で作成する
  - CfnMemory を使い、STM + LTM モードで Memory を構成する
  - イベント保持期間を 30 日に設定する
  - LTM ストラテジーとして userPreference、semantic、summary、episodic の 4 種を定義する
  - 各ストラテジーの namespace パスを既存のエージェントコード（`tonari_agent.py` の `RetrievalConfig`）と一致させる
  - Memory ID をコンストラクトのプロパティとして公開する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4.2 (P) ECR リポジトリ、CodeBuild プロジェクト、ビルドトリガーを作成する
  - ECR リポジトリを作成する
  - ARM64 ビルド環境（LinuxArmBuildImage）の CodeBuild プロジェクトを作成する
  - buildspec で ECR ログイン → Docker ビルド → ECR プッシュのフローを定義する
  - CodeBuild の IAM ロールに ECR push 権限を付与する
  - AwsCustomResource を使い、cdk deploy 時に CodeBuild を自動トリガーする仕組みを実装する
  - ECR リポジトリ URI をコンストラクトのプロパティとして公開する
  - _Requirements: 1.2, 1.3, 6.1, 6.3, 6.4_

- [x] 4.3 MCP Gateway と Lambda ターゲットを作成する
  - Gateway 用 IAM ロールを作成し、3 つの Lambda 関数（perfume-search, twitter-read, twitter-write）の invoke 権限を付与する
  - CfnGateway を MCP プロトコルタイプ、Cognito JWT authorizer 付きで作成する
  - CfnGatewayTarget で 3 つの Lambda ターゲットを登録する
  - 各ターゲットのツールスキーマ（inlinePayload）を既存 Lambda のインタフェース仕様に合わせて定義する
  - Lambda ARN は Props として WorkloadConstruct から受け取る
  - Cognito の OIDC Discovery URL と Client ID は Props として CognitoConstruct から受け取る
  - Gateway URL をコンストラクトのプロパティとして公開する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4.4 AgentCore Runtime をコンテナデプロイモードで作成する
  - Runtime 用 IAM ロールを作成し、Bedrock モデル呼び出し、Memory アクセス、Gateway アクセス、Observability（CloudWatch Logs, X-Ray, CloudWatch Metrics）の権限を付与する
  - CfnRuntime を ContainerConfiguration で作成し、ECR イメージ URI を指定する
  - PUBLIC ネットワークモード、HTTP プロトコルを設定する
  - Cognito JWT authorizer を適用する
  - 環境変数に Memory ID、Gateway URL、AWS Region、Bedrock Model ID を設定する
  - Runtime ARN をコンストラクトのプロパティとして公開する
  - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7_

- [x] 4.5 Observability（CloudWatch Logs + X-Ray）を構成する
  - Runtime 用の CloudWatch Logs ロググループを Vended Logs パターンで作成する（保持期間 14 日）
  - ログ配信ソース・配信先・配信リソースを構成し、APPLICATION_LOGS を CloudWatch Logs に送信する
  - トレース配信ソース・配信先・配信リソースを構成し、TRACES を X-Ray に送信する
  - Runtime 作成後に構成されるよう依存関係を設定する
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. TonariStack をオーケストレーション層にリファクタする
- [x] 5.1 TonariStack を各コンストラクトの組み立てと接続のみに書き換える
  - CognitoConstruct、WorkloadConstruct、AgentCoreConstruct をインスタンス化する
  - コンストラクト間の接続を定義する（Cognito ID → Workload Lambda env、Lambda ARN → AgentCore Gateway Target、Runtime ARN → Workload tweet-trigger env 等）
  - TonariStackProps から `cognitoUserPoolId` / `cognitoClientId` を削除する
  - 維持する Props: `tweetScheduler.ownerTwitterUserId`、`tweetScheduler.ssmCognitoClientSecret`
  - _Requirements: 7.4, 9.1_

- [x] 5.2 全新規リソースの CfnOutput を追加する
  - Runtime ARN、Memory ID、Gateway URL、Cognito User Pool ID、Cognito Client ID、Token Endpoint、Scope を出力する
  - _Requirements: 7.1_

- [x] 6. CDK エントリポイントと設定ファイルを更新する
- [x] 6.1 (P) `infra/bin/infra.ts` から不要な context 参照を削除する
  - `tryGetContext('cognitoUserPoolId')` / `tryGetContext('cognitoClientId')` を削除する
  - `tweetScheduler` から `ownerTwitterUserId` と `ssmCognitoClientSecret` のみ取得する形に変更する
  - _Requirements: 7.4_

- [x] 6.2 (P) `infra/cdk.json` の context を整理する
  - CDK 管理リソースの ID/ARN（`cognitoUserPoolId`、`cognitoClientId`、`tweetScheduler.agentcoreRuntimeArn`、`cognitoTokenEndpoint`、`cognitoScope`）を削除する
  - 維持するキー: `tweetScheduler.ownerTwitterUserId`、`tweetScheduler.ssmCognitoClientSecret`
  - _Requirements: 7.4_

- [x] 7. CDK synth でテンプレート生成を検証する
  - `cdk synth` を実行し、全リソース（Cognito, Lambda, DynamoDB, API Gateway, EventBridge, Runtime, Memory, Gateway, GatewayTarget, ECR, CodeBuild, Observability）が含まれることを確認する
  - リソース間の依存関係（DependsOn）が正しく設定されていることを確認する
  - 既存リソースのプロパティ（Lambda 名、DynamoDB テーブル名等）が変更されていないことを確認する
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3_
