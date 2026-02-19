---
marp: true
theme: default
paginate: true
style: |
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');

  :root {
    --main-color-1: #2a2a4d;
    --base-color-1: #3d3d6b;
    --main-color-2: #91855a;
    --main-color-2-light: #d6cabc;
    --accent-color: #991930;
  }

  section {
    font-family: 'Noto Sans JP', 'Arial Nova', sans-serif;
    background-color: #ffffff;
    color: var(--main-color-1);
    font-weight: 700;
  }

  h1 {
    color: var(--main-color-2);
    font-size: 2.2em;
    border-bottom: 3px solid var(--accent-color);
    padding-bottom: 10px;
    display: inline-block;
  }

  h2 {
    color: var(--main-color-1);
    font-size: 1.5em;
    border-left: 5px solid var(--accent-color);
    padding-left: 15px;
  }

  h3 {
    color: var(--main-color-2);
  }

  code {
    background-color: #f5f5f5;
    color: var(--main-color-1);
    padding: 2px 6px;
    border-radius: 4px;
  }

  pre {
    background-color: var(--main-color-1);
    color: #ffffff;
    border-radius: 8px;
  }

  pre code {
    background-color: transparent;
    color: #e0e0e0;
  }

  a {
    color: var(--accent-color);
  }

  table {
    font-size: 0.85em;
  }

  th {
    background-color: var(--main-color-1);
    color: #ffffff;
  }

  td {
    background-color: #f9f9f9;
  }

  blockquote {
    border-left: 4px solid var(--main-color-2);
    padding-left: 16px;
    color: var(--base-color-1);
  }

  /* タイトルスライド */
  section.title {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    text-align: right;
    padding-right: 80px;
    background: linear-gradient(135deg, var(--main-color-1) 0%, var(--main-color-1) 40%, transparent 40%),
                linear-gradient(45deg, transparent 60%, var(--main-color-2-light) 60%);
  }

  section.title h1 {
    border-bottom: 3px solid var(--accent-color);
    color: var(--main-color-2);
  }

  section.title p {
    color: var(--main-color-2);
  }

  /* セクション区切り */
  section.section {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: var(--main-color-1);
    color: #ffffff;
  }

  section.section h1 {
    color: #ffffff;
    border-bottom-color: var(--main-color-2-light);
    font-size: 2.5em;
  }

  section.section h2 {
    color: var(--main-color-2-light);
    border: none;
  }

  /* プロフィールスライド */
  section.profile {
    display: grid;
    grid-template-columns: 1fr 2fr;
    align-items: center;
  }

  section.profile .label {
    font-size: 3em;
    color: var(--main-color-1);
    font-weight: 700;
  }

  /* 強調テキスト */
  em {
    font-style: normal;
    color: var(--accent-color);
    font-weight: 700;
  }

  strong {
    color: var(--main-color-1);
  }

  /* 箇条書きマーカー */
  ul {
    list-style: none;
  }

  ul li::before {
    content: '▶';
    color: var(--main-color-2-light);
    margin-right: 10px;
  }

  ul li {
    color: var(--main-color-1);
  }
---

<!-- _class: title -->

# VRMアバター × AgentCore
# AIキャラクターエージェント

香水ソムリエAI「Scensei」の実装

2025/XX/XX
yokomachi Naoki

---

<!-- _class: profile -->

<div class="label">Profile</div>

<div>

**なまえ：yokomachi**

*すきなもの：睡眠*

AWS認定資格いろいろ

</div>

---

## 今日話すこと

**「記憶を持ち、感情豊かに対話するAIキャラクター」の作り方**

| バックエンド | フロントエンド |
|------------|--------------|
| Bedrock AgentCore | AITuber-kit + three-vrm |
| Memory（STM/LTM） | VRM Expression/Gesture |
| Strands Agents SDK | 独自の競合制御 |

---

## Scensei（センセイ）

香水ソムリエAIキャラクター

- 3Dアバターが*感情豊かに*香水を提案
- ユーザーの好みを*記憶*して次回に活かす
- お辞儀や紹介の*ジェスチャー*で接客

| 項目 | 技術 |
|------|------|
| バックエンド | Bedrock AgentCore + Strands Agents |
| フロントエンド | Next.js + three-vrm |
| アバター | VRoid Studioで自作 |

---

## アーキテクチャ

```
┌───────────────────────────────────────────────────┐
│      Frontend (Next.js + AITuber-kit)             │
│  Chat UI → Tag Parser → Expression/Gesture → VRM  │
└──────────────────────┬────────────────────────────┘
                       │ Streaming API
┌──────────────────────▼────────────────────────────┐
│            AgentCore Runtime (microVM)            │
│  ┌─────────────┐  ┌────────┐  ┌───────────────┐  │
│  │Strands Agent│←→│ Memory │←→│ Claude Haiku  │  │
│  └─────────────┘  │STM/LTM │  └───────────────┘  │
│                   └────────┘                      │
└───────────────────────────────────────────────────┘
```

---

<!-- _class: section -->

# Backend
## Bedrock AgentCore

---

## AgentCoreとは

AWSが提供する*エージェント構築プラットフォーム*

| サービス | 役割 |
|---------|------|
| **Runtime** | サーバーレス実行（microVM分離） |
| **Memory** | 短期/長期記憶 |
| **Gateway** | Lambda/APIをMCPツール化 |
| **Identity** | OAuth/Cognito認証 |
| **Browser** | マネージドChrome |
| **Code Interpreter** | Python/JS実行 |

---

## Strands Agents SDK

```python
from strands import Agent
from strands.models import BedrockModel

agent = Agent(
    model=BedrockModel(
        model_id="jp.anthropic.claude-haiku-4-5-20251001-v1:0",
        streaming=True,
    ),
    system_prompt=SYSTEM_PROMPT,
    session_manager=session_manager,  # ← Memory連携
)
```

*1コマンドでAgentCore Runtimeにデプロイ*

---

## Memory: STM（短期記憶）

セッション内の会話を即時保持

```
User: 「柑橘系が好きです」
Agent: 「では爽やかな香りを...」
User: 「さっき言った好みに合うものは？」  ← 覚えている
```

- `session_id`でセッション識別
- CreateEvent APIで即時書き込み

---

## Memory: LTM（長期記憶）

セッションを跨いでユーザー情報を*自動抽出*

| 抽出戦略 | 活用例 |
|---------|-------|
| **Summarization** | 会話要約 |
| **Semantic Memory** | 知識のベクトル化 |
| **User Preferences** | 好みの香り系統 |
| **Episodic Memory** | 過去の提案パターン |

*「前回フローラル系を提案した」を次回活用*

---

<!-- _class: section -->

# Frontend
## VRM + AITuber-kit

---

## AITuber-kit（ベース）

*誰でも簡単にAIキャラと対話できるOSSツールキット*

| 機能 | 詳細 |
|-----|------|
| VRM/Live2D表示 | 3Dキャラクターのレンダリング |
| リップシンク | 音声解析で口の動きを同期 |
| 表情制御 | 感情タグ → VRM Expression |
| LLM連携 | OpenAI, Anthropic, Gemini等 |

---

## Scenseiで新規実装

| 機能 | 詳細 |
|-----|------|
| *ジェスチャーシステム* | お辞儀・紹介ポーズ（Bone操作） |
| *AgentCore連携* | Memory (STM/LTM) でユーザー記憶 |
| *競合制御* | 表情/ジェスチャー/瞬きの状態管理 |
| *プロンプト設計* | タグ出力とMarkdown禁止 |

---

## 感情タグ → 表情

LLMが感情タグを出力 → VRM Expressionに変換

```typescript
// LLM出力: [happy]いらっしゃいませ！
const match = text.match(/^\[(neutral|happy|sad|...)\]/)
if (match) {
  vrm.expressionManager.setValue(match[1], 1.0)
}
```

Expression = *BlendShape*（顔メッシュの頂点変形）

---

## ジェスチャーシステム（新規実装）

VRMの*Humanoid Bone*をQuaternionで回転

```typescript
const bone = vrm.humanoid.getNormalizedBoneNode('spine')
bone.quaternion.slerp(targetRotation, blendWeight)
```

| ジェスチャー | ボーン操作 |
|------------|----------|
| お辞儀 | spine → chest → neck を前傾 |
| 紹介 | 腕を広げる + 手首回転 |

---

## 競合制御（新規実装）

**問題:** happy + bow（目閉じ）= *笑顔で目閉じ*

```typescript
// EmoteController
const isEmotionActive = expressionController.isEmotionActive

// 感情中 → ジェスチャーの目閉じスキップ
gestureController.update(delta, isEmotionActive)
```

*各システムの状態を相互参照して自然な動きを実現*

---

## システムプロンプトの工夫

LLMにタグ出力ルールを厳格に指示

```
## 感情表現【必須】
[{neutral|happy|angry|sad|relaxed|surprised}]{会話文}

## ジェスチャー
- [bow]: 挨拶、感謝時
- [present]: 商品提案時

## 【禁止】Markdown記法
```

*Markdownが混入すると読み上げ時に不自然*

---

## まとめ

### Bedrock AgentCore
- *Memory*: STM + LTM でユーザーを記憶
- *Runtime*: microVM分離、サーバーレス

### Scenseiで新規実装
- *ジェスチャー*: Humanoid Boneでお辞儀・紹介
- *競合制御*: 表情/ジェスチャー/瞬きの状態管理

**AITuber-kit + AgentCore = 感情豊かなAIキャラ**

---

## 参考リンク

**AWS**
- aws.amazon.com/bedrock/agentcore/
- strandsagents.com

**OSS / ツール**
- github.com/tegnike/aituber-kit
- github.com/pixiv/three-vrm
- vroid.com/studio

---

<!-- _class: section -->

# ご清聴ありがとうございました

