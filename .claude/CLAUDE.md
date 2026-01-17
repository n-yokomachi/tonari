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
2. コミット前に `npm run build` でビルドチェック（Prettier/ESLintエラー確認）
3. コミット・プッシュ
4. `main`ブランチあてにPRを作成
5. PRを客観的にセルフレビュー
6. その場で解決すべき課題は同じブランチで修正
7. 後回しにする課題は`docs/backlog.md`に記載

**コミット前チェック（必須）:**

```bash
npm run build
```

ビルドが失敗した場合は `npx prettier --write <ファイルパス>` で修正してからコミットすること。

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
- **技術スタック**: Next.js, VRM (3Dモデル), Claude API, Tailwind CSS
- **アバター**: VRM形式の3Dモデル（Live2Dではなく3Dを採用）

## 開発方針

### 不要機能の削除

AITuber-kitはデフォルトで多くの機能を備えていますが、Scenseiに不要な機能は積極的に削除します。

**削除済み:**

- カラーテーマ切り替え機能（Scenseiテーマに固定）
- 音声入力機能（マイクボタン、音声認識設定タブ）
- 音声出力機能（TTS設定タブ）

**削除の判断基準:**

- Scenseiのコンセプト（香水ソムリエAI）に不要な機能
- ユーザー体験をシンプルにするために不要な設定項目
- メンテナンスコストに見合わない機能
