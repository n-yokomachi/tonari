# Requirements Document

## Introduction
TonariがTwitter/Xに定期的にポストする機能を実装する。オーナーの最近のツイートを参照し、それに関連した内容をTonari専用アカウントから投稿する。オーナーのツイートがない場合は、センシティブな情報を避けた可愛い系のツイートを投稿する。ツイート生成はAgentCore Runtime上のTonariエージェントを通じて行い、キャラクター設定とMemory（オーナーとの過去の会話記憶）を活用する。Twitter/X APIの従量課金モデル（Pay-Per-Use）を前提に、コストを最小限に抑える設計とする。

## Requirements

### Requirement 1: オーナーのツイート取得
**Objective:** オーナーとして、Tonariに自分の最近のツイートを参照してほしい。それにより、Tonariが自分の関心事に沿った投稿をしてくれるようにしたい。

#### Acceptance Criteria
1.1. The Twitter Auto-Post Service shall オーナーのTwitter/Xアカウントから1日あたり最新3件のツイートを取得する
1.2. When ツイート取得を実行した時, the Twitter Auto-Post Service shall 取得したツイートの本文を後続のツイート生成処理に渡す
1.3. If Twitter/X APIからのツイート取得に失敗した場合, the Twitter Auto-Post Service shall エラーをログに記録し、オーナーのツイートなしとして処理を継続する
1.4. The Twitter Auto-Post Service shall オーナーのTwitterアカウントIDを環境変数で設定可能にする

### Requirement 2: ツイート内容の生成
**Objective:** オーナーとして、Tonariのキャラクターらしい自然なツイートを自動生成してほしい。オーナーの話題に関連しつつ、Tonariの個性が出る投稿にしたい。

#### Acceptance Criteria
2.1. When オーナーのツイートが1件以上取得できた時, the Twitter Auto-Post Service shall オーナーのツイート内容に関連したTonariらしいツイートをAgentCore Runtime上のTonariエージェントで生成する
2.2. When その日のオーナーのツイートが0件だった時, the Twitter Auto-Post Service shall センシティブな情報を含まない、可愛い系のツイートをTonariエージェントで生成する
2.3. The Twitter Auto-Post Service shall Tonariエージェント（システムプロンプト + AgentCore Memory）を通じて、キャラクター設定と過去の会話記憶を踏まえたツイートを生成する
2.4. The Twitter Auto-Post Service shall 生成するツイートを140文字以内に収める
2.5. If Claude AIによるツイート生成に失敗した場合, the Twitter Auto-Post Service shall エラーをログに記録し、該当回の投稿をスキップする

### Requirement 3: 定期自動投稿
**Objective:** オーナーとして、Tonariが毎日決まった時間にTwitterに投稿してほしい。手動操作なしで自動的に運用されるようにしたい。

#### Acceptance Criteria
3.1. The Twitter Auto-Post Service shall 毎日12:00（JST）と18:00（JST）の1日2回、Tonari専用アカウントからツイートを投稿する
3.2. When 投稿時刻になった時, the Twitter Auto-Post Service shall オーナーのツイート取得 → ツイート生成 → 投稿のパイプラインを自動実行する
3.3. If Twitter/X APIへのツイート投稿に失敗した場合, the Twitter Auto-Post Service shall エラーをログに記録し、リトライは行わない
3.4. The Twitter Auto-Post Service shall 投稿スケジュール（時刻・回数）を設定ファイルまたは環境変数で変更可能にする

### Requirement 4: Twitter/X API連携
**Objective:** オーナーとして、Tonari専用のTwitterアカウントでAPI連携を行い、安全にツイートの読み書きを行えるようにしたい。

#### Acceptance Criteria
4.1. The Twitter Auto-Post Service shall Twitter/X API v2を使用してツイートの読み取りと投稿を行う
4.2. The Twitter Auto-Post Service shall Tonari専用Twitterアカウントの認証情報（API Key, API Secret, Access Token, Access Token Secret）を環境変数で管理する
4.3. The Twitter Auto-Post Service shall OAuth 1.0aによる認証でTwitter/X APIと通信する
4.4. The Twitter Auto-Post Service shall 認証情報をソースコードやログに出力しない

### Requirement 5: コスト最適化
**Objective:** オーナーとして、Twitter/X APIの利用コストを月$5以下に抑えたい。

#### Acceptance Criteria
5.1. The Twitter Auto-Post Service shall 1日あたりのAPIリクエスト数をツイート読み取り3件 + ツイート投稿2件以内に制限する
5.2. The Twitter Auto-Post Service shall 月間の想定APIコストが$3以下となる設計にする（読み取り90件×$0.005 + 投稿60件×$0.010 = $1.05）
5.3. The Twitter Auto-Post Service shall 不要なAPIリクエスト（重複取得、不要なユーザー情報取得等）を行わない
