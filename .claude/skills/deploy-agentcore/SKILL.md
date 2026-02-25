---
name: deploy-agentcore
description: AgentCoreバックエンドをデプロイする。バックエンド変更時、エージェント更新時に使用。
allowed-tools: Bash
---

# AgentCoreデプロイスキル

バックエンドのAgentCoreをAWS Bedrock AgentCore Runtimeにデプロイします。
インフラはCDK（`infra/`）で管理されており、コンテナイメージはECR経由でデプロイします。

## 実行手順

### エージェントコードのみ変更した場合（`agentcore/`配下）

1. **Dockerイメージのビルド**

   ```bash
   cd agentcore && docker build --platform linux/arm64 -t 765653276628.dkr.ecr.ap-northeast-1.amazonaws.com/tonari-agentcore:latest -f Dockerfile .
   ```

2. **ECRにプッシュ**

   ```bash
   aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 765653276628.dkr.ecr.ap-northeast-1.amazonaws.com && docker push 765653276628.dkr.ecr.ap-northeast-1.amazonaws.com/tonari-agentcore:latest
   ```

3. **CDKデプロイ（Runtimeの環境変数DEPLOY_VERSIONが更新され、新イメージが反映される）**

   ```bash
   npx cdk deploy --require-approval never
   ```

### インフラ変更を含む場合（`infra/`配下）

1. **CDKデプロイのみ実行**

   ```bash
   npx cdk deploy --require-approval never
   ```

   CDKデプロイ時にCodeBuildが自動トリガーされ、ECRイメージも再ビルドされる。

## 使用場面

- バックエンドのコード（`agentcore/`配下）を変更した時
- システムプロンプト（`prompts.py`）を変更した時
- エージェントの設定（`tonari_agent.py`）を変更した時
- ツールを追加・変更した時
- Lambda関数やインフラ設定（`infra/`配下）を変更した時

## 注意事項

- エージェントコード変更時はDockerビルド＋ECRプッシュ＋CDKデプロイの3ステップが必要
- CDKデプロイだけではECRイメージ内のコードは更新されない（CodeBuildはGitHubのmainブランチからビルドするため、ローカル変更を反映するにはDockerビルド＋ECRプッシュが必要）
- フロントエンドの変更のみの場合はデプロイ不要（Vercelで自動デプロイ）
- Gateway TargetのTavily統合はAWSコンソールから手動で設定する必要がある