# Phase 7: 応答品質向上とジェスチャー連動

## 目的

LLMの応答品質を向上させ、VRMアバターのジェスチャーと連動した自然な対話体験を実現する。また、Web検索機能により実在の香水のみを提案するよう強制する。

## 完了条件

- [x] ストリーミングレスポンス完了後に表情がニュートラルに戻る
- [x] LLMの応答にMarkdown強調タグ（**）が含まれない
- [x] LLMの応答にモーションタグが含まれ、適切なタイミングでジェスチャーがトリガーされる
- [ ] ~~Web検索機能が動作し、実在の香水のみを提案する~~ → Phase 8へ延期（AgentCoreランタイム制限のため）

## 前提条件

- Phase 6が完了していること
- ジェスチャーシステム（bow, present）が実装済み

---

## 実装タスク

### 7.1 ストリーミング完了後の表情リセット

#### 課題

現在、LLM応答中に設定された表情（happy, surprisedなど）がストリーミング完了後も残り続ける。

#### 実装方針

ストリーミング完了を検知した時点で、一定時間後に表情をneutralに戻す。

#### 実装箇所

- `src/features/chat/handlers.ts` - ストリーミング完了時の処理追加

```typescript
// ストリーミング完了後に表情をリセット
const resetExpressionAfterDelay = (delayMs: number = 3000) => {
  setTimeout(() => {
    const viewer = homeStore.getState().viewer
    viewer?.model?.playEmotion('neutral')
  }, delayMs)
}
```

---

### 7.2 Markdown強調タグの抑制

#### 課題

LLMの応答に`**強調**`などのMarkdown記法が含まれ、チャットUIで不自然に表示される。

#### 実装方針

システムプロンプトで明示的に禁止する。

#### 実装箇所

- `agentcore/src/agent/prompts.py` - システムプロンプト修正

```python
# 出力フォーマットの指示に追加
"""
## 出力フォーマット
- Markdown記法（**強調**、*イタリック*、# 見出し等）は使用しないでください
- プレーンテキストで自然な文章を返してください
"""
```

---

### 7.3 モーションタグによるジェスチャー連動

#### 概要

LLMの応答に特定のタグを含めさせ、フロントエンドでパースしてジェスチャーをトリガーする。

#### タグ仕様

| タグ | ジェスチャー | 使用場面 |
|------|------------|---------|
| `[bow]` | お辞儀 | 挨拶、感謝、謝罪 |
| `[present]` | 紹介 | 香水の提案、説明時 |

#### システムプロンプト修正

```python
"""
## ジェスチャー指示
以下のタグを文章の適切な位置に挿入してください：
- [bow]: 挨拶時、感謝を伝える時、お詫びする時
- [present]: 香水を提案する時、商品を紹介する時

例：
「[bow]こんにちは！香水のご相談ですね。[present]こちらの香水はいかがでしょうか？」
"""
```

#### フロントエンド実装

- `src/features/chat/handlers.ts` - タグパース処理追加

```typescript
// モーションタグをパースしてジェスチャーをトリガー
const parseAndTriggerGestures = (text: string) => {
  const viewer = homeStore.getState().viewer

  if (text.includes('[bow]')) {
    viewer?.model?.playGesture('bow')
  } else if (text.includes('[present]')) {
    viewer?.model?.playGesture('present')
  }
}

// タグを除去してUIに表示
const removeGestureTags = (text: string): string => {
  return text.replace(/\[(bow|present)\]/g, '')
}
```

#### 表示タイミング

1. ストリーミング中にタグを検出
2. 検出時点でジェスチャーをトリガー
3. UIにはタグを除去したテキストを表示

---

### 7.4 Web検索機能の追加

#### 概要

実在の香水のみを提案するため、バックエンドエージェントにWeb検索ツールを追加する。

#### 実装方針

Strands AgentsのWebSearchツールを使用し、香水の存在確認と最新情報の取得を行う。

#### 依存パッケージ

```bash
cd backend
uv add strands-agents-tools
```

#### 実装箇所

- `agentcore/src/agent/scensei_agent.py` - ツール追加

```python
from strands_agents_tools import web_search

def create_scensei_agent(session_id: str, actor_id: str = "anonymous") -> Agent:
    # ...

    agent = Agent(
        model=bedrock_model,
        system_prompt=SCENSEI_SYSTEM_PROMPT,
        session_manager=session_manager,
        tools=[web_search],  # Web検索ツールを追加
    )
    return agent
```

#### システムプロンプト修正

```python
"""
## 香水提案のルール
1. 香水を提案する前に、必ずWeb検索で実在を確認してください
2. 架空の香水や存在しない商品を提案してはいけません
3. 検索結果から得た正確な情報（ブランド名、商品名、価格帯など）を使用してください
4. 検索で見つからない場合は「該当する香水が見つかりませんでした」と正直に伝えてください
"""
```

---

## テスト項目

### 表情リセット

- [ ] ストリーミング完了後、3秒程度で表情がneutralに戻る
- [ ] 新しいメッセージ送信時に表情が再度変化する

### Markdown抑制

- [ ] LLMの応答に`**`が含まれない
- [ ] プレーンテキストで自然な文章が返される

### ジェスチャー連動

- [ ] 挨拶時に[bow]タグが付与され、お辞儀ジェスチャーが再生される
- [ ] 香水提案時に[present]タグが付与され、紹介ジェスチャーが再生される
- [ ] UIにはタグが除去されたテキストが表示される
- [ ] ジェスチャー再生中に次のタグが来ても正常に処理される

### Web検索

- [ ] 香水提案時にWeb検索が実行される
- [ ] 実在の香水のみが提案される
- [ ] 検索結果の情報（ブランド、価格帯等）が回答に含まれる
- [ ] 見つからない場合は正直にその旨が伝えられる

---

## 技術的な詳細

### ストリーミング中のタグ検出

```typescript
// ストリーミング中に累積テキストからタグを検出
let accumulatedText = ''
let triggeredGestures = new Set<string>()

const onChunk = (chunk: string) => {
  accumulatedText += chunk

  // まだトリガーしていないタグを検出
  if (!triggeredGestures.has('bow') && accumulatedText.includes('[bow]')) {
    parseAndTriggerGestures('[bow]')
    triggeredGestures.add('bow')
  }
  if (!triggeredGestures.has('present') && accumulatedText.includes('[present]')) {
    parseAndTriggerGestures('[present]')
    triggeredGestures.add('present')
  }

  // UIにはタグを除去して表示
  displayText(removeGestureTags(accumulatedText))
}
```

### Web検索の呼び出し制御

エージェントが自律的に判断してWeb検索を呼び出すため、システムプロンプトで適切な指示を与える。過度な検索を避けるため、以下のルールを設定：

- 香水の提案時のみ検索を実行
- 一般的な質問には検索不要
- 検索結果は要約して回答に含める

---

## 優先度

1. **高**: モーションタグによるジェスチャー連動（コア機能）
2. **高**: Web検索機能（品質保証）
3. **中**: Markdown抑制（UX向上）
4. **中**: 表情リセット（自然さ向上）

---

## 備考

- ジェスチャーは現在bow/presentの2種類。将来的に追加可能な設計とする
- Web検索のレート制限に注意（必要に応じてキャッシュ検討）
- モーションタグの形式は将来的に拡張可能（表情タグなど）

---

## 既知の制限事項

### Web検索機能（7.4）について

`strands-agents-tools`パッケージはローカル開発環境では動作するが、AgentCoreランタイムでは利用不可（`ModuleNotFoundError`が発生）。

**現在のステータス**: 一時的に無効化
**回避策**: システムプロンプトでLLMの知識に基づく正確な香水提案を指示
**今後の対応**: AgentCoreがstrands-agents-toolsをサポートした時点で再有効化
