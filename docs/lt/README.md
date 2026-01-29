# ライトニングトーク用スライド

## 概要

AIエージェント構築に関する10分程度のライトニングトーク用スライドです。

**テーマ**: VRMアバター × Bedrock AgentCore で作るAIキャラクターエージェント

## スライド構成

1. イントロダクション（プロジェクト紹介）
2. アーキテクチャ全体像
3. **Part 1: バックエンド - Bedrock AgentCore**
   - AgentCoreの概要
   - Strands Agentsでのエージェント定義
   - Memory機能（STM/LTM）
   - デプロイ方法
4. **Part 2: フロントエンド - VRM + AITuber-kit**
   - AITuber-kitの紹介
   - VRM表情システム
   - ジェスチャーシステム
   - ストリーミング統合
   - 競合解決
   - システムプロンプトの工夫
5. ハマりポイント & Tips
6. まとめ

## プレビュー方法

### Marp CLI

```bash
# インストール
npm install -g @marp-team/marp-cli

# HTMLに変換
marp docs/lt/slides.md -o docs/lt/slides.html

# PDFに変換
marp docs/lt/slides.md -o docs/lt/slides.pdf

# プレビューサーバー起動
marp -s docs/lt/
```

### VS Code拡張機能

1. [Marp for VS Code](https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode) をインストール
2. `slides.md` を開く
3. プレビューパネルで確認

## カスタマイズ

### テーマカラー

```css
backgroundColor: #1a1a2e  /* 背景色 */
color: #eaeaea           /* テキスト色 */
h1, h2 { color: #e94560; }  /* 見出し色 */
```

### スライドの追加

Marpでは `---` で新しいスライドを区切ります。

```markdown
---

## 新しいスライド

内容をここに書く

---
```

## 発表時間の目安

- 全20スライド
- 1スライド約30秒 = 約10分
