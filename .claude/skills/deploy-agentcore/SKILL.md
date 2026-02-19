---
name: deploy-agentcore
description: AgentCoreバックエンドをデプロイする。バックエンド変更時、エージェント更新時に使用。
allowed-tools: Bash
---

# AgentCoreデプロイスキル

バックエンドのAgentCoreをAWS Bedrock AgentCore Runtimeにデプロイします。

## 実行手順

1. **デプロイ実行**

   ```bash
   cd agentcore && uv run agentcore deploy
   ```

## 使用場面

- バックエンドのコード（`agentcore/`配下）を変更した時
- システムプロンプト（`prompts.py`）を変更した時
- エージェントの設定（`tonari_agent.py`）を変更した時
- ツールを追加・変更した時

## 注意事項

- デプロイには数十秒かかる場合がある
- デプロイ後、変更が反映されるまで少し時間がかかることがある
- フロントエンドの変更のみの場合はデプロイ不要