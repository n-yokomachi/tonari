# Backlog

PRレビューで発見した、後回しにする課題を記載する。

---

## 未着手

### 依存パッケージの脆弱性対応

- **発見**: Phase1 PR#1 レビュー
- **内容**: npm auditで23件の脆弱性警告（1 low, 14 moderate, 7 high, 1 critical）
- **対応案**: `npm audit fix` または個別パッケージ更新

### Browserslistデータ更新

- **発見**: Phase1 PR#1 レビュー
- **内容**: caniuse-liteのデータが8ヶ月古い警告
- **対応案**: `npx update-browserslist-db@latest`

### 背景画像の設定

- **発見**: Phase2 UIテーマ・ブランディング
- **内容**: 調香室/香水イメージの背景画像が未設定（`public/backgrounds/`に画像なし）
- **対応案**: 著作権フリーの背景画像を用意し、`NEXT_PUBLIC_BACKGROUND_IMAGE_PATH`で設定

---

## 対応済み

（まだ課題はありません）
