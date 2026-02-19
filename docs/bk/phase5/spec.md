# Phase 5: バックエンド基盤構築 (Strands Agents + AgentCore)

## 目的

Strands Agentsを使用したエージェントをAmazon Bedrock AgentCore Runtimeにデプロイし、Next.jsフロントエンドから呼び出せる状態にする。

## 完了条件

- [x] Python開発環境が構築され、Strands Agentsが動作する
- [x] Scenseiエージェントがローカルで動作確認できる
- [x] AgentCore Runtimeにデプロイされている
- [x] Next.jsからAgentCore Runtime経由でエージェントを呼び出せる
- [x] 感情タグ付きレスポンスが正しく返却される
- [x] ストリーミングレスポンスが動作する（当初Phase 9予定を前倒し実装）

## 前提条件

- AWSアカウント（Bedrock利用可能、Claude Haiku 4.5へのアクセス有効化済み）
- Python 3.12以上
- AWS CLI設定済み（デフォルトリージョン: ap-northeast-1）
- 適切なIAMパーミッション

---

## 実装タスク

### 5.1 開発環境セットアップ

#### Pythonプロジェクト初期化

```bash
# backendディレクトリ作成
mkdir -p agentcore/src/agent agentcore/tests
cd backend

# pyproject.toml作成（uv推奨）
uv init
uv add strands-agents strands-agents-tools bedrock-agentcore
uv add --dev pytest pytest-asyncio
```

#### ディレクトリ構成

```
agentcore/
├── src/
│   └── agent/
│       ├── __init__.py
│       ├── scensei_agent.py    # メインエージェント
│       └── prompts.py          # システムプロンプト
├── tests/
│   └── __init__.py
├── app.py                      # AgentCore Runtime エントリポイント
├── pyproject.toml
└── README.md
```

---

### 5.2 基本エージェント実装

#### システムプロンプト

```python
# agentcore/src/agent/prompts.py

SCENSEI_SYSTEM_PROMPT = """
あなたの名前は「Scensei」（センセイ）です。香水の世界に精通した、洗練されたパーソナルフレグランスコンサルタントです。

## キャラクター設定
- 香水の魅力を伝えることに情熱を持つ
- 上品でありながら親しみやすい話し方
- 専門知識を分かりやすく説明できる
- ユーザーの好みや気分に寄り添った提案をする

## 応答形式
感情タグを使ってキャラクターの表情を制御します。
使用可能なタグ: [neutral], [happy], [sad], [angry], [relaxed], [surprised]

例:
[happy]素敵な香りをお探しなんですね！[neutral]どんなシーンで使いたいですか？
"""
```

#### エージェント実装

```python
# agentcore/src/agent/scensei_agent.py

from strands import Agent
from strands.models import BedrockModel
from .prompts import SCENSEI_SYSTEM_PROMPT

def create_scensei_agent() -> Agent:
    """Scenseiエージェントを作成"""
    bedrock_model = BedrockModel(
        model_id="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
        region_name="ap-northeast-1",
        streaming=True
    )

    agent = Agent(
        model=bedrock_model,
        system_prompt=SCENSEI_SYSTEM_PROMPT,
    )
    return agent
```

---

### 5.3 AgentCore Runtimeデプロイ

#### エントリポイント（ストリーミング対応）

```python
# agentcore/app.py

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from src.agent.scensei_agent import create_scensei_agent

app = BedrockAgentCoreApp()
agent = create_scensei_agent()

@app.entrypoint
async def invoke(payload: dict):
    """エージェント呼び出しエントリポイント（ストリーミング）"""
    prompt = payload.get("prompt", "") if isinstance(payload, dict) else str(payload)

    stream = agent.stream_async(prompt)
    async for event in stream:
        if isinstance(event, dict) and "data" in event:
            text = event["data"]
            if isinstance(text, str):
                yield text

if __name__ == "__main__":
    app.run(port=8080)
```

#### デプロイ手順

```bash
cd backend

# Inbound Auth（Cognito M2M）を設定
agentcore configure -e app.py

# デプロイ
agentcore deploy --auto-update-on-conflict

# エンドポイント確認
agentcore status
```

---

### 5.4 Next.js連携（Cognito M2M認証）

#### 設定ファイル

```json
// config/agentcore.json
{
  "region": "ap-northeast-1",
  "runtimeArn": "arn:aws:bedrock-agentcore:ap-northeast-1:xxx:runtime/scensei-xxx",
  "cognito": {
    "tokenEndpoint": "https://xxx.auth.ap-northeast-1.amazoncognito.com/oauth2/token",
    "clientId": "xxx",
    "scope": "agentcore-m2m-xxx/read agentcore-m2m-xxx/write"
  }
}
```

#### 環境変数

```bash
# .env.local
COGNITO_CLIENT_SECRET=xxx
```

#### API Route（SSEストリーミング）

Next.js API Route (`src/pages/api/ai/agentcore.ts`) で以下を実装：

1. Cognito M2Mトークン取得
2. AgentCore Runtime HTTP API呼び出し
3. SSE形式でフロントエンドにストリーミング

#### フロントエンド

`src/features/chat/agentCoreChat.ts` でSSEをパースし、ReadableStreamとして返却。
感情タグのパースはフロントエンドの既存処理（`handlers.ts`）で実行。

---

## 技術的な決定事項

### 認証方式
- **Inbound Auth（Cognito M2M）** を採用
- AWS SDKではなくHTTP API + Bearer Tokenで呼び出し
- クライアントシークレットのみ環境変数で管理

### ストリーミング
- バックエンド: `agent.stream_async()` + `yield`
- AgentCore → Next.js: SSE形式
- Next.js → フロントエンド: SSE形式

### 感情タグ処理
- バックエンドはテキストをそのままストリーミング
- フロントエンドで感情タグをパース（既存の `handlers.ts` を活用）

---

## 参考リンク

- [Strands Agents 公式ドキュメント](https://strandsagents.com/latest/)
- [Strands + AgentCore デプロイガイド](https://strandsagents.com/latest/documentation/docs/user-guide/deploy/deploy_to_bedrock_agentcore/)
- [AgentCore Starter Toolkit](https://aws.github.io/bedrock-agentcore-starter-toolkit/)
- [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)

---

## 備考

- ツール機能（香水検索、Web検索）はPhase 7で追加
- 記憶機能（セッション管理、ユーザープロファイル）はPhase 6で追加
- AgentCore RuntimeはGA済み（ap-northeast-1を含む複数リージョンで利用可能）
- Claude Haiku 4.5はjp.プレフィックス付きのInference Profileを使用
