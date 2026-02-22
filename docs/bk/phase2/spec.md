# Phase 2: UIテーマ・ブランディング

## 目的

ScenseiのブランドアイデンティティをUIに反映し、香水ソムリエとしての世界観を構築する。

## 完了条件

- [x] カラーパレットがCSS変数として定義されている
- [x] アプリタイトルが「Scensei」に変更されている
- [x] ファビコンが設定されている
- [ ] 背景画像が調香室/香水イメージに変更されている（→ backlogに記載）
- [x] チャットUIの色が新しいテーマに合わせて調整されている

## 実装タスク

### 1. カラーパレット定義

`src/styles/`にScensei用のテーマCSSを追加。

```css
:root {
  --scensei-primary: #9d7e4a; /* ゴールド */
  --scensei-primary-light: #c9a96e;
  --scensei-secondary: #5c4b7d; /* パープル */
  --scensei-background: #1a1a1a; /* ダーク */
  --scensei-surface: #2d2d2d;
  --scensei-text: #f5f0e8; /* クリーム */
  --scensei-accent: #e8c4a0; /* ローズゴールド */
}
```

### 2. アプリタイトル変更

- `src/pages/_document.tsx`または`src/pages/_app.tsx`でタイトルを変更
- metaタグの更新（description等）

### 3. ファビコン設定

- `public/favicon.ico`を差し替え
- 香水瓶やScenseiロゴをイメージしたアイコン

### 4. 背景画像設定

- 調香室/香水ボトルイメージの背景画像を用意
- `public/backgrounds/`に配置
- `.env`の`NEXT_PUBLIC_BACKGROUND_IMAGE_PATH`で設定

### 5. チャットUI色調整

AITuber-kitの既存テーマシステムを確認し、Scensei用のカラー設定を適用。

## 技術的な詳細

### AITuber-kitのテーマシステム

- `.env`の`NEXT_PUBLIC_COLOR_THEME`で基本テーマ選択可能
- `src/styles/themes.css`に既存テーマ定義あり
- カスタムテーマ追加の可否を調査

### 背景画像の推奨仕様

- 解像度: 1920x1080以上
- 形式: PNG or JPG
- ファイルサイズ: 500KB以下推奨

## 備考

- ロゴ・ファビコンは仮のものでも可（後で差し替え可能）
- 背景画像は著作権フリーのものを使用すること
