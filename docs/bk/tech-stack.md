# Scensei 技術スタック

## 概要

Scensei（センセイ）は、香水ソムリエAIキャラクターを実装したWebアプリケーションです。VRM形式の3Dアバターと対話し、香水の提案を受けることができます。

---

## フロントエンド

### フレームワーク

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| Next.js | 14.2.5 | SSR/SSGフレームワーク |
| React | 18.3.1 | UIライブラリ |
| TypeScript | 5.0.2 | 型安全な開発 |

### スタイリング

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| Tailwind CSS | 3.4.14 | ユーティリティファーストCSS |
| PostCSS | 8.4.47 | CSSトランスフォーメーション |
| SASS | 1.77.8 | SCSS処理 |
| Autoprefixer | 10.4.20 | ベンダープリフィックス自動追加 |

### 状態管理

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| Zustand | 4.5.4 | 軽量状態管理 |

**ストア構成:**
- `settings.ts` - アプリ設定（言語、AIモデル、VRMパス等）
- `home.ts` - ホーム画面の状態
- `menu.ts` - メニュー状態
- `toast.ts` - トースト通知
- `images.ts` - 画像管理
- `websocketStore.ts` - WebSocket接続状態

### 3Dグラフィックス / VRM

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| Three.js | 0.167.1 | WebGL 3Dライブラリ |
| @pixiv/three-vrm | 3.0.0 | VRMモデルローダー |

**VRM機能:**
- VRMモデル読み込み・表示
- SpringBone物理演算
- 表情制御（BlendShape）
- ジェスチャー制御（ボーン）
- 自動まばたき
- 自動視線制御
- リップシンク
- VRMアニメーション再生（VRMA形式）

### UIコンポーネント

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| Headless UI | 2.1.2 | アクセシブルなヘッドレスコンポーネント |
| Hero Icons | 2.1.5 | SVGアイコン |
| @hello-pangea/dnd | 18.0.1 | ドラッグアンドドロップ |

### 国際化

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| i18next | 23.6.0 | 多言語フレームワーク |
| react-i18next | 13.3.1 | React統合 |

**対応言語:** 日本語（ja）、英語（en）

### データベース・ストレージ

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| @aws-sdk/client-dynamodb | 3.978.0 | DynamoDBクライアント |
| @aws-sdk/util-dynamodb | 3.978.0 | DynamoDB型変換ユーティリティ |
| @supabase/supabase-js | 2.46.2 | Supabaseクライアント（チャットログ保存） |

### その他

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| Zod | 4.3.5 | スキーマ検証・型推論 |
| uuid | 10.0.0 | UUID生成 |
| cookie | 1.1.1 | Cookie処理 |
| @vercel/analytics | 1.3.1 | Vercelアナリティクス |
| web-streams-polyfill | 4.1.0 | Web Streams API互換性 |
| @gltf-transform/core | 2.4.6 | glTFファイル処理（devDependency） |

---

## バックエンド

### API Routes（Next.js）

**ディレクトリ:** `/src/pages/api/`

| エンドポイント | メソッド | 機能 |
|--------------|---------|------|
| `/api/ai/agentcore` | POST | AWS AgentCore統合（ストリーミング） |
| `/api/ai/custom` | POST | カスタムAPI統合 |
| `/api/admin/auth` | POST/DELETE | Admin認証（ログイン/ログアウト） |
| `/api/admin/webauthn/register-options` | POST | WebAuthn登録オプション生成 |
| `/api/admin/webauthn/register-verify` | POST | WebAuthn登録検証 |
| `/api/admin/webauthn/auth-options` | POST | WebAuthn認証オプション生成 |
| `/api/admin/webauthn/auth-verify` | POST | WebAuthn認証検証 |
| `/api/admin/perfumes` | GET/POST | 香水一覧取得/新規作成 |
| `/api/admin/perfumes/[id]` | GET/PUT/DELETE | 香水詳細/更新/削除（ID形式: brand#name） |
| `/api/messages` | GET/POST/PUT/DELETE | メッセージキュー（クライアント間通信） |
| `/api/upload-image` | POST | 画像アップロード |
| `/api/delete-image` | POST | 画像削除 |
| `/api/get-image-list` | GET | 画像一覧取得 |
| `/api/upload-background` | POST | 背景画像アップロード |
| `/api/get-background-list` | GET | 背景一覧取得 |
| `/api/save-chat-log` | POST | チャット履歴保存（Supabase/ローカル） |

### AIプロバイダ統合

| プロバイダ | SDK | モデル |
|----------|-----|--------|
| AWS Bedrock AgentCore | @aws-sdk/client-bedrock-agentcore | Claude Haiku 4.5 |

**備考:** AIチャットはAWS Bedrock AgentCoreを経由して処理される

### ファイル処理

| 技術 | 用途 |
|-----|------|
| formidable | マルチパートフォーム処理 |
| imageCompression.ts | キャンバスベース画像圧縮 |

---

## AWS インフラストラクチャ

### 構成

| サービス | リソース名 | 用途 |
|---------|----------|------|
| DynamoDB | scensei-perfumes | 香水データベース |
| Lambda | scensei-perfume-search | 香水検索（MCP） |
| Lambda | scensei-perfume-crud | CRUD API |
| Lambda | scensei-api-authorizer | M2M認証 |
| API Gateway | scensei-perfume-api | REST API |
| Cognito | tonari-m2m-identity | M2M認証 |
| Bedrock AgentCore | scensei-xajQ0R77kv | AIエージェントランタイム |
| AgentCore Memory | scensei_mem-INEd7K94yX | 会話メモリ |
| AgentCore Gateway | scenseigateway-zxdprxgrqx | MCPゲートウェイ |

### CDK

| 技術 | バージョン | 用途 |
|-----|-----------|------|
| AWS CDK | 2.x | インフラのコード化 |
| TypeScript | - | CDKスタック定義 |

**スタックファイル:** `/infra/lib/scensei-stack.ts`

### DynamoDB スキーマ

**テーブル:** `scensei-perfumes`

| 属性 | 型 | 説明 |
|-----|-----|------|
| brand (PK) | String | ブランド名 |
| name (SK) | String | 香水名 |
| topNotes | List | トップノート |
| middleNotes | List | ミドルノート |
| baseNotes | List | ベースノート |
| scenes | List | おすすめシーン |
| seasons | List | おすすめ季節 |
| rating | Number | 評価（1-5） |
| impression | String | 感想 |
| country | String | 生産国 |
| createdAt | String | 作成日時 |
| updatedAt | String | 更新日時 |

---

## AWS Bedrock AgentCore

### ランタイム

| 項目 | 値 |
|-----|-----|
| Agent ID | scensei-xajQ0R77kv |
| Runtime | Python 3.12 |
| Model | Claude Haiku 4.5 (jp.anthropic.claude-haiku-4-5-20251001-v1:0) |
| Memory | STM + LTM（Short-Term + Long-Term Memory） |
| Region | ap-northeast-1 |

### Python依存関係

| パッケージ | バージョン | 用途 |
|----------|-----------|------|
| bedrock-agentcore[strands-agents] | >=1.2.0 | AgentCoreランタイム |
| bedrock-agentcore-starter-toolkit | >=0.2.8 | スターターツールキット |
| strands-agents | >=1.23.0 | エージェントフレームワーク |
| strands-agents-tools | >=0.2.19 | ツール定義 |
| mcp | >=1.0.0 | MCPプロトコル |
| mcp-proxy-for-aws | >=1.1.6 | AWS IAM統合 |

**開発依存関係:**
- pytest>=9.0.2
- pytest-asyncio>=1.3.0

### Memory設計

| 項目 | 説明 |
|-----|------|
| Memory ID | scensei_mem-INEd7K94yX |
| session_id | セッション単位（タブ/ウィンドウごと） |
| actor_id | ユーザー単位（ブラウザで永続化） |
| Mode | STM_AND_LTM（Short-Term + Long-Term Memory） |

**LTM Retrieval設定:**

| Namespace | 用途 | top_k |
|-----------|------|-------|
| `/preferences/{actorId}` | ユーザーの香り好み | 5 |
| `/facts/{actorId}` | 購入履歴・試した香水 | 10 |
| `/summaries/{actorId}/{sessionId}` | セッションサマリー | 3 |

### MCP (Model Context Protocol)

**ゲートウェイURL:**
```
https://scenseigateway-zxdprxgrqx.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp
```

**ツール:**
- `search_perfumes` - 香水検索（DynamoDB）

---

## 認証システム

### 多層認証アーキテクチャ

| 層 | 方式 | 用途 | Cookie名 |
|---|------|------|---------|
| 1 | Basic認証 | 全ページアクセス制限 | basic_auth_token |
| 2 | Admin認証 | 管理画面アクセス | admin_token |
| 3 | WebAuthn | 生体認証（TouchID等） | - |
| 4 | Cognito M2M | サーバー間API認証 | - |

### WebAuthn

| パッケージ | 用途 |
|----------|------|
| @simplewebauthn/browser | クライアントサイド |
| @simplewebauthn/server | サーバーサイド |

**設定:**

| 項目 | 値 |
|-----|-----|
| RP Name | Scensei Admin |
| Attestation Type | none |
| Authenticator Attachment | platform |
| User Verification | required |
| Resident Key | preferred |

**対応:**
- TouchID（macOS）
- FaceID（iOS）
- Windows Hello
- セキュリティキー（FIDO2）

### Cognito M2M

| 項目 | 値 |
|-----|-----|
| Grant Type | Client Credentials |
| User Pool | ap-northeast-1_9YLOHAYn6 |
| Token Endpoint | https://tonari-m2m-identity.auth.ap-northeast-1.amazoncognito.com/oauth2/token |
| Scope | agentcore-m2m-03ce8ee4/read, write |

---

## 開発ツール

### コード品質

| ツール | バージョン | 用途 |
|-------|-----------|------|
| ESLint | 8.57.0 | コード品質チェック |
| Prettier | 3.3.3 | コードフォーマッター |
| prettier-plugin-tailwindcss | 0.6.11 | Tailwindクラス順序 |

### テスト

| ツール | バージョン | 用途 |
|-------|-----------|------|
| Jest | 29.7.0 | テストフレームワーク |
| @testing-library/react | 16.3.0 | Reactコンポーネントテスト |
| jest-environment-jsdom | 29.7.0 | DOMテスト環境 |

### その他

| ツール | 用途 |
|-------|------|
| UV | Pythonパッケージマネージャー |
| npm | Node.jsパッケージマネージャー |

---

## デプロイ

### Vercel（フロントエンド）

| 項目 | 値 |
|-----|-----|
| 本番ブランチ | main |
| フレームワーク | Next.js（自動検出） |
| ビルドコマンド | npm run build |

### AWS CDK（インフラ）

```bash
cd infra
npm run deploy
```

### AgentCore（バックエンド）

```bash
cd agentcore
uv run agentcore deploy
```

---

## 環境変数

### 必須

| 変数 | 説明 | デフォルト |
|-----|------|----------|
| COGNITO_CLIENT_SECRET | Cognito M2Mシークレット | - |
| PERFUME_API_URL | API Gateway URL | - |

### オプション（認証）

| 変数 | 説明 | デフォルト |
|-----|------|----------|
| BASIC_AUTH_USERNAME | Basic認証ユーザー名 | - |
| BASIC_AUTH_PASSWORD | Basic認証パスワード | - |
| ADMIN_PASSWORD | 管理画面パスワード | - |
| WEBAUTHN_RP_ID | WebAuthn RP ID | localhost |
| WEBAUTHN_ORIGIN | WebAuthn Origin | http://localhost:3000 |

### オプション（AI）

| 変数 | 説明 | デフォルト |
|-----|------|----------|
| ANTHROPIC_API_KEY | Anthropic APIキー | - |

### オプション（AWS）

| 変数 | 説明 | デフォルト |
|-----|------|----------|
| AWS_REGION | AWSリージョン | ap-northeast-1 |
| BEDROCK_MODEL_ID | BedrockモデルID | jp.anthropic.claude-haiku-4-5-20251001-v1:0 |
| AGENTCORE_MEMORY_ID | AgentCore Memory ID | scensei_mem-INEd7K94yX |
| AGENTCORE_GATEWAY_URL | MCPゲートウェイURL | https://scenseigateway-zxdprxgrqx... |

### オプション（Supabase）

| 変数 | 説明 | デフォルト |
|-----|------|----------|
| SUPABASE_URL | Supabase URL | - |
| SUPABASE_SERVICE_ROLE_KEY | Supabaseサービスロールキー | - |

---

## 設定ファイル

### config/app.json

アプリケーション設定（シークレット以外）

```json
{
  "general": {
    "language": "ja",
    "showAssistantText": true,
    "showCharacterName": true,
    "showControlPanel": true,
    "showQuickMenu": true,
    "chatLogWidth": 400
  },
  "character": {
    "name": "Scensei",
    "vrmPath": "/vrm/Scensei.vrm",
    "lightingIntensity": 1.0
  },
  "ai": {
    "service": "anthropic",
    "model": "claude-haiku-4-5",
    "temperature": 0.7,
    "maxTokens": 4096,
    "maxPastMessages": 10,
    "useSearchGrounding": false
  },
  "multiModal": {
    "enabled": true,
    "mode": "ai-decide",
    "imageDisplayPosition": "input"
  }
}
```

### config/agentcore.json

AgentCore Runtime設定

| 項目 | 値 |
|-----|-----|
| region | ap-northeast-1 |
| runtimeArn | arn:aws:bedrock-agentcore:ap-northeast-1:765653276628:runtime/scensei-xajQ0R77kv |
| cognito.tokenEndpoint | https://tonari-m2m-identity.auth.ap-northeast-1.amazoncognito.com/oauth2/token |
| cognito.clientId | 1qemnml5e11reu81d0jap2ele3 |
| cognito.scope | agentcore-m2m-03ce8ee4/read write |

---

## システムプロンプト機能

### 感情タグ

| タグ | 意味 |
|-----|------|
| [neutral] | 通常 |
| [happy] | 喜び |
| [angry] | 怒り |
| [sad] | 悲しみ |
| [relaxed] | 安らぎ |
| [surprised] | 驚き |

### ジェスチャータグ

| タグ | 動作 |
|-----|------|
| [bow] | お辞儀 |
| [present] | 紹介のポーズ |

### リンクタグ

```
[link:/admin/login]管理画面[/link]
```

### 特別指示モード

`<cmd>...</cmd>`タグで囲まれた指示を最優先で実行

例：
- `<cmd>悲しそうに</cmd>今日のおすすめは？` → [sad]で回答
- `<cmd>英語で答えて</cmd>香水について教えて` → 英語で回答

---

## ディレクトリ構成

```
scensei/
├── src/                      # フロントエンドソースコード
│   ├── pages/                # Next.jsページ
│   │   ├── api/              # APIルート
│   │   ├── admin/            # 管理画面
│   │   └── index.tsx         # メインページ
│   ├── components/           # Reactコンポーネント
│   ├── features/             # ビジネスロジック
│   │   ├── chat/             # チャット機能
│   │   ├── vrmViewer/        # VRMビューワー
│   │   ├── emoteController/  # 表情・ジェスチャー
│   │   ├── lipSync/          # リップシンク
│   │   ├── messages/         # メッセージ処理
│   │   ├── stores/           # Zustandストア
│   │   └── constants/        # 定数定義
│   ├── lib/                  # ユーティリティライブラリ
│   ├── hooks/                # カスタムフック
│   ├── utils/                # ユーティリティ関数
│   └── middleware.ts         # Next.jsミドルウェア
├── agentcore/                # AgentCoreバックエンド
│   ├── app.py                # エントリポイント
│   ├── src/agent/            # エージェント実装
│   └── pyproject.toml        # Python依存関係
├── infra/                    # AWS CDK
│   ├── lib/scensei-stack.ts  # CDKスタック
│   └── lambda/               # Lambda関数
├── config/                   # 設定ファイル
│   ├── app.json              # アプリ設定
│   ├── infra.json            # インフラ設定
│   └── agentcore.json        # AgentCore設定
├── docs/                     # ドキュメント
├── locales/                  # 国際化ファイル
└── public/                   # 静的アセット
    └── vrm/Scensei.vrm       # VRMモデル
```
