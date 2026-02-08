# Implementation Plan

- [x] 1. データレイヤーの変更
- [x] 1.1 (P) 固定プリセット質問の定数ファイルを作成する
  - `PresetQuestion` 型（`id` と `text` の readonly フィールド）を定義する
  - 香水ソムリエのコンセプトに沿った質問を配列で定義する（おすすめ・シーン別・探索的の各カテゴリを含む）
  - 配列の順序が表示順序となるため `order` フィールドは不要
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 1.2 (P) settingsStore から質問データの管理を削除する
  - `General` インターフェースから `presetQuestions` フィールドを削除する
  - `PresetQuestion` 型の export を削除する
  - `getInitialValuesFromEnv()` 内の `presetQuestions` 変換ロジックを削除する
  - `partialize` から `presetQuestions` を除外する
  - `showPresetQuestions` のデフォルト値を `true` に変更する
  - _Requirements: 1.3, 4.3_

- [x] 2. UIコンポーネントの更新
- [x] 2.1 PresetQuestionButtons を固定定数ベースに更新する
  - 質問データの参照元を settingsStore から定数ファイルの import に切り替える
  - `order` による sort ロジックを削除する（配列順序をそのまま使用）
  - AI応答処理中（`chatProcessingCount > 0`）にボタンを disabled にするロジックを追加する
  - ボタンのスタイリングをScenseiテーマに合わせて更新する（枠線ベース + テーマカラーアクセント、ホバー/タップ時のフィードバック、テキスト全文表示の維持）
  - デスクトップ・モバイル両レイアウトでの視認性と横スクロールの動作は既存実装を維持する
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3_

- [x] 2.2 (P) 設定画面の質問エディタを削除しトグルをインライン化する
  - `presetQuestions.tsx` ファイルを削除する
  - `other.tsx` から `PresetQuestions` コンポーネントの import とレンダリングを削除する
  - `other.tsx` にプリセット質問の表示/非表示トグルをインラインで追加する（セクションヘッダー + ON/OFF ボタン）
  - _Requirements: 4.1, 4.2_

- [x] 3. 設定ファイルの更新とビルド確認
  - `config/app.json` の `showPresetQuestions` を `true` に変更する
  - `config/app.json` の `presetQuestions` 配列を空のまま残す（互換性維持）
  - `npm run build` でビルドが通ることを確認する
  - _Requirements: 1.3_
