# Requirements Document

## Introduction

現在のTonariツイート自動投稿機能は、Lambda内でTwitter APIを直接呼び出している。本機能改善では、Twitter API操作をAgentCore Gateway経由のツールとして再構成し、エージェントが自律的にTwitter操作を行えるようにする。同時に、ツイート生成時の文字数制限と品質チェックを強化する。

### 対象ユーザー

- **Tonariエージェント**: Gateway経由でTwitterツールを自律的に使用する
- **オーナー（開発者）**: 定時ツイートの品質向上と将来的なツール拡張の恩恵を受ける

### 既存構成（As-Is）

```
EventBridge → tweet-scheduler Lambda → AgentCore Runtime（テキスト生成のみ）
                                     → Twitter API（直接呼び出し: 参照・投稿）
```

### 目標構成（To-Be）

```
EventBridge → Trigger Lambda → AgentCore Runtime（エージェント自律実行）
                                 → Gateway Tool: Twitter参照Lambda
                                 → Gateway Tool: Twitter投稿Lambda
```

## Requirements

### Requirement 1: Twitter参照ツール

**Objective:** エージェントとして、Gateway経由でオーナーのツイートを取得したい。ツイート内容に関連した自然な投稿を生成するためである。

#### Acceptance Criteria

1. When エージェントがTwitter参照ツールを呼び出す, the Gateway shall オーナー（@_cityside）の当日のツイートを最大3件取得して返す
2. The Twitter参照ツール shall 各ツイートのテキストと投稿日時を含むレスポンスを返す
3. If オーナーの当日のツイートが存在しない場合, the Twitter参照ツール shall 空のリストを返す
4. If Twitter APIの呼び出しに失敗した場合, the Twitter参照ツール shall エラー情報を返し、エージェントがフォールバック動作を判断できるようにする
5. The Twitter参照ツール shall SSM Parameter Storeから取得した認証情報を使用してTwitter APIにアクセスする

### Requirement 2: Twitter投稿ツール

**Objective:** エージェントとして、Gateway経由でツイートを投稿したい。自律的にツイート生成から投稿までを完結するためである。

#### Acceptance Criteria

1. When エージェントがTwitter投稿ツールにテキストを渡して呼び出す, the Gateway shall 指定されたテキストをTONaRiアカウント（@tonari_with）からツイートとして投稿する
2. When ツイート投稿が成功した場合, the Twitter投稿ツール shall 投稿されたツイートのIDを返す
3. If ツイート投稿に失敗した場合, the Twitter投稿ツール shall エラー情報を返す
4. The Twitter投稿ツール shall SSM Parameter Storeから取得した認証情報を使用してTwitter APIにアクセスする

### Requirement 3: 定時ツイートパイプライン

**Objective:** システム運用者として、定時にエージェントを起動してツイートの自動投稿パイプラインを実行したい。人手を介さず定期的にTONaRiがツイートするためである。

#### Acceptance Criteria

1. The スケジューラ shall 毎日12:00と18:00（JST）にエージェントを起動する
2. When スケジューラがトリガーされた場合, the Trigger Lambda shall AgentCore Runtimeのエージェントを呼び出す
3. When エージェントが起動された場合, the エージェント shall 以下の順序で自律的にパイプラインを実行する: (a) Twitter参照ツールでオーナーのツイートを取得 → (b) ツイート内容を生成 → (c) セルフレビュー → (d) Twitter投稿ツールで投稿
4. If エージェントの呼び出しに失敗した場合, the Trigger Lambda shall エラーをログに記録して正常終了する

### Requirement 4: ツイート品質管理

**Objective:** エージェントとして、投稿前にツイートの品質をセルフチェックしたい。文字数超過や不自然な表現を防止するためである。

#### Acceptance Criteria

1. The エージェント shall ツイート生成時に120文字以内を目標として生成する
2. When ツイートを生成した後, the エージェント shall 投稿前に以下の観点でセルフレビューを実行する: (a) 140文字以内に収まっているか (b) 日本語として自然で読みやすいか (c) 感情タグやジェスチャータグが混入していないか
3. If セルフレビューで問題が検出された場合, the エージェント shall 意味を保ったまま修正してから投稿する
4. If 修正後もツイートが140文字を超過する場合, the エージェント shall 投稿をスキップする

### Requirement 5: 既存tweet-scheduler Lambdaの移行

**Objective:** システム運用者として、現在のtweet-scheduler Lambdaの直接API呼び出しをGateway経由に置き換えたい。ツールの再利用性を高め、将来のWebチャットからの利用にも対応するためである。

#### Acceptance Criteria

1. The 移行 shall 現在のtweet-scheduler Lambda内のtweet_fetcher・tweet_poster・twitter_clientの直接Twitter API呼び出しを廃止する
2. The 移行 shall 現在のtweet-scheduler Lambdaを、AgentCore Runtimeを呼び出すだけのTrigger Lambdaに簡素化する
3. The Twitter参照・投稿機能 shall それぞれ独立したLambda関数として分離し、AgentCore Gatewayのツールとして公開する
4. The 移行 shall 既存のSSM Parameter Store上の認証情報（/tonari/twitter/*）をそのまま利用する
5. The 移行 shall 既存のEventBridgeスケジュール（12:00/18:00 JST）を維持する
