# Scensei - 実装方針書

## プロジェクト概要

| 項目           | 内容                                  |
| -------------- | ------------------------------------- |
| プロジェクト名 | **Scensei**（Scent + Sensei）         |
| コンセプト     | 香水ソムリエAIキャラクター            |
| ベース         | AITuber-kit                           |
| 優先順位       | **フロントエンド → エージェント機能** |

---

## 技術スタック

| 項目           | 技術                           |
| -------------- | ------------------------------ |
| フロントエンド | Next.js (AITuber-kit内蔵)      |
| アバター       | VRM (3Dモデル)                 |
| LLM            | Claude API (Anthropic)         |
| スタイリング   | Tailwind CSS (AITuber-kit内蔵) |
| 音声           | なし（テキストチャットのみ）   |

---

## フェーズ別実装計画

### Phase 1: 環境構築・起動確認

- [ ] AITuber-kit クローン → scensei にリネーム
- [ ] 依存パッケージインストール (`npm install`)
- [ ] 開発サーバー起動確認 (`npm run dev`)
- [ ] デフォルト状態で動作確認
- [ ] `.env` 作成（Claude APIキー設定）

```bash
git clone https://github.com/tegnike/aituber-kit.git scensei
cd scensei
npm install
cp .env.example .env
# .env に ANTHROPIC_API_KEY を設定
npm run dev
```

---

### Phase 2: UIテーマ・ブランディング

- [ ] カラーパレット定義（香水/調香室イメージ）
- [ ] アプリタイトル変更 → "Scensei"
- [ ] ロゴ・ファビコン作成
- [ ] 背景画像設定（調香室/香水ボトルイメージ）
- [ ] チャットUI色調整

#### カラーパレット

```css
:root {
  --primary: #9d7e4a; /* ゴールド */
  --primary-light: #c9a96e;
  --secondary: #5c4b7d; /* パープル */
  --background: #1a1a1a; /* ダーク */
  --surface: #2d2d2d;
  --text: #f5f0e8; /* クリーム */
  --accent: #e8c4a0; /* ローズゴールド */
}
```

---

### Phase 3: 3Dアバター設定（VRM）

- [ ] VRMモデル選定（無料モデル or 自作）
- [ ] モデルファイル配置 (`public/vrm/`)
- [ ] モデル読み込み設定
- [ ] 表情（BlendShape）パラメータ確認・調整
- [ ] アイドルアニメーション設定

#### VRMモデル配置先

```
public/
└── vrm/
    └── scensei.vrm
```

#### 無料VRMモデル入手先

- VRoid Hub: https://hub.vroid.com/
- Booth: https://booth.pm/ （VRM フリーで検索）
- VRoid Studio: https://vroid.com/studio （自作ツール）
- AITuber-kit デフォルトVRMモデルを流用

---

### Phase 4: 基本会話動作

- [ ] Claude API 接続確認
- [ ] 基本システムプロンプト作成（キャラ設定のみ）
- [ ] テキスト会話動作確認
- [ ] 表情変化の動作確認（感情タグ連動）

#### 基本システムプロンプト例

```typescript
const SCENSEI_SYSTEM_PROMPT = `
あなたは「Scensei（センセイ）」という名前の香水ソムリエAIです。

## キャラクター設定
- 性格: 穏やかで知的、香りに対する情熱がある
- 口調: 丁寧だが親しみやすい
- 得意: 香水の知識、香りの表現、相手の好みを引き出すヒアリング

## 回答ルール
- 香水や香りに関する質問には詳しく答える
- 相手の気分やシーンを聞いて、最適な香水を提案する
- 回答の最初に感情タグを付ける

## 感情タグ
[neutral] - 通常の会話
[happy] - 嬉しい時、良い提案ができた時
[thinking] - 考え中、ヒアリング中
[excited] - とっておきの香水を紹介する時
[sympathetic] - 共感する時
`
```

---

### Phase 5: UI/UX改善

- [ ] レスポンシブ対応確認
- [ ] ローディング表示
- [ ] エラーハンドリング
- [ ] 初回訪問時の説明（任意）

---

## 後続フェーズ（エージェント機能）※今回はスコープ外

### Phase 6: ツール実装

```typescript
// スプレッドシート検索ツール
interface SpreadsheetSearchTool {
  name: 'search_perfume_database'
  params: {
    mood?: string
    season?: string
    gender?: string
    priceRange?: string
  }
}

// Web検索ツール
interface WebSearchTool {
  name: 'search_perfume_web'
  params: { query: string }
}
```

### Phase 7: プロンプト設計

- ヒアリングフロー
- 推薦ロジック
- ツール使用ルール

### Phase 8: データベース構築

```
data/
└── perfume_database.csv
    ├── name（香水名）
    ├── brand（ブランド）
    ├── notes（トップ/ミドル/ラスト）
    ├── mood（合う気分）
    ├── season（季節）
    ├── price（価格帯）
    ├── personal_review（制作者レビュー）
    └── rating（評価）
```

---

## ディレクトリ構成

```
scensei/
├── .env                          # APIキー
├── .env.example
├── public/
│   ├── vrm/
│   │   └── scensei.vrm           # 3Dキャラモデル
│   ├── bg/
│   │   └── perfume_room.jpg      # 背景画像
│   ├── favicon.ico
│   └── logo.png
├── src/
│   ├── styles/
│   │   └── theme.css             # カスタムテーマ
│   ├── constants/
│   │   └── scensei.ts            # キャラ設定・プロンプト
│   └── ... (AITuber-kit既存)
├── docs/
│   └── IMPLEMENTATION.md         # 実装メモ
└── package.json
```

---

## マイルストーン

### MVP（Phase 1-4完了時点）

```
✅ Scenseiブランドで起動する状態
   - タイトルが "Scensei"
   - カラーテーマ適用済み
   - 背景画像設定済み
   - VRM 3Dキャラクターが表示される
   - テキストチャットでClaudeと会話できる
   - 感情タグに応じて表情が変わる
```

---

## 参考リンク

- AITuber-kit: https://github.com/tegnike/aituber-kit
- AITuber-kit Docs: https://docs.aituberkit.com/
- VRoid Hub: https://hub.vroid.com/
- VRoid Studio: https://vroid.com/studio
- three-vrm: https://github.com/pixiv/three-vrm
- Anthropic API: https://docs.anthropic.com/

---

## 注意事項

### ライセンス

- AITuber-kit: 個人・非商用は無償、商用は要ライセンス
- VRM: オープンフォーマット（ライセンスフリー）

### VRMモデル使用時

- 各モデルの利用規約を確認すること
- 商用利用可能かどうか要チェック
- VRMファイル内のメタ情報でライセンス確認可能
