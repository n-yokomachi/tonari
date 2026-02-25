# Implementation Plan

- [x] 1. CDKインフラストラクチャ構築
- [x] 1.1 DynamoDB日記テーブルとdiary-tool Lambdaリソースの追加
  - WorkloadConstructにDynamoDB日記テーブルを追加（PK: userId, SK: date, PAY_PER_REQUEST, DESTROY）
  - 同Constructにdiary-tool Lambda関数リソースを追加し、テーブルへの読み書き権限を付与
  - Lambda関数のTABLE_NAME環境変数にテーブル名を設定
  - diary Lambda ARNをConstruct外部にエクスポート
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 1.2 Gateway targetの登録とスタック接続
  - AgentCoreConstructPropsにdiaryLambdaArnを追加
  - diary-toolのCfnGatewayTargetを追加し、save_diaryとget_diariesのツールスキーマを定義
  - Gateway IAMロールにdiary Lambda invoke権限を追加
  - tonari-stack.tsでWorkloadConstructのdiary Lambda ARNをAgentCoreConstructに接続
  - _Requirements: 3.4, 3.5_

- [x] 2. (P) diary-tool Lambda handler実装
  - save_diary操作: user_id, date, title, bodyを受け取りDynamoDBにPutItem。createdAtを自動付与
  - get_diaries操作: user_idを受け取りDynamoDBをQuery（ScanIndexForward=false）。limitパラメータ対応（デフォルト10）
  - 操作の判別: eventにtitleフィールドがあればsave、なければget
  - エラー時は適切なエラーメッセージを返却
  - _Requirements: 2.3, 2.4, 2.5, 3.2_

- [x] 3. (P) システムプロンプトにヒアリングモード指示を追加
  - prompts.pyのSYSTEM_PROMPTに日記ヒアリングセクションを追加
  - トリガー検知: 「日記を書きたい」等の意図を検知してヒアリングモードに移行する指示
  - ヒアリング進行: 3〜5ターンの深掘り質問（出来事、感情、詳細状況、印象、時系列）
  - 終了判定: 十分な情報が集まった場合、またはユーザーが終了意図を示した場合
  - 日記生成: 会話内容をもとにタイトルと本文を生成し、ユーザーに提示して保存確認
  - save_diaryツール呼び出し: 承認後にツールを使用して保存、失敗時は再試行提案
  - 既存の感情タグ・ジェスチャーフォーマットとの整合性を維持
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.5_

- [x] 4. フロントエンド管理画面
- [x] 4.1 (P) 管理画面メニューページの作成
  - /adminパスにメニューページを作成
  - 日記管理カード（/admin/diaryへのリンク）と香水管理カード（/admin/perfumesへのリンク）を配置
  - 既存のTailwind CSSスタイルに準拠したカードUI
  - 認証はmiddlewareで保護済み
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.2 日記管理APIルートの作成
  - AWS SDK v3（@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb）を依存追加
  - /api/admin/diary: 日記一覧取得API（DynamoDB Query, ScanIndexForward=false）
  - /api/admin/diary/[date]: 日記詳細取得API（DynamoDB GetItem）
  - validateAdminTokenによる認証チェック
  - userIdはデフォルト値を使用（単一ユーザーアプリケーション）
  - DynamoDBテーブル名とAWSクレデンシャルは環境変数から取得
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4.3 日記閲覧ページの作成
  - /admin/diaryパスに日記閲覧ページを作成
  - 日記一覧を日付降順で表示（タイトルと日付のリスト）
  - 日記選択時に詳細表示（タイトル、日付、本文）
  - perfumes.tsxのUIパターンを踏襲（ローディング、エラー表示）
  - 「戻る」ボタンで/adminに遷移
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5. 結合確認とビルド検証
  - npm run buildでフロントエンドのビルドが成功することを確認
  - CDK synthでインフラ定義にエラーがないことを確認
  - 全要件（1〜5）のカバレッジを最終確認
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_
