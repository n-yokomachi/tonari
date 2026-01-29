# Phase 8: 外部データ連携（Web検索 & Google Sheets）

## 目的

実在の香水情報をWeb検索で取得し、さらに開発者の実体験に基づいた香水データをGoogle Sheetsから参照することで、より正確で信頼性の高い香水提案を実現する。

## 完了条件

- [ ] Web検索ツールが動作し、実在の香水情報を取得できる
- [ ] Google Sheetsから香水データを読み取れる
- [ ] 提案時に実体験データを優先的に参照する
- [ ] Web検索と実体験データを組み合わせた提案ができる

## 前提条件

- Phase 7が完了していること
- Tavily APIキーを取得済み
- Google Cloud Projectでサービスアカウントを作成済み

---

## 実装タスク

### 8.1 Web検索ツールの導入

#### 背景調査結果

Phase 7で`strands-agents-tools`の`web_search`を使用しようとしたが、AgentCoreランタイムでは依存パッケージがバンドルされておらず`ModuleNotFoundError`が発生。

#### 解決策: AgentCore Gateway + Tavily

AgentCore Gatewayを使用してTavily Web Search APIを統合する。

**Tavilyとは:**
- LLMエージェント向けに最適化されたWeb検索API
- セマンティックランキングされた検索結果を返す
- AWS Marketplaceで入手可能
- AgentCore Gatewayとネイティブ統合

#### セットアップ手順

**Step 1: Tavily APIキーの取得**
- [Tavily](https://tavily.com) でアカウント作成
- APIキーを取得

**Step 2: API Key Credential Providerの作成**
```bash
aws bedrock-agentcore-control create-api-key-credential-provider \
  --name tavily-api-key \
  --api-key "<TAVILY_API_KEY>" \
  --description "Tavily search API for Scensei"
```

**Step 3: AgentCore Gatewayの作成**
```bash
bedrock-agentcore-starter-toolkit gateway create-mcp-gateway \
  --name ScenseiGateway \
  --region ap-northeast-1 \
  --enable_semantic_search
```

**Step 4: Tavily統合ターゲットの追加**

AgentCore GatewayはIntegration targets（事前構成済みコネクタ）としてTavilyをサポート。

#### エージェントからの利用

```python
from strands import Agent
from strands.models import BedrockModel
# MCPプロトコル経由でGatewayのツールを使用

agent = Agent(
    model=bedrock_model,
    system_prompt=SCENSEI_SYSTEM_PROMPT,
    session_manager=session_manager,
    # Gateway経由でTavilyツールにアクセス
)
```

#### 代替案: AgentCore Browser

マネージドChromeブラウザを使用してWeb検索する方法もある。

```python
from strands_tools.browser import AgentCoreBrowser

browser_tool = AgentCoreBrowser(region="ap-northeast-1")
agent = Agent(tools=[browser_tool.browser])
```

**比較:**
| 方式 | メリット | デメリット |
|------|---------|-----------|
| Gateway + Tavily | 高速、構造化データ、低コスト | Tavily APIキー必要 |
| AgentCore Browser | フル機能、視覚的確認可能 | 重い、遅い、コスト高 |

**推奨:** Gateway + Tavilyを採用

#### 参考資料

- [AWS Bedrock AgentCore Gateway Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html)
- [Build dynamic web research agents with Strands Agents SDK and Tavily](https://aws.amazon.com/blogs/machine-learning/build-dynamic-web-research-agents-with-the-strands-agents-sdk-and-tavily/)
- [Get started with AgentCore Browser](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-onboarding.html)
- [Sample Strands Agent with AgentCore](https://github.com/aws-samples/sample-strands-agent-with-agentcore)
- [strands-agents/tools GitHub](https://github.com/strands-agents/tools)

---

### 8.2 Google Sheets連携

#### 概要

開発者の実体験に基づいた香水データをGoogle Sheetsで管理し、エージェントがMCPツール経由で参照できるようにする。

#### データ構造（想定）

| 列名 | 説明 | 例 |
|-----|------|-----|
| brand | ブランド名 | Chanel |
| name | 商品名 | No.5 |
| family | 香りのファミリー | フローラル |
| top_notes | トップノート | アルデヒド、ベルガモット |
| middle_notes | ミドルノート | ローズ、ジャスミン |
| base_notes | ベースノート | サンダルウッド、バニラ |
| scene | おすすめシーン | フォーマル、特別な日 |
| season | おすすめ季節 | 秋冬 |
| impression | 実体験コメント | 上品で華やかな印象 |
| rating | 評価（1-5） | 5 |

#### 実装方式

**方式A: AgentCore Gateway + Google Sheets MCP Server**

AgentCore GatewayはMCP Serversターゲットをサポート。Google Sheets用のMCPサーバーを構築またはOSSを利用。

```bash
# MCP Server ターゲットの追加
aws bedrock-agentcore-control create-gateway-target \
  --gateway-id <gateway-id> \
  --target-type MCP_SERVER \
  --mcp-server-config '{
    "url": "https://your-mcp-server.com",
    "protocol_version": "2025-06-18"
  }'
```

**方式B: カスタムLambdaツール**

Google Sheets APIを呼び出すLambda関数を作成し、AgentCore Gatewayのターゲットとして登録。

```python
# Lambda関数例
import gspread
from google.oauth2.service_account import Credentials

def lambda_handler(event, context):
    # サービスアカウント認証
    credentials = Credentials.from_service_account_info(...)
    gc = gspread.authorize(credentials)

    # スプレッドシートからデータ取得
    sheet = gc.open("Scensei香水データ").sheet1
    records = sheet.get_all_records()

    return {"perfumes": records}
```

#### 推奨アプローチ

1. まずカスタムLambdaツールで実装（シンプル）
2. 将来的にMCPサーバー化を検討

---

## システムプロンプト修正

Web検索とGoogle Sheets連携を活用する指示を追加。

```python
## 香水提案のルール（ツール活用）

香水を提案する際は、以下の優先順位でデータソースを活用してください：

1. **実体験データ（最優先）**
   - Google Sheetsの香水データベースを検索
   - 開発者の実体験に基づいた評価・コメントを参照
   - 該当する香水があれば優先的に提案

2. **Web検索（補完）**
   - 実体験データにない香水はWeb検索で情報を取得
   - 検索結果から正確な情報（ブランド名、商品名、特徴）を使用
   - 架空の香水を絶対に提案しない

3. **一般知識（最終手段）**
   - ツールが使えない場合のみ
   - 確実に知っている有名な香水のみ提案
```

---

## テスト項目

### Web検索

- [ ] 「シトラス系のおすすめ香水」で実在の香水が提案される
- [ ] 提案された香水名をWeb検索して実在が確認できる
- [ ] 検索エラー時は一般知識にフォールバックする

### Google Sheets連携

- [ ] スプレッドシートのデータが正しく読み取れる
- [ ] 実体験データがある香水は優先的に提案される
- [ ] 実体験コメントが回答に含まれる

### 統合テスト

- [ ] 「春におすすめの香水」で実体験データとWeb検索が組み合わさった提案
- [ ] ユーザーの好みに合わせた提案ができる

---

## 技術的な詳細

### AgentCore Gateway アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    Scensei Agent                        │
│                  (AgentCore Runtime)                    │
└─────────────────────┬───────────────────────────────────┘
                      │ MCP Protocol
                      ▼
┌─────────────────────────────────────────────────────────┐
│              AgentCore Gateway                          │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Tavily Target   │  │ Google Sheets Lambda Target │  │
│  │ (Integration)   │  │ (Lambda)                    │  │
│  └────────┬────────┘  └──────────────┬──────────────┘  │
└───────────┼──────────────────────────┼──────────────────┘
            │                          │
            ▼                          ▼
     ┌──────────────┐          ┌──────────────┐
     │  Tavily API  │          │ Google Sheets│
     └──────────────┘          │     API      │
                               └──────────────┘
```

### 認証・セキュリティ

- **Tavily**: API Key Credential Provider経由で管理
- **Google Sheets**: Secrets Manager経由でサービスアカウントキーを管理
- **Gateway**: OAuth2/Cognito認証

---

## 優先度

1. **高**: Web検索（Tavily）の導入 - 実在確認の基本機能
2. **中**: Google Sheets連携 - 差別化機能
3. **低**: MCP Server化 - 将来的な拡張

---

## 備考

- Tavily APIは検索ごとに約20クレジット消費
- Google Sheets APIは1日100,000リクエストまで無料
- AgentCore Gatewayの利用料金は要確認
