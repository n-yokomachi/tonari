# Phase 1: 環境構築・起動確認

## 目的

AITuber-kitをベースに、Scenseiプロジェクトの開発環境を構築し、正常に起動することを確認する。

## 完了条件

- [x] AITuber-kitがクローンされ、scenseiディレクトリとして設定されている
- [x] `npm install`で依存パッケージがインストールされている
- [x] `.env`ファイルが作成され、必要な環境変数が設定されている
- [x] `npm run dev`で開発サーバーが起動する
- [x] ブラウザでデフォルト画面が表示される

## 実装タスク

### 1. AITuber-kitの取り込み

現在のワークスペース（`scensei/`）に、AITuber-kitの内容を取り込む。

```bash
# 一時ディレクトリにクローン
git clone https://github.com/tegnike/aituber-kit.git ../aituber-kit-temp

# 必要なファイルをコピー（docs/は既存のものを維持）
# .git以外のファイルをscenseiにコピー
```

**注意**: 既存の`docs/`ディレクトリや`.claude/`は上書きしないこと。

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example`を`.env`にコピーし、以下を設定:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

### 4. 開発サーバーの起動確認

```bash
npm run dev
```

- `http://localhost:3000`でアクセス可能か確認
- デフォルトのLive2Dキャラクターが表示されるか確認
- コンソールにエラーがないか確認

## 技術的な詳細

### AITuber-kit 基本情報

- リポジトリ: https://github.com/tegnike/aituber-kit
- ドキュメント: https://docs.aituberkit.com/
- フレームワーク: Next.js
- 対応LLM: OpenAI, Anthropic, Google, Groqなど

### 必要な環境

- Node.js 18以上
- npm または yarn

## 備考

- AITuber-kitのライセンス（個人・非商用は無償）を遵守すること
