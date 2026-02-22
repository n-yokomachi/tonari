# Implementation Plan

- [x] 1. (P) Twitter Read Lambdaを実装する
  - SSM Parameter Storeから`/tonari/twitter/bearer_token`を取得し、Bearer Token認証でTwitter API v2にアクセスする
  - オーナーの最近のツイートを取得し、当日（JST基準）のものを最大3件にフィルタリングする
  - 各ツイートのID・テキスト・投稿日時（ISO 8601）を含む構造化レスポンスを返す
  - ツイートが存在しない場合は空リスト、API失敗時はerrorフラグ付きレスポンスを返す
  - SSMモック・tweepyモック・日付フィルタリング・空結果・エラーハンドリングのユニットテストを作成する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. (P) Twitter Write Lambdaを実装する
  - SSM Parameter Storeから`/tonari/twitter/`配下のOAuth 1.0a認証情報（api_key, api_secret, access_token, access_token_secret）を取得する
  - 受け取ったテキストをTONaRiアカウント（@tonari_with）からツイートとして投稿する
  - 成功時はツイートIDを含むレスポンス、失敗時はerrorフラグ付きレスポンスを返す
  - SSMモック・tweepyモック・投稿成功・投稿失敗のユニットテストを作成する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. (P) Trigger Lambdaとツイートパイプラインプロンプトを実装する
  - Cognito M2Mトークンを取得し、AgentCore Runtimeを呼び出すシンプルなハンドラーを作成する
  - ツイートパイプラインの手順（ツイート参照→生成→セルフレビュー→投稿）と品質基準（120文字目標、140文字上限、日本語品質、タグ混入防止）を含むプロンプトを構築する
  - プロンプトに現在時刻（JST）とオーナーのユーザーIDを動的に埋め込む
  - セッションIDは`tonari-tweet-{日付}-{時間}`形式、actor_idは`tonari-owner`とする
  - AgentCore呼び出し失敗時はエラーをログに記録して正常終了する
  - Cognitoトークン取得モック・AgentCore呼び出しモック・プロンプト構築検証・エラーハンドリングのユニットテストを作成する
  - _Requirements: 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.2_

- [x] 4. CDKスタックを更新し、既存tweet-schedulerコードを移行する
  - Twitter Read LambdaとTwitter Write Lambdaの定義をCDKスタックに追加する（SSM読み取り権限付与含む）
  - 既存のtweet-scheduler Lambda定義をTrigger Lambda用に置き換える（環境変数の簡素化、不要なSSM Twitter権限の除去）
  - 既存のEventBridgeスケジュール（12:00/18:00 JST）をそのまま維持する
  - 不要になったファイル（tweet_fetcher.py, tweet_poster.py, twitter_client.py, agentcore_invoker.py）と対応するテストファイルを削除する
  - _Requirements: 3.1, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Gatewayターゲットを登録し、エンドツーエンドで動作検証する
  - CDKデプロイ後、`agentcore gateway create-mcp-gateway-target`コマンドでTwitter ReadとTwitter WriteのLambdaターゲットを既存のtonarigatewayに登録する
  - 各ターゲットにツールスキーマ（name, description, inputSchema）を定義する
  - 手動でTrigger Lambdaを起動し、エージェントがGateway経由でオーナーのツイートを取得→ツイート生成→セルフレビュー→投稿の一連のパイプラインを実行できることを確認する
  - _Requirements: 3.3, 5.3_
