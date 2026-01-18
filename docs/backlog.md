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

### TTS関連APIエンドポイントの削除

- **発見**: Phase3 PR#3 レビュー
- **内容**: 音声機能削除後も`/api/tts-*`エンドポイントが残存（11ファイル）
- **対応案**: 将来的に音声機能を追加する予定がなければ削除
- **関連ファイル**:
  - `src/pages/api/tts-voicevox.ts`
  - `src/pages/api/tts-google.ts`
  - `src/pages/api/tts-koeiromap.ts`
  - `src/pages/api/tts-nijivoice.ts`
  - `src/pages/api/tts-aivis-cloud-api.ts`
  - `src/pages/api/tts-aivisspeech.ts`
  - その他TTS関連

### 漢字のリップシンク改善

- **発見**: Phase3 PR#3 レビュー
- **内容**: 現在のリップシンクは漢字をスキップし、文字数分の母音をサイクルするフォールバック処理
- **影響**: 漢字が多いテキストでは口パクが不自然になる可能性
- **対応案**:
  - 漢字→ひらがな変換ライブラリ（kuromoji.jsなど）を導入
  - または音声合成APIから音素情報を取得（音声機能復活時）

---

## 対応済み

（まだ課題はありません）
