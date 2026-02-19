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

### useMediaQueryのSSR対応

- **発見**: Phase4 PR#4 レビュー
- **内容**: `useMediaQuery`の初期値が`false`固定のため、SSR時とクライアント時で表示が一瞬ずれる可能性
- **影響**: 初回レンダリング時にレイアウトがチラつく可能性（ハイドレーションミスマッチ）
- **対応案**: `useState(false)`の初期値を動的に設定、またはSSR時は常にデスクトップレイアウトを表示

### 削除済みタブのAPIエンドポイント残存

- **発見**: Phase4 PR#4 レビュー
- **内容**: Youtube/スライド/画像設定タブを削除したが、関連APIエンドポイントは残存
- **関連ファイル**:
  - `src/pages/api/convertSlide.ts`
  - `src/pages/api/getSlideFolders.ts`
  - `src/pages/api/updateSlideData.ts`
  - `src/pages/api/upload-image.ts`
  - `src/pages/api/delete-image.ts`
  - `src/pages/api/get-image-list.ts`
- **対応案**: 将来使用しないなら削除検討

### バックエンドのユニットテスト追加

- **発見**: Phase5 PR#6 レビュー
- **内容**: `agentcore/tests/__init__.py`が空で、ユニットテストがない
- **対応案**: Strands Agentsのテスト方法に従いテストを追加

### agentcore.tsの変数宣言修正

- **発見**: Phase5 PR#6 レビュー
- **内容**: `src/pages/api/ai/agentcore.ts`の138行目・154行目で`let`を使用しているが再代入なし
- **対応案**: `const`に変更

### Web検索機能の有効化

- **発見**: Phase7 実装時
- **内容**: `strands-agents-tools`パッケージがAgentCoreランタイムで利用不可（`ModuleNotFoundError`）
- **現状**: 一時的に無効化し、システムプロンプトでLLMの知識に基づく提案を指示
- **対応案**: AgentCoreがstrands-agents-toolsをサポートした時点で再有効化

### CORS設定の制限

- **発見**: Phase8 PR#10 レビュー
- **内容**: API GatewayのCORS設定が`ALL_ORIGINS`で緩すぎる
- **ファイル**: `infra/lib/scensei-stack.ts:91`
- **対応案**: 本番環境では特定のオリジン（Vercelドメイン等）に制限

### COGNITO_REGIONのハードコード

- **発見**: Phase8 PR#10 レビュー
- **内容**: Lambda AuthorizerのCOGNITO_REGIONが`'ap-northeast-1'`でハードコード
- **ファイル**: `infra/lib/scensei-stack.ts:79`
- **対応案**: cdk.jsonのcontextから取得、または`this.region`を使用

### Gateway URLのハードコード

- **発見**: Phase8 PR#10 レビュー
- **内容**: エージェントのGateway URLがソースコードにハードコードされている
- **ファイル**: `agentcore/src/agent/scensei_agent.py:17`
- **対応案**: `config/agentcore.json`に移動して一元管理

---

## 対応済み

（まだ課題はありません）
