---
name: deploy-agentcore
description: AgentCoreバックエンドをデプロイする。バックエンド変更時、エージェント更新時に使用。
allowed-tools: Bash
---

# AgentCoreデプロイスキル

バックエンドのAgentCoreをAWS Bedrock AgentCore Runtimeにデプロイします。
インフラはCDK（`infra/`）で管理されており、Dockerビルド・ECRプッシュ・Runtime更新はすべてCDKが自動で行います。

## 実行手順

```bash
cd infra && npx cdk deploy --require-approval never
```

CDKが `agentcore/` ディレクトリのDockerfileを自動ビルドし、コンテンツハッシュベースのタグでECRにプッシュします。
コードが変更された場合のみRuntimeが更新されます。

## 使用場面

- バックエンドのコード（`agentcore/`配下）を変更した時
- システムプロンプト（`prompts.py`）を変更した時
- エージェントの設定（`tonari_agent.py`）を変更した時
- ツールを追加・変更した時
- Lambda関数やインフラ設定（`infra/`配下）を変更した時

## 注意事項

- フロントエンドの変更のみの場合はデプロイ不要（Vercelで自動デプロイ）
- Gateway TargetのTavily統合はAWSコンソールから手動で設定する必要がある
