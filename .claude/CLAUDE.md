# Scensei 開発ガイド

## 開発ワークフロー

このプロジェクトはSpec Driven Developmentで進めます。

### ブランチ運用

```
main ──→ feature/xxx ──→ PR ──→ main
 │                              │
 │  開発                        └─→ Vercel本番デプロイ
 └──────────────────────────────┘
```

**開発フロー:**
1. `main`から`feature/xxx`ブランチを切って実装
2. コミット・プッシュ
3. `main`ブランチあてにPRを作成
4. PRを客観的にセルフレビュー
5. その場で解決すべき課題は同じブランチで修正
6. 後回しにする課題は`docs/backlog.md`に記載

**本番デプロイ:**
- `main`ブランチにマージ → Vercelで自動デプロイ

## デプロイ

### Vercel設定

- **Production Branch**: `main`
- **Framework Preset**: Next.js
- **環境変数**: Vercel管理画面で設定
  - `ANTHROPIC_API_KEY`: Claude APIキー
  - `BASIC_AUTH_USERNAME`: ベーシック認証ユーザー名
  - `BASIC_AUTH_PASSWORD`: ベーシック認証パスワード

### ディレクトリ構成

```
docs/
├── plan.md           # 全体実装計画
├── backlog.md        # 後回しタスク
├── phase1/
│   └── spec.md       # Phase1仕様書
├── phase2/
│   └── spec.md
└── ...
```

### 仕様書(spec.md)の書き方

各Phaseの仕様書には以下を記載:
- 目的
- 完了条件（チェックリスト）
- 実装タスク
- 技術的な詳細（必要に応じて）

## プロジェクト概要

- **名前**: Scensei（Scent + Sensei）
- **コンセプト**: 香水ソムリエAIキャラクター
- **ベース**: AITuber-kit
- **技術スタック**: Next.js, Live2D, Claude API, Tailwind CSS
