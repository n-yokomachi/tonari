# Implementation Plan

- [x] 1. Twitter API連携コンポーネント実装
- [x] 1.1 (P) TwitterClientの実装
  - SSM Parameter Store SecureStringからTwitter API認証情報（api_key, api_secret, access_token, access_token_secret）を一括取得するクラスを実装する
  - 取得した認証情報でtweepy.ClientをOAuth 1.0aモードで初期化する
  - 認証情報がログやエラーメッセージに出力されないようにする
  - Lambda関数の依存定義ファイルにtweepyを追加する
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - _Contracts: TwitterClient Service Interface_

- [x] 1.2 (P) TweetFetcherの実装
  - tweepy Clientを使ってオーナーのTwitterアカウントから最新ツイートを取得する関数を実装する
  - リツイートとリプライを除外し、当日分（JST基準）のツイートを最大3件までフィルタリングする
  - APIリクエストは1回のみ発行し、コスト最適化を実現する
  - API取得失敗時は例外を握りつぶし、空リストを返してパイプラインを継続する
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.3_
  - _Contracts: TweetFetcher Service Interface_

- [x] 1.3 (P) TweetPosterの実装
  - tweepy Clientを使ってツイートを投稿する関数を実装する
  - 投稿成功時はツイートIDをログに記録し、失敗時はエラーをログに記録してリトライは行わない
  - _Requirements: 3.3, 4.1, 5.1_
  - _Contracts: TweetPoster Service Interface_

- [x] 2. (P) AgentCore Runtime連携コンポーネント実装
  - Cognito M2M認証（client_credentials grant）でアクセストークンを取得する処理を実装する
  - InvokeAgentRuntime APIをHTTPで呼び出し、SSEストリーミングレスポンスを受信してテキストを結合する処理を実装する
  - session_idは`tweet-auto-{YYYY-MM-DD}`形式、actor_idは`tonari-owner`固定でMemoryを共有する
  - オーナーのツイートがある場合は関連ツイート生成プロンプト、ない場合はセンシティブ情報を避けた可愛い系ツイート生成プロンプトを構築する
  - プロンプトで「140文字以内」「感情タグ・ジェスチャータグなし」「ツイート本文のみ出力」を指示する
  - 生成結果が140文字を超えた場合は再度呼び出しを1回試行し、それでも超過なら投稿スキップとする
  - 生成失敗時はNoneを返す
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Contracts: AgentCoreInvoker Service Interface_

- [x] 3. Lambda Handlerパイプライン実装
  - ツイート取得 → AgentCore生成 → ツイート投稿のパイプラインをオーケストレーションするLambda handlerを実装する
  - 各ステップでエラーをキャッチし、CloudWatch Logsに適切なレベル（INFO/ERROR）でログを記録する
  - オーナーのTwitterユーザーID、SSMプレフィックス、AgentCore設定（Runtime ARN、Cognito情報）を環境変数から取得する
  - Cognito Client Secretは環境変数またはSSM Parameter Storeから安全に取得する
  - _Requirements: 3.2, 1.4, 3.4_
  - _Contracts: TweetSchedulerHandler Batch Contract_

- [x] 4. CDKインフラ定義
  - 既存のtonari-stack.tsにtweet-scheduler Lambda関数を追加する（Python 3.12、タイムアウト5分、メモリ256MB）
  - EventBridge Schedulerで12:00 JSTと18:00 JSTの2つのcronスケジュールを定義し、Lambdaをターゲットにする
  - Lambda IAMロールにSSM Parameter Store読み取り権限（GetParameter、GetParametersByPath、SecureString復号）を付与する
  - 環境変数にオーナーのTwitterユーザーID、SSMプレフィックス、AgentCore Runtime ARN、Cognito設定を設定する
  - infra.jsonにtweet-scheduler関連の設定値を追加する（必要に応じて）
  - _Requirements: 1.4, 3.1, 3.4, 4.2_

- [x] 5. ビルド検証
  - CDK synthを実行してCloudFormationテンプレートが正常に生成されることを確認する
  - npm run buildでフロントエンドのビルドが成功することを確認する（既存機能への影響がないこと）
  - _Requirements: 3.1, 4.2_
