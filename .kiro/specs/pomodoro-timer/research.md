# Research & Design Decisions

## Summary
- **Feature**: `pomodoro-timer`
- **Discovery Scope**: Extension（既存システムへの機能追加）
- **Key Findings**:
  - Zustand + persist パターンが確立済み。ポモドーロ設定の永続化に同パターンを適用可能
  - 睡眠モード抑制は `useSleepMode.ts` 内のチェック条件にポモドーロ状態を追加する形で統合
  - アイドルモーション(`useIdleMotion.ts`)のパターンを拡張し、作業中モーションのランダム再生を実現

## Research Log

### Zustandストアパターンと永続化
- **Context**: ポモドーロ設定（作業時間、休憩時間、セッション数等）をlocalStorageに保存する必要がある
- **Sources Consulted**: `src/features/stores/home.ts`, `src/features/stores/settings.ts`
- **Findings**:
  - `home.ts`: `PersistedState` と `TransientState` を分離し、`partialize` で永続化対象を限定
  - `settings.ts`: 設定値のみを永続化、`onRehydrateStorage` で環境変数によるオーバーライド対応
  - localStorage キー命名: `aitube-kit-home`, `aitube-kit-settings`
- **Implications**: ポモドーロストアも同パターンで作成。設定値のみ永続化し、タイマー動作状態はtransient

### 睡眠モードの仕組みと抑制方法
- **Context**: 作業セッション中にアバターが睡眠に入らないようにする必要がある
- **Sources Consulted**: `src/hooks/useSleepMode.ts`
- **Findings**:
  - `scheduleCheck` 内で `isSleeping || chatProcessing` のとき睡眠チェックをスキップ
  - `homeStore.getState()` でフラグを直接参照
  - ユーザー操作イベント（mousedown, keydown, touchstart）で `wakeAndReschedule` を呼び出し
- **Implications**: ポモドーロ作業中フラグをhomeStoreまたはpomodoroStoreに追加し、`scheduleCheck`内で参照

### メニューとアイコンボタンシステム
- **Context**: ポモドーロタイマー起動ボタンをメニューに追加する
- **Sources Consulted**: `src/components/menu.tsx`, `src/components/mobileHeader.tsx`, `src/components/iconButton.tsx`
- **Findings**:
  - `iconButton.tsx`: `iconNameToPath` マッピングでアイコン名→SVGパスを管理
  - デスクトップ: `menu.tsx` の `showControlPanel` 内にボタン追加
  - モバイル: `mobileHeader.tsx` のナビゲーション内にボタン追加
  - 既存アイコン: `play.svg`, `pause.svg`, `stop.svg` 等がすでに存在
- **Implications**: `timer.svg` を新規作成、`iconButton.tsx` にマッピング追加

### UI オーバーレイとZ-Index構成
- **Context**: タイマーUIをVRMアバターの上にオーバーレイ表示する
- **Sources Consulted**: `src/pages/index.tsx`, `src/components/gestureTestPanel.tsx`, `src/components/newsNotification.tsx`, `src/components/ImageOverlay.tsx`
- **Findings**:
  - z-0: VRM Viewer
  - z-1: 画像オーバーレイ（背後）
  - z-10: チャットUI
  - z-20: モバイルヘッダー
  - z-30: テストパネル
  - z-40: モーダル（ニュース通知）
  - `gestureTestPanel.tsx`: `absolute top-2 right-2 z-30` パターン
- **Implications**: タイマーUIは `z-25` 程度で右上に配置。半透過で背後のアバターが見えるように

### アイドルモーションとジェスチャーシステム
- **Context**: 作業中モーションの仕組みを実装する
- **Sources Consulted**: `src/hooks/useIdleMotion.ts`, `src/features/emoteController/gestureController.ts`, `src/features/emoteController/gestures/types.ts`
- **Findings**:
  - `useIdleMotion.ts`: ランダム間隔で `playGesture()` を呼び出し
  - `GestureType`: bow, present, think, wave, cheer 等が定義済み
  - `GesturePlayOptions`: `holdDuration`, `speed` オプション
  - `playVrmaAnimation()`: VRMA形式のフルアニメーション再生（位置補正付き）
  - アイドルモーション: `chatProcessing` と `isSleeping` をチェックしてスキップ
- **Implications**: ポモドーロ作業中は `useIdleMotion` を抑制し、代わりに作業専用モーションセットからランダム再生

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 専用Zustandストア | ポモドーロ専用ストアを新規作成 | 関心の分離、既存パターン踏襲 | ストア間の依存が増える | homeStoreのisSleepingパターンに倣う |
| homeStore拡張 | homeStoreにポモドーロ状態を追加 | ストア間連携が不要 | homeStoreが肥大化 | 非推奨 |

## Design Decisions

### Decision: ポモドーロ専用Zustandストアの新規作成
- **Context**: タイマー状態、設定、セッション管理のための状態管理が必要
- **Alternatives Considered**:
  1. homeStoreに状態を追加 — 既存ストアの肥大化
  2. 専用ストアを新規作成 — 関心の分離
- **Selected Approach**: 専用ストア `pomodoroStore` を新規作成
- **Rationale**: 既存のストア分割パターン（home/settings/toast/menu）に倣い、ポモドーロ固有の状態とロジックを独立管理
- **Trade-offs**: ストア間の参照が必要（睡眠モード連携）だが、`getState()` で直接参照可能

### Decision: 睡眠モード抑制の実装方法
- **Context**: 作業中に睡眠モードに入らないようにする
- **Alternatives Considered**:
  1. pomodoroStoreを直接参照 — シンプルだがストア間依存
  2. homeStoreにフラグ追加 — 既存パターンに沿う
- **Selected Approach**: `useSleepMode.ts` 内で `pomodoroStore.getState()` を直接参照
- **Rationale**: homeStoreのisSleepingと同様のパターン。フラグの二重管理を避ける

### Decision: 作業中モーションの実装方法
- **Context**: 作業中に通常のアイドルモーションとは異なるモーションセットを再生
- **Alternatives Considered**:
  1. useIdleMotionを拡張 — 条件分岐が複雑化
  2. 専用フック `usePomodoroMotion` を新規作成 — 独立管理
- **Selected Approach**: 専用フック `usePomodoroMotion` を新規作成
- **Rationale**: useIdleMotionとは異なるモーションセット・間隔を使用するため、独立したフックの方が保守性が高い。ポモドーロ作業中はuseIdleMotionを抑制する

## Risks & Mitigations
- `setInterval` のドリフト — 1秒程度の誤差は許容。長時間の精度が必要なら `Date.now()` ベースの計算に切り替え
- 円形プログレスのパフォーマンス — SVG `stroke-dashoffset` アニメーションはCSS transitionで軽量に実現可能
- ブラウザタブ非アクティブ時のタイマー — `setInterval` はバックグラウンドで遅延する可能性。`visibilitychange` イベントで残り時間を補正

## References
- Zustand persist middleware: 既存実装 `src/features/stores/home.ts`, `settings.ts`
- SVG円形プログレス: `stroke-dasharray` + `stroke-dashoffset` パターン
