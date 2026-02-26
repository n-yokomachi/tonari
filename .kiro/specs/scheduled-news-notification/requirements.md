# Requirements Document

## Introduction

Tonariエージェントが朝晩の定時にWeb検索でニュースを収集・要約し、SNSメール通知とWeb Push通知の2経路でオーナーに届ける機能。既存のTwitter自動投稿（EventBridge → Lambda → AgentCore Runtime）と同様のアーキテクチャパターンを踏襲する。ニュース収集専用のシステムプロンプトを用意し、エージェントの初期化を分離する。

## Requirements

### Requirement 1: 定時スケジュール実行

**Objective:** As a オーナー, I want Tonariが毎日朝と夜の決まった時間にニュースを収集してくれること, so that 手動で指示しなくても最新情報を定期的に受け取れる

#### Acceptance Criteria

1. The News Trigger Lambda shall EventBridge Schedulerにより毎日9:00（JST）と21:00（JST）に起動される
2. When News Trigger Lambdaが起動された場合, the News Trigger Lambda shall Cognito M2Mトークンを取得し、AgentCore Runtimeを呼び出す
3. When AgentCore Runtimeが呼び出された場合, the Tonari Agent shall ニュース収集専用のプロンプトに従ってWeb検索ツールでニュースを収集する
4. The News Trigger Lambda shall 既存のtweet-trigger Lambdaと同様のパターン（Cognito認証 → AgentCore Runtime呼び出し）に従う

### Requirement 2: ニュース収集・要約

**Objective:** As a オーナー, I want Tonariが幅広いジャンルのニュースを収集しつつ、自分の興味に合わせたピックアップもしてくれること, so that 効率的に最新情報をキャッチアップできる

#### Acceptance Criteria

1. When ニュース収集が開始された場合, the Tonari Agent shall Web検索ツール（TavilySearch）を使用して、前回取得以降の最新ニュースを収集する
2. The Tonari Agent shall 総合ニュース（政治・経済・テクノロジー・エンタメ等）を幅広く収集する
3. The Tonari Agent shall LTMに蓄積されたオーナーの興味関心に基づき、1〜2件のニュースをTonariの判断でピックアップする
4. The Tonari Agent shall 収集したニュースを簡潔に要約し、通知に適したフォーマットで出力する

### Requirement 3: ニュース収集専用プロンプト

**Objective:** As a 開発者, I want ニュース収集タスク用のシステムプロンプトをTwitter投稿と同様に分離したい, so that タスクごとのエージェント挙動を独立して管理・調整できる

#### Acceptance Criteria

1. The News Trigger Lambda shall ニュース収集専用のプロンプトをAgentCore Runtimeに送信する
2. The ニュース収集プロンプト shall 収集するニュースのジャンル、要約フォーマット、ピックアップの指針を含む
3. The ニュース収集プロンプト shall 通知用の構造化された出力（タイトル・要約・ソースURL）を指示する

### Requirement 4: SNSメール通知

**Objective:** As a オーナー, I want ニュース要約をメールで受信したい, so that スマートフォンやスマートウォッチからいつでも確認でき、通知に気づける

#### Acceptance Criteria

1. When ニュース要約が生成された場合, the News Trigger Lambda shall SNS Topicにメッセージを発行する
2. The SNS Topic shall 設定ファイル（`config/`配下）で管理されたメールアドレスにメール通知を配信する
3. The 通知メール shall ニュース要約の全文を含み、可読性の高いフォーマットで送信される
4. If SNSへのメッセージ発行に失敗した場合, the News Trigger Lambda shall エラーをCloudWatch Logsに記録する

### Requirement 5: Web Push通知

**Objective:** As a オーナー, I want PCのブラウザにデスクトップ通知を受信したい, so that Tonariのページを開いていなくてもニュース更新に気づける

#### Acceptance Criteria

1. When ニュース要約が生成された場合, the News Trigger Lambda shall 登録済みのWeb Pushサブスクリプションに対してプッシュ通知を送信する
2. The プッシュ通知 shall ニュース要約のタイトルと概要を含む
3. The Tonariフロントエンド shall Service Workerを登録し、バックグラウンドでプッシュ通知を受信・表示する
4. When プッシュ通知がクリックされた場合, the Service Worker shall Tonariのページを開くまたはフォーカスする
5. If Web Pushの送信に失敗した場合（サブスクリプション期限切れ等）, the News Trigger Lambda shall 無効なサブスクリプションを削除する

### Requirement 6: Web Push購読管理

**Objective:** As a オーナー, I want 設定画面からWeb Push通知のオン・オフを管理したい, so that 必要に応じて通知設定を変更できる

#### Acceptance Criteria

1. The 設定画面（/admin） shall Web Push通知の購読登録・解除ボタンを提供する
2. When 購読登録ボタンが押された場合, the Tonariフロントエンド shall ブラウザの通知許可を要求し、許可後にサブスクリプション情報をバックエンドに保存する
3. When 購読解除ボタンが押された場合, the Tonariフロントエンド shall サブスクリプション情報をバックエンドから削除する
4. The 設定画面 shall 現在の購読状態（登録済み / 未登録）を表示する
5. The サブスクリプション情報 shall VAPIDキーによる認証に基づいて管理される

### Requirement 7: LTMへのニュース要約保存

**Objective:** As a オーナー, I want Tonariが過去のニュースを覚えていてくれること, so that 日常会話の中で最近のニュースについて自然に話題にしてもらえる

#### Acceptance Criteria

1. When ニュース要約が生成された場合, the Tonari Agent shall 要約をAgentCore Memory（LTM）に保存する
2. The 保存されるデータ shall ニュースの要約テキストと収集日時を含む（全文ではなく要約のみ）
3. While オーナーとの通常の会話中, the Tonari Agent shall LTMに保存されたニュース要約を参照し、関連する話題があれば自然に言及できる

### Requirement 8: インフラストラクチャ管理

**Objective:** As a 開発者, I want すべてのインフラリソースをCDKで管理したい, so that 再現可能なデプロイと一元管理ができる

#### Acceptance Criteria

1. The CDKスタック shall News Trigger Lambda、EventBridge Schedule、SNS Topic、DynamoDB（Pushサブスクリプション保存用）を定義する
2. The CDKスタック shall VAPID公開鍵をフロントエンド設定に、秘密鍵をSSM Parameter Storeに格納する
3. The CDKスタック shall メール通知先を設定ファイル（`config/infra.json`等）から参照する
4. The CDKスタック shall 既存のTonariStackに統合され、個別のスタックを作成しない
