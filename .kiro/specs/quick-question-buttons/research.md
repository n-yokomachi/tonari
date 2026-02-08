# Research & Design Decisions

## Summary
- **Feature**: `quick-question-buttons`
- **Discovery Scope**: Extension（既存コンポーネントの簡素化・固定化）
- **Key Findings**:
  - 既存の `PresetQuestionButtons` コンポーネントと設定画面エディタが完全に実装済み
  - 質問データは現在 Zustand + localStorage で永続化されており、コード固定化には store の `presetQuestions` フィールドと `partialize` の変更が必要
  - `@hello-pangea/dnd` ライブラリは設定画面のドラッグ＆ドロップ並び替え専用であり、設定エディタ削除後は依存を解除可能

## Research Log

### 既存プリセット質問のデータフロー
- **Context**: 質問データがどこで定義・管理されているかを特定する
- **Sources Consulted**: `src/features/stores/settings.ts`, `config/app.json`, `src/components/presetQuestionButtons.tsx`
- **Findings**:
  - `config/app.json` の `general.presetQuestions` が初期値（現在は空配列）
  - `getInitialValuesFromEnv()` で `PresetQuestion[]` 型に変換（id, text, order を付与）
  - Zustand の `persist` middleware により localStorage に保存
  - `partialize` で `presetQuestions` が永続化対象に含まれている
  - `PresetQuestionButtons` コンポーネントが store から `presetQuestions` と `showPresetQuestions` を読み取り表示
- **Implications**: コード固定化のためには、store から `presetQuestions` の永続化を除外し、定数ファイルから直接読み取る設計に変更する

### 設定画面の構成
- **Context**: 削除対象の設定エディタの影響範囲を特定する
- **Sources Consulted**: `src/components/settings/presetQuestions.tsx`, `src/components/settings/other.tsx`, `src/components/settings/index.tsx`
- **Findings**:
  - `PresetQuestions` コンポーネントは `other.tsx`（「その他」タブ）から import・レンダリングされている
  - ドラッグ＆ドロップに `@hello-pangea/dnd`、UUID生成に `uuid` を使用
  - 表示/非表示トグルは `handleToggleShowPresetQuestions` で `showPresetQuestions` を反転
  - 質問の追加・編集・削除・並び替えのすべてのCRUD操作が含まれる
- **Implications**: `presetQuestions.tsx` を削除し、`other.tsx` にトグルのみを残す。`@hello-pangea/dnd` が他で使用されていなければ依存削除の候補

### ボタンのスタイリング
- **Context**: 現在のボタンデザインとScenseiテーマの整合性を確認する
- **Sources Consulted**: `src/components/presetQuestionButtons.tsx`, `src/styles/globals.css`
- **Findings**:
  - 現在のボタンは `bg-white text-black rounded-2xl` でプレーンな白背景
  - Scenseiテーマカラー（ゴールド/ダーク系）との調和は未実装
  - `preset-questions-scroll` クラスでカスタムスクロールバーのスタイリングが適用済み
  - ホバー時は `hover:bg-gray-100` のみで、テーマに沿ったフィードバックではない
- **Implications**: ボタンスタイルをScenseiテーマに合わせて更新する。枠線やホバーカラーをテーマカラーに変更

## Design Decisions

### Decision: 質問データの管理方法
- **Context**: 質問を固定にし、どの端末からでも同一表示にする
- **Alternatives Considered**:
  1. `config/app.json` に質問を定義 — JSON設定ファイルで管理
  2. `src/features/constants/` に定数として定義 — TypeScript定数で管理
- **Selected Approach**: TypeScript定数として `src/features/constants/presetQuestions.ts` に定義
- **Rationale**: 型安全性が担保され、`config/app.json` のような実行時読み込みの不確実性がない。コードレビューで質問内容の変更を追跡できる
- **Trade-offs**: 質問変更時にコード変更+ビルドが必要（しかし要件上これが望ましい）
- **Follow-up**: store の `presetQuestions` フィールドと `partialize` から質問データの永続化を除外する

### Decision: 設定エディタの削除範囲
- **Context**: 既存の質問事前設定欄を削除し、トグルのみ残す
- **Alternatives Considered**:
  1. `presetQuestions.tsx` を削除し、`other.tsx` にトグルをインライン記述
  2. `presetQuestions.tsx` を簡素化してトグルのみに変更
- **Selected Approach**: `presetQuestions.tsx` を削除し、`other.tsx` にトグルをインライン記述
- **Rationale**: トグル1つのために別ファイルを維持する必要がない。コードの簡素化
- **Trade-offs**: なし（トグルはシンプルな1行のUI）

## Risks & Mitigations
- localStorage に保存された古い `presetQuestions` データとの整合性 — store の rehydrate 時に固定値で上書きする設計で対応
- `@hello-pangea/dnd` の依存残存 — 他に使用箇所がなければ `package.json` から削除を検討（実装タスクで確認）

## References
- Zustand persist middleware: https://docs.pmnd.rs/zustand/integrations/persisting-store-data
