# Technology Stack

## Architecture

フロントエンド（Next.js on Vercel）とバックエンド（AWS Bedrock AgentCore）の分離アーキテクチャ。フロントエンドはAITuber-kitをベースにパーソナルAIアシスタント向けにカスタマイズ。

```
┌─────────────────────────────┐
│  Frontend (Vercel)          │
│  Next.js + VRM + Zustand    │
└──────────────┬──────────────┘
               │ REST API (Cognito M2M)
┌──────────────▼──────────────┐
│  AgentCore Runtime (AWS)    │
│  Strands Agent + MCP        │
├─────────────────────────────┤
│  Memory / Gateway / Identity│
└─────────────────────────────┘
```

## Core Technologies

### Frontend
- **Language**: TypeScript 5.0 (strict mode)
- **Framework**: Next.js 14 (Pages Router)
- **Runtime**: Node.js 22+ (Volta管理)

### Backend
- **Language**: Python 3.12
- **Framework**: Strands Agents (AWS Bedrock AgentCore)
- **LLM**: Claude Haiku 4.5 (Amazon Bedrock経由)

## Key Libraries

| Layer | Library | Purpose |
|-------|---------|---------|
| 状態管理 | Zustand | 軽量グローバルステート |
| 3D/VRM | Three.js + @pixiv/three-vrm | VRMアバター表示・制御 |
| スタイリング | Tailwind CSS | ユーティリティファーストCSS |
| バリデーション | Zod | スキーマ検証・型推論 |
| AI通信 | AgentCore SSE | ストリーミング応答（Server-Sent Events） |

## Development Standards

### Type Safety
- TypeScript strictモードを使用
- `any`の使用は最小限に
- API境界でZodによるバリデーション

### Code Quality
- ESLint + Prettier（自動フォーマット）
- `npm run build`でPrettier/ESLintエラーチェック必須
- コミット前に必ずビルド確認

### Testing
- Jest + Testing Library
- 単体テストは`src/__tests__/`配下

## Development Environment

### Required Tools
- Node.js 22+ (Volta管理: 22.22.0)
- Python 3.12+ (uv管理)
- AWS CLI (AgentCoreデプロイ用)

### Common Commands
```bash
# Dev server
npm run dev

# Build (commit前必須)
npm run build

# AgentCore deploy
cd agentcore && uv run agentcore deploy
```

## Key Technical Decisions

### VRM over Live2D
- Live2D関連コードは削除済み
- VRM専用UIに最適化
- テキストベースのリップシンクを実装

### AgentCore for AI Backend
- フロントエンドから直接Claude APIを呼ばない
- Strands AgentをAgentCore Runtimeにデプロイ
- Memory/Gateway/Identityを活用

### 機能削除方針
- Tonariに不要な機能は積極的に削除
- 削除済み: カラーテーマ切替、音声入出力、TTS関連、Vercel AI SDK直接呼び出し

---
_Document standards and patterns, not every dependency_
