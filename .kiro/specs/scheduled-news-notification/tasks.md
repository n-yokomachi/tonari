# Implementation Plan

- [ ] 1. CDK インフラ基盤構築
- [ ] 1.1 設定ファイルとCDK構成の拡張
  - `config/infra.json` に `newsScheduler` セクション（通知先メールアドレス、VAPID subject）を追加する
  - `WorkloadConstructProps` に `newsScheduler` オプションを追加し、`tweetScheduler` と同様の構造で受け渡しを定義する
  - `infra/bin/infra.ts` で新しい設定値をスタックに渡すように更新する
  - _Requirements: 8.3, 8.4_

- [ ] 1.2 DynamoDB テーブルと SNS Topic の定義
  - `WorkloadConstruct` に Push サブスクリプション管理用の DynamoDB テーブルを追加する（PK=userId, SK=endpoint, PAY_PER_REQUEST）
  - SNS Topic を作成し、設定ファイルのメールアドレスで EmailSubscription を定義する
  - テーブルと Topic を Construct のプロパティとして公開する
  - _Requirements: 4.2, 8.1_

- [ ] 1.3 News Trigger Lambda と EventBridge Schedule の定義
  - News Trigger Lambda を Python 3.12 で定義し、必要な環境変数（`AGENTCORE_RUNTIME_ARN`, `SNS_TOPIC_ARN`, `PUSH_SUBSCRIPTIONS_TABLE`, `SSM_VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` 等）を設定する
  - Lambda に SSM 読み取り、SNS Publish、DynamoDB 読み取り/削除の IAM ポリシーを付与する
  - EventBridge Scheduler で 9:00 と 21:00（JST）の 2 つの cron スケジュールを作成する
  - `TonariStack` で AgentCore Runtime ARN の cross-construct wiring を追加する
  - _Requirements: 1.1, 1.4, 8.1, 8.2, 8.4_

- [ ] 2. News Trigger Lambda 実装
- [ ] 2.1 AgentCore Runtime 呼び出しの基本実装
  - `infra/lambda/news-trigger/index.py` を新規作成し、`tweet-trigger/index.py` をベースに Cognito M2M 認証 → AgentCore Runtime 呼び出しのチェーンを実装する
  - SSE ストリーム応答からテキスト全文を抽出するパーサーを実装する
  - session_id に日付と時刻を含めて冪等性を担保する（例: `tonari-news-pipeline-2026-02-26-09`）
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 2.2 ニュース収集専用プロンプトの構築
  - `_build_news_prompt` 関数を実装し、Web検索ツール（TavilySearch）を使用した総合ニュース収集を指示する
  - プロンプトに以下の指針を含める: 幅広いジャンル（政治・経済・テクノロジー・エンタメ等）の収集、LTM のオーナー情報に基づく 1〜2 件のピックアップ、通知フォーマット（タイトル・要約・ソースURL）での出力
  - LTM へのニュース要約保存を指示する（要約テキスト + 収集日時）
  - 感情タグ・ジェスチャータグは不要であることを明示する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 7.1, 7.2_

- [ ] 2.3 SNS メール通知送信
  - AgentCore のニュース要約取得後に、SNS Topic へメッセージを発行する処理を実装する
  - メッセージの Subject に日時を含め、Message にニュース要約全文を可読性の高いプレーンテキストで送信する
  - SNS Publish 失敗時にエラーログを記録し、後続の Web Push 送信は継続する
  - _Requirements: 4.1, 4.3, 4.4_

- [ ] 2.4 Web Push 通知送信と無効サブスクリプション削除
  - DynamoDB からサブスクリプション一覧を取得し、`pywebpush` を使用して各サブスクリプションに通知を送信する
  - SSM Parameter Store から VAPID 秘密鍵を取得し、VAPID 認証でプッシュ通知を送信する
  - Push ペイロードにタイトルとニュース要約のプレビュー（先頭 100 文字程度）を含める
  - Web Push サービスが 410 Gone を返した場合、該当サブスクリプションを DynamoDB から自動削除する
  - 個別の送信失敗がループ全体に影響しないようエラーハンドリングする
  - `pywebpush` と `requests` を Lambda の依存関係に追加する（`requirements.txt`）
  - _Requirements: 5.1, 5.2, 5.5, 6.5_

- [ ] 3. (P) Service Worker の実装
  - `public/sw.js` を新規作成し、`push` イベントハンドラでペイロード（JSON: title, body, url）をパースして通知を表示する
  - `notificationclick` イベントで Tonari のページを開くまたは既存タブにフォーカスする
  - `install` イベントで `skipWaiting()` を呼び、新バージョンを即座に有効化する
  - `_app.tsx` に Service Worker の登録処理を追加する（`navigator.serviceWorker.register('/sw.js')`）
  - `PushManager` の存在チェックを行い、非対応ブラウザではスキップする
  - _Requirements: 5.3, 5.4_

- [ ] 4. (P) Push Subscription API の実装
  - `src/pages/api/push-subscription.ts` を新規作成し、POST（サブスクリプション登録）と DELETE（サブスクリプション削除）を処理する
  - POST は `PushSubscriptionJSON`（endpoint, keys.p256dh, keys.auth）を受け取り、DynamoDB に保存する（userId は `tonari-owner` 固定）
  - DELETE は `endpoint` を受け取り、DynamoDB から該当レコードを削除する
  - リクエストボディのバリデーションを行い、不正な場合は 400 を返す
  - `@aws-sdk/client-dynamodb` と `@aws-sdk/lib-dynamodb` を使用して DynamoDB にアクセスする
  - _Requirements: 6.2, 6.3, 6.5_

- [ ] 5. Admin Push Settings UI の実装
- [ ] 5.1 Admin メニューへの通知設定カード追加
  - `/admin/index.tsx` の `menuItems` 配列に「通知設定」カードを追加し、`/admin/notifications` へのリンクを設定する
  - 既存の日記管理・香水管理カードと統一されたデザインにする
  - _Requirements: 6.1_

- [ ] 5.2 通知設定ページの実装
  - `/admin/notifications` ページを新規作成し、Web Push 通知の購読登録・解除を管理する UI を実装する
  - ページ読み込み時に `pushManager.getSubscription()` で現在の購読状態を確認し、「登録済み / 未登録 / 非対応」を表示する
  - 購読登録ボタン押下時にブラウザの通知許可を要求し、許可後に `pushManager.subscribe()` で VAPID 公開鍵を使ってサブスクリプションを取得し、API に保存する
  - 購読解除ボタン押下時に `subscription.unsubscribe()` を呼び、API からサブスクリプションを削除する
  - `PushManager` 非対応ブラウザでは機能を非表示にし、代わりにメッセージを表示する
  - 既存の Admin ページと統一されたヘッダー・レイアウトにする
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. 結合確認とビルド検証
  - フロントエンドのビルドが成功することを確認する（`npm run build`）
  - CDK のビルドとシンセサイズが成功することを確認する（`cd infra && npx cdk synth`）
  - 全コンポーネント間のデータフロー（EventBridge → Lambda → AgentCore → SNS/Push → Service Worker）が設計通りに接続されていることを最終確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4_
