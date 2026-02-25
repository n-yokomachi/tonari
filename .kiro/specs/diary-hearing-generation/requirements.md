# Requirements Document

## Introduction
Tonariエージェントにヒアリング形式の日記生成機能を追加する（Issue #43）。ユーザーが日記を書きたいと伝えると、エージェントがヒアリングモードに入り、今日の出来事や感情を数ターンにわたって聞き取る。ヒアリング完了後、会話内容をもとに日記として整理し、DynamoDBに保存する。日記のCRUD操作はLambda関数で実装し、AgentCore Gatewayターゲットとして登録することでTonariエージェントのツールとして利用可能にする。管理画面には日記閲覧ページを追加し、既存の香水管理画面と共にメニューからアクセス可能にする。この機能により、エージェントのLTM（Long Term Memory）にユーザーの行動や出来事がインプットされ、以後の会話品質向上にも寄与する。エージェントは既存のTonari Runtime内に日記ツールを追加する形で実装する（別Runtimeは作らない）。

## Requirements

### Requirement 1: 日記ヒアリング会話
**Objective:** As a ユーザー, I want エージェントが質問形式で今日の出来事や感情を聞き取ってくれること, so that 自分で文章を書かなくても対話を通じて日記の素材が集まる

#### Acceptance Criteria
1. When ユーザーが「日記を書きたい」等の日記生成意図を示すメッセージを送信した場合, the Tonari Agent shall ヒアリングモードに移行し、今日あった出来事についてオープンな質問を開始する
2. While ヒアリングモード中, the Tonari Agent shall ユーザーの回答に基づいて追加の深掘り質問（感情、詳細な状況、印象に残ったこと等）を行う
3. While ヒアリングモード中, the Tonari Agent shall 3〜5ターンの質問応答を通じて、日記に必要な情報（出来事、感情、印象、時系列）を収集する
4. When ユーザーが十分な情報を提供した場合、または「もういい」「これで終わり」等の終了意図を示した場合, the Tonari Agent shall ヒアリングを完了し、日記生成フェーズに移行する

### Requirement 2: 日記生成・保存
**Objective:** As a ユーザー, I want ヒアリング内容をもとに自然な日記が自動生成されDynamoDBに保存されること, so that 対話するだけで日記が蓄積される

#### Acceptance Criteria
1. When ヒアリングが完了した場合, the Tonari Agent shall 収集した会話内容をもとに日記形式のテキスト（タイトル・本文）を生成する
2. The Tonari Agent shall 生成した日記をユーザーに提示し、保存してよいか確認を行う
3. When ユーザーが日記の保存を承認した場合, the Tonari Agent shall save_diaryツールを使用して日記をDynamoDBに保存する
4. The 日記データ shall userId、date、title、body、createdAtフィールドを含む
5. If 日記の保存に失敗した場合, the Tonari Agent shall エラーメッセージをユーザーに伝え、再試行を提案する

### Requirement 3: 日記データ管理インフラ
**Objective:** As a 開発者, I want 日記のCRUD操作用Lambda関数とDynamoDBテーブルがCDKで管理されること, so that インフラがコードとして管理され再現性がある

#### Acceptance Criteria
1. The CDK Stack shall DynamoDB日記テーブル（パーティションキー: userId、ソートキー: date）を作成する
2. The CDK Stack shall 日記のCRUD操作（保存・取得・一覧・削除）を行うLambda関数をデプロイする
3. The Lambda関数 shall DynamoDBテーブルへの読み書き権限を持つIAMロールで実行される
4. The CDK Stack shall 日記Lambda関数をAgentCore Gatewayターゲットとして登録する
5. The Gatewayターゲット shall save_diary（保存）およびget_diaries（一覧取得）のツールスキーマを定義する

### Requirement 4: 管理画面メニュー・ルーティング
**Objective:** As a ユーザー, I want 管理画面にメニューページがあり日記管理と香水管理の両方にアクセスできること, so that 管理機能全体を簡単にナビゲーションできる

#### Acceptance Criteria
1. The 管理画面 shall /admin パスにメニューページを表示し、日記管理と香水管理への導線を提供する
2. When ユーザーが /admin にアクセスした場合, the 管理画面 shall 日記管理と香水管理のメニューカードを表示する
3. When ユーザーがメニューから日記管理を選択した場合, the 管理画面 shall /admin/diary ページに遷移する
4. When ユーザーがメニューから香水管理を選択した場合, the 管理画面 shall /admin/perfumes ページに遷移する（既存動作維持）

### Requirement 5: 日記閲覧ページ
**Objective:** As a ユーザー, I want 管理画面から日記の一覧と詳細を閲覧できること, so that 過去の日記を振り返ることができる

#### Acceptance Criteria
1. The 日記閲覧ページ shall /admin/diary パスに日記一覧を日付降順で表示する
2. The 日記閲覧ページ shall 各日記のタイトルと日付をリスト形式で表示する
3. When ユーザーが日記一覧から特定の日記を選択した場合, the 日記閲覧ページ shall 日記の詳細（タイトル、日付、本文）を表示する
4. The 日記閲覧ページ shall 既存の管理画面（/admin/perfumes）と一貫したUIスタイルで表示する

