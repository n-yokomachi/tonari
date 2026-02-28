# Requirements Document

## Introduction
個人のGoogleカレンダーとTonariエージェントを連携し、オーナーのスケジュール管理をサポートする機能。エージェントが自由にGoogleカレンダーにアクセスし、予定の確認・空き時間の照会・予定の登録/変更/削除を会話を通じて行えるようにする。また、空き時間を分析して最適なスケジュール枠を提案する機能を提供する。

## Requirements

### Requirement 1: 予定の取得・閲覧
**Objective:** オーナーとして、会話を通じてGoogleカレンダーの予定を確認したい。手動でカレンダーアプリを開かなくても、Tonariに聞くだけでスケジュールを把握できるようにするため。

#### Acceptance Criteria
1. When オーナーが特定の日付の予定を尋えた場合, the Tonari Agent shall 指定日のイベント一覧（タイトル、開始時刻、終了時刻、場所）を返す
2. When オーナーが日付範囲を指定して予定を尋ねた場合, the Tonari Agent shall 指定期間内のすべてのイベントを時系列順に返す
3. When オーナーが「今日の予定」「明日の予定」と尋ねた場合, the Tonari Agent shall 当日または翌日のイベント一覧を返す
4. If 指定期間にイベントが存在しない場合, the Tonari Agent shall 「予定はありません」と自然な言い回しで伝える

### Requirement 2: 空き時間の確認
**Objective:** オーナーとして、特定の日や時間帯が空いているかをTonariに確認したい。スケジュール調整や新しい予定の検討を効率的に行うため。

#### Acceptance Criteria
1. When オーナーが「この日は空いているか」と尋ねた場合, the Tonari Agent shall 指定日のイベント有無を確認し、空き状況を回答する
2. When オーナーが「この時間帯は空いているか」と尋ねた場合, the Tonari Agent shall 指定時間帯にイベントが重複していないかを確認し回答する
3. When オーナーが「ここからここまでの範囲で空いている日はあるか」と尋ねた場合, the Tonari Agent shall 指定期間内で終日イベントがない日をリストアップして回答する

### Requirement 3: 予定の作成
**Objective:** オーナーとして、会話の中で自然にGoogleカレンダーに予定を登録したい。カレンダーアプリを開かずに、Tonariとの対話だけで予定を追加できるようにするため。

#### Acceptance Criteria
1. When オーナーが予定の登録を指示した場合, the Tonari Agent shall タイトル、日時を指定してGoogleカレンダーにイベントを作成する
2. When オーナーが場所や説明を含めて予定を指示した場合, the Tonari Agent shall 場所・説明も含めてイベントを作成する
3. When イベント作成が成功した場合, the Tonari Agent shall 登録内容（タイトル、日時、場所）を確認メッセージとして伝える
4. If 指定した時間帯に既存の予定が存在する場合, the Tonari Agent shall 重複していることを警告し、それでも登録するかオーナーに確認する
5. When オーナーの発言にスケジュール登録の意図が含まれている場合, the Tonari Agent shall 「カレンダーに追加しましょうか？」と自然に提案する

### Requirement 4: 予定の変更・削除
**Objective:** オーナーとして、既存の予定のリスケジュールや取り消しを会話で行いたい。予定変更のたびにカレンダーアプリを操作する手間を省くため。

#### Acceptance Criteria
1. When オーナーが既存の予定の日時変更を指示した場合, the Tonari Agent shall 対象イベントを特定し、新しい日時に更新する
2. When オーナーが予定の削除を指示した場合, the Tonari Agent shall 対象イベントを特定し、削除前に確認を取ってから削除する
3. If 変更・削除対象のイベントが一意に特定できない場合, the Tonari Agent shall 候補を提示してオーナーに選択を求める

### Requirement 5: スケジュール提案
**Objective:** オーナーとして、「来週どこかで1時間ミーティングを入れたい」のようなリクエストに対して、Tonariが空き枠を分析して候補を提案してほしい。自分で空き時間を探す手間を省くため。

#### Acceptance Criteria
1. When オーナーが期間と所要時間を指定してスケジュール候補を求めた場合, the Tonari Agent shall 指定期間内の空き枠を分析し、複数の候補日時を提案する
2. When オーナーが提案された候補の中から1つを選択した場合, the Tonari Agent shall 選択された日時でイベントを作成する
3. While スケジュール候補を提案する際, the Tonari Agent shall 既存の予定との重複がない枠のみを候補とする

### Requirement 6: Google認証・認可
**Objective:** オーナーとして、Googleカレンダーへのアクセスを安全に認可したい。個人のスケジュールデータが適切に保護された状態で連携できるようにするため。

#### Acceptance Criteria
1. The Tonari System shall GoogleカレンダーAPIへのアクセスに必要な認証情報を安全に管理する
2. The Tonari System shall カレンダーデータへのアクセスに必要最小限のスコープのみを要求する
3. If 認証トークンの有効期限が切れた場合, the Tonari System shall リフレッシュトークンを使用して自動的に再認証する
4. If カレンダーAPIへのアクセスが失敗した場合, the Tonari Agent shall オーナーにエラーを自然な言い回しで伝え、技術的な詳細は表示しない
