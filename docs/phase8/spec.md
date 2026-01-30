# Phase 8: 外部データ連携（実体験DB & Web検索）

## 目的

開発者の実体験に基づいた香水データをDynamoDBで管理し、AgentCore Gateway経由でエージェントから参照可能にする。また、Tavily Web検索で実在の香水情報を補完し、より正確で信頼性の高い香水提案を実現する。

## 完了条件

- [ ] CDKでDynamoDB + Lambdaがデプロイできる
- [ ] 香水管理ページから香水データのCRUD操作ができる
- [ ] AgentCore Gateway経由でエージェントが香水DBを検索できる
- [ ] Tavily Web検索でエージェントが実在の香水情報を取得できる
- [ ] 実体験データを優先した香水提案ができる

## 前提条件

- Phase 7が完了していること
- AWS CDK CLIがインストール済み
- Tavily APIキーを取得済み

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│          Frontend (Next.js / Vercel)                │
│  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ Chat UI      │  │ 香水管理ページ（管理者用） │   │
│  └──────────────┘  └─────────────┬─────────────┘   │
└────────┬─────────────────────────┼─────────────────┘
         │                         │ API Routes
         ▼                         ▼
┌────────────────────┐    ┌────────────────────────┐
│ AgentCore Runtime  │    │ Next.js API → DynamoDB │
│ (Strands Agent)    │    │ (管理用CRUD)           │
└────────┬───────────┘    └────────────────────────┘
         │ MCP Protocol
         ▼
┌────────────────────────────────────────────────────┐
│              AgentCore Gateway                      │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ Lambda Target    │  │ Tavily Target          │  │
│  │ (香水DB検索)     │  │ (Web検索)              │  │
│  └────────┬─────────┘  └────────────────────────┘  │
└───────────┼─────────────────────────────────────────┘
            ▼
     ┌──────────────┐        ← CDKで構築
     │  DynamoDB    │
     │ (香水データ)  │
     └──────────────┘
```

---

## 実装タスク

### 8.1 CDKプロジェクト構築

#### ディレクトリ構成

```
infra/
├── bin/
│   └── infra.ts
├── lib/
│   └── scensei-stack.ts
├── lambda/
│   └── perfume-search/
│       ├── index.py
│       └── requirements.txt
├── cdk.json
├── package.json
└── tsconfig.json
```

#### DynamoDBテーブル設計

**テーブル名**: `scensei-perfumes`

| 属性名 | 型 | 説明 |
|--------|------|------|
| PK | String | `PERFUME#<uuid>` |
| SK | String | `METADATA` |
| brand | String | ブランド名 |
| name | String | 商品名 |
| topNotes | List | トップノート |
| middleNotes | List | ミドルノート |
| baseNotes | List | ベースノート |
| scenes | List | おすすめシーン |
| seasons | List | おすすめ季節 |
| impression | String | 実体験コメント |
| rating | Number | 評価（1-5） |
| createdAt | String | 作成日時（ISO8601） |
| updatedAt | String | 更新日時（ISO8601） |

※ GSIは使用しない（コスト削減のため、Scanで検索）

#### CDKスタック実装

```typescript
// lib/scensei-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as python from '@aws-cdk/aws-lambda-python-alpha';

export class ScenseiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const perfumeTable = new dynamodb.Table(this, 'PerfumeTable', {
      tableName: 'scensei-perfumes',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for family search
    perfumeTable.addGlobalSecondaryIndex({
      indexName: 'FamilyIndex',
      partitionKey: { name: 'family', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'rating', type: dynamodb.AttributeType.NUMBER },
    });

    // Lambda for perfume search (AgentCore Gateway Target)
    const searchLambda = new python.PythonFunction(this, 'PerfumeSearchLambda', {
      functionName: 'scensei-perfume-search',
      entry: 'lambda/perfume-search',
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        TABLE_NAME: perfumeTable.tableName,
      },
    });

    perfumeTable.grantReadData(searchLambda);

    // Output Lambda ARN for Gateway configuration
    new cdk.CfnOutput(this, 'PerfumeSearchLambdaArn', {
      value: searchLambda.functionArn,
      description: 'Lambda ARN for AgentCore Gateway Target',
    });
  }
}
```

#### Lambda関数実装

```python
# lambda/perfume-search/index.py
import os
import boto3
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    """
    AgentCore Gateway から呼び出される香水検索Lambda

    Parameters:
    - query: 検索キーワード（オプション）
    - family: 香りファミリーで絞り込み（オプション）
    - season: 季節で絞り込み（オプション）
    - limit: 取得件数（デフォルト5）
    """
    query = event.get('query', '')
    family = event.get('family')
    season = event.get('season')
    limit = int(event.get('limit', 5))

    if family:
        # GSIで香りファミリー検索
        response = table.query(
            IndexName='FamilyIndex',
            KeyConditionExpression=Key('family').eq(family),
            ScanIndexForward=False,  # ratingの降順
            Limit=limit
        )
    else:
        # フルスキャン（小規模データ想定）
        response = table.scan(Limit=limit * 3)

    items = response.get('Items', [])

    # 季節フィルター
    if season:
        items = [i for i in items if season in i.get('seasons', [])]

    # キーワード検索（簡易）
    if query:
        items = [i for i in items if
                 query.lower() in i.get('name', '').lower() or
                 query.lower() in i.get('brand', '').lower() or
                 query.lower() in i.get('impression', '').lower()]

    # 上位N件を返却
    results = items[:limit]

    return {
        'perfumes': [
            {
                'brand': item.get('brand'),
                'name': item.get('name'),
                'family': item.get('family'),
                'topNotes': item.get('topNotes', []),
                'middleNotes': item.get('middleNotes', []),
                'baseNotes': item.get('baseNotes', []),
                'scenes': item.get('scenes', []),
                'seasons': item.get('seasons', []),
                'impression': item.get('impression'),
                'rating': item.get('rating'),
            }
            for item in results
        ],
        'count': len(results)
    }
```

#### デプロイ手順

```bash
cd infra
npm install
npx cdk bootstrap  # 初回のみ
npx cdk deploy
```

---

### 8.2 香水管理ページ（フロントエンド）

#### ページ構成

- `/admin/login` - ログインページ
- `/admin/perfumes` - 香水一覧・管理ページ

#### 認証方式

シンプルなパスワード認証をmiddlewareで実装。

**環境変数**:
```
ADMIN_PASSWORD=your-secret-password
```

**フロー**:
```
/admin/login → パスワード入力 → Cookie発行（admin_token）
/admin/* → middleware でCookie検証 → OK: 表示 / NG: /admin/login へリダイレクト
```

**middleware実装**:
```typescript
// middleware.ts
if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
  const adminToken = req.cookies.get('admin_token')
  if (!adminToken || adminToken.value !== expectedToken) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}
```

#### API Routes

```typescript
// pages/api/admin/auth.ts - ログイン認証
// pages/api/admin/perfumes/index.ts - 一覧取得 & 新規作成
// pages/api/admin/perfumes/[id].ts - 個別取得・更新・削除
```

#### UI機能

- ログインフォーム（パスワード入力）
- 香水一覧表示（テーブル形式）
- 新規追加フォーム
- 編集・削除機能
- 検索・フィルター

#### アクセス方法

1. **設定画面から**: 設定画面に「香水データ管理」ボタンを追加
2. **エージェント経由**: 「管理画面を開いて」等のリクエストでURLを案内

**システムプロンプトに追加**:
```
## 管理画面への案内

ユーザーから「管理画面」「香水の登録」「データ管理」などのリクエストがあった場合、
以下のURLを案内してください：

「香水データの管理画面はこちらです: /admin/perfumes
パスワードが必要ですので、管理者にお問い合わせください。」
```

---

### 8.3 AgentCore Gateway設定

#### Gateway作成

```python
from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient

client = GatewayClient(region_name="ap-northeast-1")

# OAuth認証設定
cognito = client.create_oauth_authorizer_with_cognito("ScenseiGateway")

# Gateway作成
gateway = client.create_mcp_gateway(
    name="ScenseiGateway",
    authorizer_config=cognito["authorizer_config"],
    enable_semantic_search=True
)
```

#### Lambda Target追加

```python
# CDKでデプロイしたLambdaをターゲットに追加
lambda_target = client.create_mcp_gateway_target(
    gateway=gateway,
    name="PerfumeSearch",
    target_type="lambda",
    target_payload={
        "lambdaArn": "<CDK Output: PerfumeSearchLambdaArn>",
        "toolSchema": {
            "name": "search_perfume_database",
            "description": "開発者の実体験に基づいた香水データベースを検索します。実際に試した香水の印象やおすすめ情報が含まれています。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "検索キーワード（ブランド名、香水名、印象など）"
                    },
                    "family": {
                        "type": "string",
                        "description": "香りのファミリー（フローラル、シトラス、ウッディ、オリエンタル等）"
                    },
                    "season": {
                        "type": "string",
                        "description": "季節（春、夏、秋、冬）"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "取得件数（デフォルト5）"
                    }
                }
            }
        }
    }
)
```

#### Tavily Target追加

```python
# Tavily API Key Credential Provider作成
tavily_cred = client.create_api_key_credential_provider(
    name="tavily-api-key",
    api_key="<TAVILY_API_KEY>"
)

# Tavily統合ターゲット追加
tavily_target = client.create_mcp_gateway_target(
    gateway=gateway,
    name="TavilySearch",
    target_type="integration",
    target_payload={
        "integrationType": "TAVILY",
        "credentialProviderArn": tavily_cred["arn"]
    }
)
```

---

### 8.4 エージェント連携

#### バックエンド修正

```python
# agentcore/src/agent/scensei_agent.py
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp.mcp_client import MCPClient
from mcp.client.streamable_http import streamablehttp_client

def create_gateway_transport(gateway_url: str, access_token: str):
    return streamablehttp_client(
        gateway_url,
        headers={"Authorization": f"Bearer {access_token}"}
    )

def create_scensei_agent(session_id: str, actor_id: str = "anonymous") -> Agent:
    # Gateway設定
    gateway_url = os.environ.get("AGENTCORE_GATEWAY_URL")
    access_token = get_gateway_access_token()  # Cognito認証

    # MCPクライアント経由でGatewayツールを取得
    mcp_client = MCPClient(
        lambda: create_gateway_transport(gateway_url, access_token)
    )

    agent = Agent(
        model=bedrock_model,
        system_prompt=SCENSEI_SYSTEM_PROMPT,
        session_manager=session_manager,
        tools=mcp_client.list_tools_sync(),  # Gateway経由のツール
    )
    return agent
```

#### システムプロンプト修正

```python
## 香水提案のルール（ツール活用）

香水を提案する際は、以下の優先順位でデータソースを活用してください：

1. **実体験データベース（最優先）**
   - `search_perfume_database` ツールで香水データベースを検索
   - 開発者が実際に試した香水の印象・評価を参照
   - 該当する香水があれば優先的に提案
   - 実体験コメントを必ず伝える

2. **Web検索（補完）**
   - 実体験データにない香水は `tavily_search` で情報を取得
   - 検索結果から正確な情報（ブランド名、商品名、特徴）を使用
   - 架空の香水を絶対に提案しない

3. **一般知識（最終手段）**
   - ツールが使えない場合のみ
   - 確実に知っている有名な香水のみ提案
```

---

## テスト項目

### CDK・インフラ

- [ ] `cdk deploy` が成功する
- [ ] DynamoDBテーブルが作成される
- [ ] Lambda関数がデプロイされる
- [ ] Lambda関数が単体で動作する

### 香水管理ページ

- [ ] 香水の一覧が表示される
- [ ] 新規香水を追加できる
- [ ] 既存香水を編集できる
- [ ] 香水を削除できる

### AgentCore Gateway

- [ ] Gatewayが作成される
- [ ] Lambda Targetが登録される
- [ ] Tavily Targetが登録される
- [ ] エージェントからツールが見える

### 統合テスト

- [ ] 「フローラル系のおすすめ香水」で実体験DBから提案される
- [ ] DBにない香水はWeb検索で補完される
- [ ] 実体験コメントが回答に含まれる

---

## 優先度

1. **高**: CDKプロジェクト構築（DynamoDB + Lambda）
2. **高**: 香水管理ページ（データ入力手段）
3. **中**: AgentCore Gateway設定
4. **中**: Tavily連携

---

## 参考資料

- [AgentCore Gateway Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html)
- [AgentCore Gateway + Lambda (DEV Community)](https://dev.to/aws-heroes/amazon-bedrock-agentcore-gateway-part-3-exposing-existing-aws-lambda-function-via-mcp-and-gateway-2ga)
- [AgentCore Starter Toolkit Quickstart](https://github.com/aws/bedrock-agentcore-starter-toolkit/blob/main/documentation/docs/user-guide/gateway/quickstart.md)
- [AWS CDK Python Lambda](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-lambda-python-alpha-readme.html)
