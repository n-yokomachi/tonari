# Phase 6: AgentCore Memory（記憶機能）

## 目的

短期記憶（セッション内の会話履歴）と長期記憶（ユーザーの好み）を実装し、継続的な会話体験を提供する。

## 完了条件

- [ ] 短期記憶が動作し、同一セッション内で会話履歴が保持される
- [ ] セッションIDがフロントエンド〜バックエンド間で正しく受け渡しされる
- [ ] セッションを跨いだ会話で過去の会話を参照しない（セッション分離）
- [ ] 長期記憶でユーザーの好みが保持される（localStorage匿名UUID方式）

## 前提条件

- Phase 5が完了していること
- AgentCore Memoryが作成済み（`scensei_mem-INEd7K94yX`）
- 現在のメモリモード: `STM_ONLY`

---

## 実装タスク

### 6.1 短期記憶（セッション内会話履歴）

#### 依存パッケージ追加

```bash
cd backend
uv add 'bedrock-agentcore[strands-agents]'
```

#### AgentCoreMemorySessionManagerの統合

```python
# backend/src/agent/scensei_agent.py

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import AgentCoreMemorySessionManager
from strands import Agent
from strands.models import BedrockModel
from .prompts import SCENSEI_SYSTEM_PROMPT

def create_scensei_agent(session_id: str, actor_id: str = "anonymous") -> Agent:
    """Scenseiエージェントを作成（セッション管理付き）"""

    # AgentCore Memory設定
    memory_config = AgentCoreMemoryConfig(
        memory_id=os.getenv("AGENTCORE_MEMORY_ID", "scensei_mem-INEd7K94yX"),
        session_id=session_id,
        actor_id=actor_id
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=os.getenv("AWS_REGION", "ap-northeast-1")
    )

    bedrock_model = BedrockModel(
        model_id=os.getenv("BEDROCK_MODEL_ID", "jp.anthropic.claude-haiku-4-5-20251001-v1:0"),
        region_name=os.getenv("AWS_REGION", "ap-northeast-1"),
        streaming=True,
    )

    agent = Agent(
        model=bedrock_model,
        system_prompt=SCENSEI_SYSTEM_PROMPT,
        session_manager=session_manager,
    )
    return agent
```

#### app.pyの修正

```python
# backend/app.py

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from src.agent.scensei_agent import create_scensei_agent

app = BedrockAgentCoreApp()

@app.entrypoint
async def invoke(payload: dict):
    """エージェント呼び出しエントリポイント"""
    prompt = payload.get("prompt", "") if isinstance(payload, dict) else str(payload)
    session_id = payload.get("session_id", "default-session")
    actor_id = payload.get("actor_id", "anonymous")

    # セッションごとにエージェントを作成
    agent = create_scensei_agent(session_id=session_id, actor_id=actor_id)

    stream = agent.stream_async(prompt)
    async for event in stream:
        if isinstance(event, dict) and "data" in event:
            text = event["data"]
            if isinstance(text, str):
                yield text
```

---

### 6.2 フロントエンド連携

#### セッションID・ユーザーID管理

```typescript
// src/features/chat/agentCoreChat.ts

// セッションIDを生成・保持（sessionStorage: タブ単位）
const getSessionId = (): string => {
  const key = 'scensei_session_id'
  let sessionId = sessionStorage.getItem(key)
  if (!sessionId) {
    sessionId = `session-${crypto.randomUUID()}`
    sessionStorage.setItem(key, sessionId)
  }
  return sessionId
}

// ユーザーIDを生成・保持（localStorage: ブラウザ単位で永続化）
const getActorId = (): string => {
  const key = 'scensei_actor_id'
  let actorId = localStorage.getItem(key)
  if (!actorId) {
    actorId = `user-${crypto.randomUUID()}`
    localStorage.setItem(key, actorId)
  }
  return actorId
}

export async function getAgentCoreChatResponseStream(
  messages: Message[]
): Promise<ReadableStream<string> | null> {
  const userMessages = messages.filter((m) => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]

  if (!lastUserMessage) {
    return null
  }

  const response = await fetch('/api/ai/agentcore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: lastUserMessage.content,
      sessionId: getSessionId(),  // セッションID（タブ単位）
      actorId: getActorId(),      // ユーザーID（ブラウザ単位）
    }),
  })
  // ...
}
```

#### API Routeの修正

```typescript
// src/pages/api/ai/agentcore.ts

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ...
  const { message, sessionId, actorId } = req.body

  // AgentCore Runtimeへのリクエストにsession_id, actor_idを含める
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': runtimeSessionId,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      prompt: message,
      session_id: sessionId,  // AgentCore Memoryのセッション用
      actor_id: actorId,      // ユーザー識別用（長期記憶）
    }),
  })
  // ...
}
```

---

### 6.3 長期記憶（ユーザーの好み保持）

#### ユーザー識別方式

匿名UUID方式を採用（ログイン不要）：
- `localStorage`にUUIDを保存
- 同じブラウザ = 同じユーザーとして識別
- ブラウザ変更・クリア時は別ユーザー扱い

#### Memory Strategy設定（要検討）

AgentCore Memoryの長期記憶には複数の戦略がある。Phase 6実装時に検討：

| 戦略 | 用途 |
|------|------|
| `userPreferenceMemoryStrategy` | ユーザーの好み（香りの好み等）を学習・保持 |
| `semanticMemoryStrategy` | 事実情報を抽出・保持 |
| `summaryMemoryStrategy` | セッション要約を保持 |

**検討ポイント:**
- どの戦略を使うか（複数併用も可能）
- `retrieval_config`のパラメータ（`top_k`, `relevance_score`）
- メモリモードの変更方法（CLI or AWSコンソール）

#### 長期記憶の活用（実装例）

```python
# backend/src/agent/scensei_agent.py

from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    RetrievalConfig
)

memory_config = AgentCoreMemoryConfig(
    memory_id=MEMORY_ID,
    session_id=session_id,
    actor_id=actor_id,
    # 長期記憶からの検索設定（戦略に応じて調整）
    retrieval_config={
        "/preferences/{actorId}": RetrievalConfig(top_k=5, relevance_score=0.7),
    }
)
```

---

---

### 6.4 検討タスク

Phase 6実装時に以下を検討・決定する：

- [ ] Memory Strategyの選定（userPreference / semantic / summary）
- [ ] `retrieval_config`パラメータの調整
- [ ] メモリモード変更手順の確認（STM_ONLY → FULL）

---

## 設定値

| 項目 | 値 | 備考 |
|------|-----|------|
| Memory ID | `scensei_mem-INEd7K94yX` | 既存のAgentCore Memory |
| Memory ARN | `arn:aws:bedrock-agentcore:ap-northeast-1:765653276628:memory/scensei_mem-INEd7K94yX` | |
| Event Expiry | 30日 | 短期記憶の保持期間 |
| Memory Mode | `STM_ONLY` → `FULL` | 長期記憶を使うため変更 |

---

## テスト項目

### 短期記憶

1. 同一セッション内で「私は柑橘系が好きです」と伝えた後、「おすすめを教えて」と聞くと好みを踏まえた回答が得られる
2. ブラウザをリロード（sessionStorageクリア）すると新しいセッションになり、過去の会話を参照しない
3. 別タブで開くと別セッションとして扱われる

### 長期記憶

1. セッションを跨いでも、同一ブラウザ（actor_id）なら好みが保持される
2. 「私の好みを教えて」と聞くと過去に伝えた好みを回答できる
3. localStorageをクリアすると新しいユーザーとして扱われ、過去の好みは参照されない

---

## 参考リンク

- [Strands Agents - AgentCore Memory](https://strandsagents.com/latest/documentation/docs/community/session-managers/agentcore-memory/)
- [AWS Docs - Strands SDK Memory](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/strands-sdk-memory.html)
- [AgentCore Memory サンプル](https://github.com/aws/bedrock-agentcore-sdk-python/tree/main/src/bedrock_agentcore/memory/integrations/strands)
- [DEV.to - AgentCore STM with Strands](https://dev.to/aws-heroes/amazon-bedrock-agentcore-runtime-part-6-using-agentcore-short-term-memory-with-strands-agents-sdk-55d4)
- [DEV.to - AgentCore LTM with Strands](https://dev.to/aws-heroes/amazon-bedrock-agentcore-runtime-part-7-using-agentcore-long-term-memory-with-strands-agents-sdk-lb2)

---

## 備考

- ユーザー識別は匿名UUID方式（localStorage）を採用。ログイン機能は不要
- 将来的にデバイス跨ぎが必要になった場合はPhase 8でCognito認証を検討
- AgentCore Memoryのイベント保持期間（30日）は必要に応じて調整
