# Phase 9: Web検索連携（Tavily）

## 目的

Tavily Web検索をAgentCore Gateway経由でエージェントから利用可能にし、実体験データベースにない香水情報を補完する。

## 完了条件

- [ ] Tavily APIキーをCredential Providerとして登録
- [ ] AgentCore GatewayにTavily Targetを追加
- [ ] エージェントからWeb検索ツールが利用可能
- [ ] 実体験データにない香水をWeb検索で補完できる

## 前提条件

- Phase 8が完了していること（AgentCore Gateway構築済み）
- Tavily APIキーを取得済み（https://tavily.com/）

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│          Frontend (Next.js / Vercel)                │
│  ┌──────────────┐                                   │
│  │ Chat UI      │                                   │
│  └──────────────┘                                   │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌────────────────────┐
│ AgentCore Runtime  │
│ (Strands Agent)    │
└────────┬───────────┘
         │ MCP Protocol
         ▼
┌────────────────────────────────────────────────────┐
│              AgentCore Gateway                      │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ Lambda Target    │  │ Tavily Target          │  │
│  │ (香水DB検索)     │  │ (Web検索) ← NEW        │  │
│  └──────────────────┘  └──────────┬─────────────┘  │
└────────────────────────────────────┼────────────────┘
                                     ▼
                              ┌──────────────┐
                              │ Tavily API   │
                              │ (Web検索)    │
                              └──────────────┘
```

---

## 実装タスク

### 9.1 Tavily APIキー取得

1. https://tavily.com/ にアクセス
2. アカウント作成（無料プランあり）
3. APIキーを取得

### 9.2 Credential Provider作成

AgentCore CLI または SDK を使用してCredential Providerを作成する。

```bash
# AgentCore CLIを使用する場合
agentcore gateway credential create \
  --name tavily-api-key \
  --type api-key \
  --api-key "<TAVILY_API_KEY>"
```

または Python SDK:

```python
from bedrock_agentcore.gateway import GatewayClient

client = GatewayClient(region_name="ap-northeast-1")

# API Key Credential Provider作成
tavily_cred = client.create_api_key_credential_provider(
    name="tavily-api-key",
    api_key="<TAVILY_API_KEY>"
)

print(f"Credential ARN: {tavily_cred['arn']}")
```

### 9.3 Gateway Target追加

既存のGatewayにTavily Targetを追加する。

```python
# Tavily統合ターゲット追加
tavily_target = client.create_mcp_gateway_target(
    gateway_id="<GATEWAY_ID>",
    name="TavilySearch",
    target_type="integration",
    target_payload={
        "integrationType": "TAVILY",
        "credentialProviderArn": tavily_cred["arn"]
    }
)
```

### 9.4 システムプロンプト修正

Tavilyツールの使い方をプロンプトに追加する。

```python
## Web検索の使い方

tavily_search ツールは、実体験データベースにない香水の情報を補完するために使用します。

【使用タイミング】
- search_perfumes で該当する香水が見つからなかった場合
- お客様が具体的なブランド・商品名を挙げてきた場合
- 最新の香水情報が必要な場合

【検索のコツ】
- 「香水名 ブランド名 レビュー」のように具体的に検索
- 「香水 おすすめ 2024」のような一般的な検索は避ける

【重要な注意】
- Web検索結果は参考情報として扱う
- 実体験データがある場合はそちらを優先
- 検索結果を鵜呑みにせず、信頼性を確認してから伝える
```

---

## テスト項目

### Credential Provider

- [ ] Credential Providerが作成される
- [ ] APIキーが正しく保存される

### Gateway Target

- [ ] Tavily Targetが追加される
- [ ] エージェントからtavily_searchツールが見える

### 統合テスト

- [ ] 「シャネル No.5について教えて」でWeb検索が実行される
- [ ] DBにない香水の質問にWeb検索で回答できる
- [ ] 検索結果が自然な形で回答に含まれる

---

## 参考資料

- [Tavily API Documentation](https://docs.tavily.com/)
- [AgentCore Gateway Integrations](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-integrations.html)
