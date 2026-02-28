# Research & Design Decisions

## Summary
- **Feature**: task-management
- **Discovery Scope**: Extension（既存システムへの新機能追加）
- **Key Findings**:
  - PomodoroTimerコンポーネントのドラッグ可能なフローティングUI + ガラスモーフィズムパターンをタスクリストUIに再利用可能
  - diary-tool LambdaのMCPゲートウェイツールパターン（Gateway Target + inline tool schema）をタスク操作ツールに適用可能
  - news-trigger Lambdaのプロンプト構築 + DynamoDB書き込みパターンで期限アラートのニュース統合を実現可能

## Research Log

### フローティングUI パターン（PomodoroTimer）
- **Context**: タスクリストUIはポモドーロタイマーと同様にドラッグ可能なフローティングパネルで表示する必要がある
- **Sources Consulted**: `src/components/pomodoroTimer.tsx`, `src/components/pomodoroSettings.tsx`
- **Findings**:
  - PointerEvents（`pointerdown/move/up` + `setPointerCapture`）によるドラッグ実装
  - `localStorage` でパネル位置を永続化（キー: `tonari-pomodoro-layout`）
  - ガラスモーフィズム: `rgba(255,255,255,0.55)`, `backdrop-filter: blur(20px) saturate(1.4)`, `border: 1px solid rgba(255,255,255,0.5)`
  - `z-[25]` でフローティング、`z-[30]` で設定オーバーレイ
  - フェードイン/アウト: `opacity` CSS transition、`FADE_DURATION = 300ms`
  - リサイズハンドル: 右下SVGグリップ、ホバー時のみ表示
- **Implications**: タスクリストUIにこのパターンを拡張して適用する。ドラッグ・リサイズ・ガラスモーフィズムのスタイル定数は共通化を検討

### Zustand Store パターン
- **Context**: タスクデータのフロントエンド状態管理方式を決定する必要がある
- **Sources Consulted**: `src/features/stores/pomodoro.ts`, `src/features/stores/home.ts`
- **Findings**:
  - `create + persist` with `partialize` パターン: 永続化するフィールドを明示的に選択
  - トランジェント状態（タイマー残り時間等）は `partialize` から除外
  - アクションはストア内にインラインで定義
  - `store.getState().action()` でコンポーネント外からアクション呼び出し
  - `store.subscribe()` でリアクティブに副作用を実行
- **Implications**: タスクストアは API からの取得結果をキャッシュし、楽観的更新を行う。`partialize` でUI状態（パネル表示/非表示）のみローカル永続化

### MCP Gateway Tool パターン（diary-tool）
- **Context**: TONaRiとの会話でタスクCRUD操作を行うためのMCPツールを設計する必要がある
- **Sources Consulted**: `infra/lambda/diary-tool/index.py`, `infra/lib/agentcore-construct.ts`
- **Findings**:
  - Gateway Tool LambdaはプレーンJSONイベントを受信（HTTPイベントではない）
  - フィールドの存在で操作を判別: `if 'body' in event: save()` / `else: list()`
  - レスポンスは `{success: bool, message: str}` 等のプレーン辞書
  - CDKでの登録: `gateway.addLambdaTarget('TargetName', { toolSchema: agentcore.ToolSchema.fromInline([...]) })`
  - ツール命名: `${targetName}___${toolName}`（アンダースコア3つ）
  - AgentCoreConstruct propsにLambda参照を追加 → Gateway Roleに `lambda:InvokeFunction` 権限追加
- **Implications**: タスクツールは `list_tasks`, `add_task`, `complete_task`, `update_task` の4操作を1つのLambda Targetとして提供

### CRUD API パターン（diary-crud, news-crud）
- **Context**: タスクのCRUD APIを既存のAPI Gatewayに追加する必要がある
- **Sources Consulted**: `infra/lambda/diary-crud/index.py`, `infra/lambda/news-crud/index.py`, `infra/lib/workload-construct.ts`
- **Findings**:
  - HTTP method + path parameterでルーティング
  - `event.get("httpMethod")` と `event.get("requestContext", {}).get("http", {}).get("method")` の両方をサポート
  - 標準CORSヘッダーを全レスポンスに付与
  - `json.dumps(..., ensure_ascii=False)` で日本語コンテンツ対応
  - DynamoDB: `PK=userId, SK=date` パターン（diary）、`PK=userId` パターン（news）
  - CDK: `crudApi.root.addResource('tasks')` → `.addMethod('GET', integration, authorizedMethodOptions)`
- **Implications**: タスクCRUD LambdaはPK=`userId`, SK=`taskId` でCRUD操作を提供。API GatewayルートはCognitoオーソライザ付き

### ニュース統合パターン（news-trigger）
- **Context**: 期限が近いタスクを朝のニュースブリーフィングに統合する必要がある
- **Sources Consulted**: `infra/lambda/news-trigger/index.py`
- **Findings**:
  - プロンプト内に指示を組み込んでAgentCoreに送信
  - DynamoDBからニュースを保存（`put_item` で上書き）
  - SNS経由でメール通知
  - 環境変数でテーブル名やARNを注入
- **Implications**: news-triggerのプロンプトに「タスクテーブルから期限3日以内のタスクを取得してニュースに含める」指示を追加。news-trigger LambdaにタスクテーブルのRead権限を付与

### Next.js APIプロキシパターン
- **Context**: フロントエンドからバックエンドAPIへのプロキシを設定する必要がある
- **Sources Consulted**: `src/pages/api/admin/news.ts`, `src/pages/api/admin/diary/index.ts`
- **Findings**:
  - `validateAdminToken(req)` でAdmin認証チェック
  - `getCognitoToken()` でM2Mトークン取得
  - `fetch(${API_BASE_URL}/endpoint)` でバックエンドにプロキシ
  - `API_BASE_URL = process.env.PERFUME_API_URL`（共通環境変数）
- **Implications**: `/api/admin/tasks` にプロキシAPIを新規作成。同パターンで認証 + Cognitoトークン + プロキシ

### メニューバーボタン配置パターン
- **Context**: タスクアイコンをメニューバーに配置する必要がある
- **Sources Consulted**: `src/components/menu.tsx`, `src/components/mobileHeader.tsx`
- **Findings**:
  - `IconButton` コンポーネント使用: `iconName="24/Timer"`, `onClick={() => store.getState().toggle()}`
  - `showControlPanel`（settingsStore）でAdmin系ボタンの表示/非表示を制御
  - NewsNotificationは`showControlPanel`外に配置（常時表示）
  - モバイル/デスクトップの両方で同期的にボタンを更新する必要がある
- **Implications**: タスクアイコンは `showControlPanel` ブロック内に配置。menu.tsx と mobileHeader.tsx の両方に追加

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| フローティングパネル | PomodoroTimerと同様のドラッグ可能パネル | 既存パターン再利用、コード量最小 | パネルサイズが大きくなる可能性 | 要件1に合致 |
| サイドバー | 画面端に固定されたドロワー | 大量のタスク表示に適する | 既存レイアウトとの干渉 | 要件に「ドラッグ移動」指定のため不採用 |

## Design Decisions

### Decision: タスクデータの主キー設計
- **Context**: DynamoDBテーブルのキー設計を決定する必要がある
- **Alternatives Considered**:
  1. PK=`taskId`（UUIDv4）、ソートキーなし — 最もシンプル
  2. PK=`userId`, SK=`taskId` — マルチユーザー対応可能
  3. PK=`userId`, SK=`createdAt#taskId` — 作成日時でソート可能
- **Selected Approach**: PK=`taskId`（UUIDv4）、ソートキーなし
- **Rationale**: シングルユーザー前提のため `userId` をキーに含める必要がない。表示順序は `sortOrder` 属性で管理。全タスク取得は `scan` で十分（少量データ）
- **Trade-offs**: マルチユーザー化する場合はテーブル再設計が必要
- **Follow-up**: タスク数が増加した場合のページネーション検討

### Decision: ドラッグ&ドロップライブラリ
- **Context**: タスクの並び替えにドラッグ&ドロップを実装する必要がある
- **Alternatives Considered**:
  1. Native HTML5 DnD API — ライブラリ不要
  2. @dnd-kit/core — モダン、アクセシブル、軽量
  3. react-beautiful-dnd — 成熟しているがメンテナンス停止
- **Selected Approach**: Native PointerEvents によるカスタム実装
- **Rationale**: PomodoroTimerのドラッグ実装で既にPointerEventsパターンが確立されている。リスト内の並び替えもPointerEventsで実現可能。外部依存を追加しない方針に合致
- **Trade-offs**: アクセシビリティ対応は手動で実装が必要
- **Follow-up**: 複雑になりすぎる場合は @dnd-kit/core の導入を再検討

### Decision: 期限アラートのニュース統合方式
- **Context**: 期限が近いタスクを朝のニュース配信に含める方法を決定する必要がある
- **Alternatives Considered**:
  1. news-trigger Lambda内でDynamoDBを直接クエリ — シンプル
  2. 別のLambda関数でタスクアラートを生成しSNSに発行 — 関心の分離
- **Selected Approach**: news-trigger Lambda内でDynamoDBを直接クエリ
- **Rationale**: 既存のnews-triggerプロンプトに追記するだけで実現可能。別Lambda化するほど複雑な処理ではない
- **Trade-offs**: news-trigger Lambdaの責務が増える
- **Follow-up**: タスク関連の通知が増える場合は分離を検討

### Decision: タスク自動検出の実装方式
- **Context**: 会話中のタスクっぽい発言を自動検出する方法を決定する必要がある
- **Alternatives Considered**:
  1. フロントエンドでの正規表現マッチング — LLMに依存しない
  2. システムプロンプトでの指示 — LLMの自然言語理解を活用
- **Selected Approach**: システムプロンプトでの指示
- **Rationale**: TONaRiはAIエージェントであり、「期限や行動を示す表現」の判定はLLMの得意分野。正規表現では表現の多様性に対応しきれない
- **Trade-offs**: LLMの判断精度に依存（偽陽性の可能性あり）
- **Follow-up**: プロンプト調整で精度を改善

## Risks & Mitigations
- **DnDの操作性**: カスタムPointerEvents実装が複雑になるリスク → タスク数が少ない前提でシンプルに実装、問題があれば@dnd-kit導入
- **楽観的更新の整合性**: ネットワークエラー時にフロントとバックエンドのデータが不一致になるリスク → エラー時にリフェッチでリカバリ
- **ニュースプロンプト肥大化**: タスク情報をプロンプトに追加することで、ニュースの品質に影響するリスク → タスク情報はコンパクトなサマリーとして挿入

## References
- PomodoroTimer実装: `src/components/pomodoroTimer.tsx`
- DiaryTool Gateway Target: `infra/lib/agentcore-construct.ts` L232-284
- WorkloadConstruct DynamoDB/Lambda パターン: `infra/lib/workload-construct.ts`
- news-trigger Lambda: `infra/lambda/news-trigger/index.py`
