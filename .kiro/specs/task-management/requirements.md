# Requirements Document

## Introduction

Tonariにタスク管理機能を追加する。オーナーがUI上でタスクの作成・編集・完了・削除を行えるほか、TONaRiとの会話を通じてタスクの操作やネクストアクション提案を受けられるようにする。期限が迫ったタスクに関してはアラート表示や朝のニュースブリーフィングへの統合を行い、会話中のタスク自動検出機能も提供する。

## Requirements

### Requirement 1: タスクリストUI表示

**Objective:** As a オーナー, I want 画面上にタスクリストを表示できるようにしたい, so that いつでもタスクの状況を確認できる

#### Acceptance Criteria

1. When オーナーがメニューバーのタスクアイコンをクリックした時, the タスクリストコンポーネント shall 画面上に表示される
2. The タスクリストコンポーネント shall ポモドーロタイマーと同様にドラッグで画面上を自由に移動できる
3. The タスクリストコンポーネント shall Apple風ガラスモーフィズムUIで表示される（半透明白背景 + backdrop-blur）
4. When オーナーがタスクアイコンを再度クリックした時, the タスクリストコンポーネント shall フェードアウトして非表示になる
5. The タスクリスト shall 各タスクを丸型チェックボックス付きのリスト形式で表示する

### Requirement 2: タスクCRUD操作

**Objective:** As a オーナー, I want タスクリストUI上から直接タスクの追加・編集・削除ができるようにしたい, so that 素早くタスクを管理できる

#### Acceptance Criteria

1. When オーナーがタスクリスト上の追加ボタンをクリックした時, the タスクリスト shall 新しいタスクの入力欄を表示する
2. When オーナーがタスク名を入力して確定した時, the システム shall DynamoDBにタスクを保存する
3. When オーナーが既存タスクのタスク名をクリックした時, the タスクリスト shall タスク名をインライン編集可能な状態にする
4. When オーナーがタスクの丸型チェックボックスをクリックした時, the システム shall タスクを完了状態に変更し、タスクリストから非表示にする
5. When タスクが完了状態に変更された時, the VRMモデル shall cheerジェスチャーを再生する
6. The システム shall 完了したタスクをDynamoDB上で完了フラグを立て、TTL属性により30日後に自動削除する

### Requirement 3: タスク期限設定

**Objective:** As a オーナー, I want 各タスクに任意で対応期限を設定したい, so that 締め切りを管理できる

#### Acceptance Criteria

1. When オーナーがタスクの期限エリアをクリックした時, the タスクリスト shall カレンダー型UIを表示して日付選択を可能にする
2. When オーナーがカレンダーから日付を選択した時, the システム shall 選択された日付をタスクの期限として保存する
3. Where タスクに期限が設定されている場合, the タスクリスト shall タスク名の近くに期限日を表示する
4. Where タスクの期限が過ぎている場合, the タスクリスト shall 期限表示を警告色で表示する

### Requirement 4: タスク並び替え

**Objective:** As a オーナー, I want タスクの表示順をドラッグ&ドロップで変更したい, so that 優先度に応じてタスクを整理できる

#### Acceptance Criteria

1. When オーナーがタスクをドラッグした時, the タスクリスト shall タスクの移動先をビジュアルフィードバックで示す
2. When オーナーがタスクをドロップした時, the システム shall タスクの表示順序を更新してDynamoDBに保存する
3. The タスクリスト shall ドラッグ中のタスクを視覚的に区別して表示する

### Requirement 5: 完了タスクの閲覧

**Objective:** As a オーナー, I want 完了したタスクも必要に応じて確認できるようにしたい, so that 過去の作業履歴を振り返れる

#### Acceptance Criteria

1. The タスクリスト shall リスト横に完了タスク表示用の矢印アイコンを配置する
2. When オーナーが矢印アイコンをクリックした時, the タスクリスト shall 完了済みタスクの一覧を表示する
3. While 完了タスク一覧が表示されている時, the タスクリスト shall 完了日時を各タスクに表示する
4. When オーナーが矢印アイコンを再度クリックした時, the タスクリスト shall 完了タスク一覧を非表示にする

### Requirement 6: 期限アラート

**Objective:** As a オーナー, I want 期限が迫っているタスクがある場合にアラートで知らせてほしい, so that 対応漏れを防げる

#### Acceptance Criteria

1. While 期限が3日以内に迫っているタスクが存在する場合, the メニューバーのタスクアイコン shall バッジ（数字または赤丸）を表示する
2. When 朝9時のニュース配信Lambda実行時に期限3日以内のタスクが存在する場合, the ニュースサマリー shall 期限の近いタスク一覧をニュース本文に含める
3. When オーナーがタスクアイコンのバッジを確認してタスクリストを開いた時, the タスクリスト shall 期限の近いタスクを視覚的に強調表示する

### Requirement 7: TONaRiとの会話によるタスク操作

**Objective:** As a オーナー, I want TONaRiとの会話を通じてタスクの参照・追加・完了ができるようにしたい, so that 会話の流れの中で自然にタスクを管理できる

#### Acceptance Criteria

1. The TONaRiエージェント shall MCPツール経由でタスクリストの取得・追加・更新・完了操作を実行できる
2. When オーナーが「タスクを追加して」等の依頼をした時, the TONaRi shall タスク管理ツールを使用してタスクを追加する
3. When オーナーが「近いタスクはある？」等の質問をした時, the TONaRi shall タスクリストを参照して期限の近いタスクを回答する
4. When オーナーが特定タスクについてネクストアクションの提案を依頼した時, the TONaRi shall タスク内容と会話の文脈を踏まえてアクションを提案する

### Requirement 8: 会話中のタスク自動検出

**Objective:** As a オーナー, I want 会話中にタスクっぽい発言をしたときにTONaRiが自動で提案してほしい, so that タスクの登録忘れを防げる

#### Acceptance Criteria

1. When オーナーの発言に期限や行動を示す表現（例：「明日までに〜しなきゃ」「来週〜する」）が含まれている時, the TONaRi shall 「タスクに追加しましょうか？」と提案する
2. When オーナーがタスク追加提案を承認した時, the TONaRi shall タスク管理ツールを使用してタスクを自動追加する
3. If オーナーがタスク追加提案を拒否した時, the TONaRi shall 追加せず会話を続行する

### Requirement 9: データ永続化

**Objective:** As a システム管理者, I want タスクデータを安全に永続化したい, so that データの整合性と適切なライフサイクル管理を確保できる

#### Acceptance Criteria

1. The システム shall タスクデータをDynamoDBテーブルに保存する（PK: taskId）
2. The システム shall 各タスクに以下の属性を保持する: タスクID、タスク名、期限（任意）、表示順序、完了フラグ、作成日時、完了日時、TTL
3. When タスクが完了した時, the システム shall TTL属性に完了日時+30日のUNIXタイムスタンプを設定する
4. The システム shall API Gateway + Lambda経由でタスクのCRUD APIを提供する（Cognito認証付き）
