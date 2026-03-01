# Implementation Plan

## Requirements Coverage
- Requirement 1 (予定の取得・閲覧): 1.1, 1.2, 1.3, 1.4 → Tasks 2.1, 4.1
- Requirement 2 (空き時間の確認): 2.1, 2.2, 2.3 → Tasks 2.2, 4.1
- Requirement 3 (予定の作成): 3.1, 3.2, 3.3, 3.4, 3.5 → Tasks 2.3, 4.1
- Requirement 4 (予定の変更・削除): 4.1, 4.2, 4.3 → Tasks 2.4, 2.5, 4.1
- Requirement 5 (スケジュール提案): 5.1, 5.2, 5.3 → Tasks 2.6, 4.1
- Requirement 6 (Google認証・認可): 6.1, 6.2, 6.3, 6.4 → Tasks 1, 2.1, 4.1

## Tasks

- [x] 1. Google Cloud OAuth2認証のセットアップ
- [x] 1.1 Google Cloud Consoleでのプロジェクト作成とOAuth2クライアント設定
  - Google Cloud Consoleで新規プロジェクトを作成し、Google Calendar APIを有効化する
  - OAuth同意画面を設定し、OAuth2クライアントID（Desktop App）を作成する
  - ユーザーへの手順ガイド付き（手動作業が含まれるため）
  - _Requirements: 6.1, 6.2_

- [x] 1.2 OAuth2初回認可スクリプトの作成
  - ブラウザでGoogleアカウントの認可を行い、リフレッシュトークンを取得するPythonスクリプトを作成する
  - 取得したリフレッシュトークン・クライアントID・クライアントシークレットをAWS SSM Parameter Store（SecureString）に保存する
  - スコープは `https://www.googleapis.com/auth/calendar` を指定する
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. calendar-tool Lambda関数の実装
- [x] 2.1 認証基盤とイベント一覧取得ツールの実装
  - SSM Parameter StoreからOAuth2認証情報を取得し、Google Calendar APIクライアントを初期化する共通認証モジュールを実装する
  - 特定日・日付範囲・今日/明日の予定を取得する `list_events` ツールを実装する
  - タイトル・開始時刻・終了時刻・場所・イベントIDを含む一覧を返す
  - イベントが存在しない場合は「予定はありません」メッセージを返す
  - タイムゾーンはJST（Asia/Tokyo）を基準とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.3_

- [x] 2.2 (P) 空き時間確認ツールの実装
  - 特定日のイベント有無を確認する機能を実装する
  - 特定時間帯に既存イベントが重複していないかを確認する機能を実装する
  - 指定期間内で終日イベントがない空き日をリストアップする機能を実装する
  - Google Calendar Freebusy APIまたはevents.listの結果を分析して空き状況を判定する
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.3 (P) イベント作成ツールの実装
  - タイトルと日時を指定してGoogleカレンダーにイベントを作成する `create_event` ツールを実装する
  - 場所・説明をオプションパラメータとして受け付ける
  - 作成成功時は登録内容（タイトル・日時・場所・イベントID）を確認メッセージとして返す
  - 終日イベント（日付のみ指定）と時間指定イベントの両方に対応する
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2.4 (P) イベント変更ツールの実装
  - イベントIDを指定してタイトル・日時・場所・説明を部分更新する `update_event` ツールを実装する
  - 更新成功時は変更後の内容を返す
  - _Requirements: 4.1_

- [x] 2.5 (P) イベント削除ツールの実装
  - イベントIDを指定してイベントを削除する `delete_event` ツールを実装する
  - 削除成功時は確認メッセージを返す
  - イベントが見つからない場合はエラーメッセージを返す
  - _Requirements: 4.2_

- [x] 2.6 スケジュール提案ツールの実装
  - 指定期間・所要時間・希望時間帯に基づいて空き枠を分析し、最大5件の候補日時を提案する `suggest_schedule` ツールを実装する
  - 既存の予定と重複しない枠のみを候補とする
  - 希望時間帯のデフォルトは9:00〜18:00とする
  - 2.2の空き時間確認ロジックを活用する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2.7 ツールディスパッチとエラーハンドリングの実装
  - イベントフィールドに基づいて6つのツール関数に振り分けるディスパッチロジックを実装する
  - Google Calendar APIのエラー（認証失敗・レート制限・サーバーエラー等）をキャッチし、エージェントが理解しやすいメッセージに変換する
  - 入力パラメータのバリデーション（日付フォーマット・必須パラメータ）を実装する
  - _Requirements: 6.3, 6.4_

- [x] 3. CDKインフラの構築
- [x] 3.1 calendar-tool LambdaのCDK定義
  - WorkloadConstructにcalendar-tool Lambdaを追加する（PythonFunction、Python 3.12）
  - SSM Parameter Storeの `/tonari/google/*` パスへのアクセス権限を付与する
  - Lambda依存ライブラリ（google-api-python-client, google-auth）をpipインストールに設定する
  - _Requirements: 6.1_

- [x] 3.2 MCP Gateway Targetの登録
  - AgentCoreConstructにcalendar-toolのGateway Targetを追加する
  - 6つのツール（list_events, check_availability, create_event, update_event, delete_event, suggest_schedule）のスキーマを定義する
  - 各ツールのinputSchemaに適切なパラメータ名・型・説明を設定する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.1_

- [x] 4. エージェント統合
- [x] 4.1 (P) システムプロンプトへのカレンダーツール説明の追加
  - システムプロンプトに「Googleカレンダー連携」セクションを追加する
  - 6つのツールの名前・用途・使用タイミングを記述する
  - スケジュール登録意図の自動検知パターン（「〜に会議」「予定を入れて」等）と提案の仕方を記述する
  - 削除時の確認フロー、候補が複数ある場合の提示方法を記述する
  - APIエラー時に技術用語を使わず自然に伝えるガイドラインを記述する
  - 重複警告時の確認フローを記述する
  - _Requirements: 1.4, 3.3, 3.4, 3.5, 4.2, 4.3, 5.2, 6.4_

- [x] 5. 結合テストとデプロイ確認
- [x] 5.1 CDKデプロイと動作確認
  - CDKデプロイを実行し、Lambda・Gateway Targetが正常に作成されることを確認する
  - Lambdaを手動実行して各ツールの基本動作を検証する（list_events, create_event等）
  - エージェントとの会話を通じてカレンダー操作が正常に機能することを確認する
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.3_
