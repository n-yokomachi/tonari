# Research & Design Decisions

## Summary
- **Feature**: `twitter-auto-post`
- **Discovery Scope**: New Feature（新規Lambda + EventBridge Scheduler追加）
- **Key Findings**:
  - Twitter/X APIは2026年2月にPay-Per-Useモデルに移行。無料枠は廃止されたが、少量利用なら月$1〜3で収まる
  - ハイブリッド構成（Lambda + AgentCore Runtime）でキャラクター設定・Memory活用とスケジューリングを両立
  - tweepyがX API v2対応の最も成熟したPythonライブラリ

## Research Log

### Twitter/X API v2 Pay-Per-Use料金モデル
- **Context**: Twitter APIの現在の料金体系を確認
- **Sources Consulted**: [X API Pricing](https://docs.x.com/x-api/getting-started/pricing), [Pay-Per-Use Launch Announcement](https://devcommunity.x.com/t/announcing-the-launch-of-x-api-pay-per-use-pricing/256476)
- **Findings**:
  - 2026年2月に従量課金制に完全移行、旧Free/Basic/Proプランは段階的に廃止
  - ツイート読み取り: $0.005/件、ツイート投稿: $0.010/件、ユーザー情報取得: $0.010/件
  - 同一リソースの24時間以内再取得は重複課金なし
  - クレジットベース（事前購入制）、月間支出上限の設定可能
  - 月間上限: ポスト読み取り200万件
- **Implications**: 1日3件読み取り + 2件投稿 = 月間約$1.05。十分にコスト最適

### Twitter/X API v2 エンドポイント仕様
- **Context**: ツイート投稿・取得に必要なAPIエンドポイントの確認
- **Sources Consulted**: [Create Post](https://docs.x.com/x-api/posts/create-post), [Get User Posts](https://docs.x.com/x-api/users/get-posts)
- **Findings**:
  - 投稿: `POST https://api.x.com/2/tweets` — OAuth 1.0a User Context必須、Bearer Tokenでは不可
  - 取得: `GET https://api.x.com/2/users/{id}/tweets` — Bearer Token/OAuth 1.0a/OAuth 2.0いずれも可
  - 取得パラメータ: `max_results`(5〜100), `exclude`(retweets,replies), `tweet.fields`(created_at,text等)
  - 投稿レート制限: 100リクエスト/15分（ユーザー）、10,000/24時間（アプリ）
  - 取得レート制限: 900リクエスト/15分（ユーザー）
- **Implications**: 1日5リクエスト程度ではレート制限に到達しない。OAuth 1.0aで統一するのが最もシンプル

### Python Twitter ライブラリ比較
- **Context**: X API v2対応のPythonライブラリ選定
- **Sources Consulted**: [Tweepy Docs](https://docs.tweepy.org/en/stable/), [python-twitter-v2](https://pypi.org/project/python-twitter-v2/)
- **Findings**:
  - tweepy: OAuth 1.0a/2.0両対応、v2エンドポイント全面対応、活発なメンテナンス（v4.14.0）、コミュニティ最大
  - python-twitter-v2: 小規模コミュニティ、ドキュメント不足
  - requests + requests-oauthlib: 手動実装が多く保守コスト高
- **Implications**: tweepyを採用。`tweepy.Client`クラスでv2操作が簡潔に書ける

### スケジューリングアーキテクチャ比較
- **Context**: 1日2回の定期実行を実現する最適なアーキテクチャ
- **Sources Consulted**: [EventBridge Scheduler Docs](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html), [AgentCore API Reference](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/)
- **Findings**:
  - **Option A（EventBridge + Lambda）**: 既存CDKパターンと完全に整合。EventBridge Schedulerはタイムゾーン指定可能、月1400万呼び出しまで無料。Lambda無料枠内で余裕。
  - **Option B（AgentCore Runtime経由）**: InvokeAgentRuntime APIはストリーミング前提で対話型。バッチ処理には不向き。Twitter APIツールのGateway追加が必要で過剰に複雑。
  - **Option C（GitHub Actions）**: 実行時刻の保証がない（最大30分遅延）。ソーシャルメディア投稿の時間帯効果を考慮すると不適切。
- **Implications**: Option Aを採用。既存の`tonari-stack.ts`にSchedule + Lambdaを追加するだけ

### 既存CDKインフラの分析
- **Context**: 新規Lambda追加時のCDKパターン確認
- **Sources Consulted**: `infra/lib/tonari-stack.ts`, `infra/lambda/`配下のファイル
- **Findings**:
  - CDK v2.170.0、`@aws-cdk/aws-lambda-python-alpha`でPython Lambda自動バンドリング
  - 既存Lambda: perfume-search, perfume-crud, api-authorizer（いずれもPython 3.12）
  - `requirements.txt`でPython依存管理、CDKが自動パッケージング
  - EventBridge Scheduler L2 Constructは`aws-cdk-lib`にGA済み（追加パッケージ不要）
- **Implications**: 同じパターンで`tweet-scheduler` Lambdaを追加可能。`requirements.txt`にtweepyを記載するだけ

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Lambda(直接Bedrock) | Lambda内でboto3でBedrock直接呼び出し | シンプル、依存少 | キャラクター設定の二重管理、Memory参照不可 | 不採用 |
| Lambda(AgentCore経由) | Lambda → Cognito M2M → InvokeAgentRuntime | Memory/キャラクター再利用、単一ソース管理 | SSEパースが必要、AgentCore起動コスト | 採用 |
| GitHub Actions | GitHub cron workflow | 最もシンプルなセットアップ | 実行時刻保証なし（最大30分遅延）、外部依存 | 不採用 |

## Design Decisions

### Decision: ハイブリッドアーキテクチャ（Lambda + AgentCore Runtime）
- **Context**: ツイート生成でTonariのキャラクター設定とMemory（オーナーとの会話履歴）を活用するためのアーキテクチャ選定
- **Alternatives Considered**:
  1. Lambda内でboto3でBedrock直接呼び出し — シンプルだがキャラクター設定の二重管理が必要、Memory参照不可
  2. Lambda → AgentCore Runtime（Cognito M2M認証） — フロントエンドと同じ呼び出しパターンでTonariエージェントを再利用
  3. GitHub Actions — cron workflowでPythonスクリプト実行、時刻精度不足
- **Selected Approach**: Option 2（Lambda → AgentCore Runtime）
- **Rationale**: Tonariのキャラクター設定（prompts.py）とMemory（オーナーの好み・会話履歴）を単一ソースで管理できる。フロントエンドと同じCognito M2M + InvokeAgentRuntime APIパターンを再利用するため、新規認証フローの構築不要。ツイートにオーナーとの会話内容を反映でき、よりパーソナライズされた投稿が可能。
- **Trade-offs**: SSEストリーミングのパース処理が必要、AgentCore Runtimeの起動コストが加算されるが、バッチ処理のためレイテンシは問題にならない
- **Follow-up**: SSEパースロジックはフロントエンドの`agentcore.ts`を参考に実装

### Decision: tweepy によるTwitter API連携
- **Context**: X API v2対応のPythonライブラリ選定
- **Alternatives Considered**:
  1. tweepy — 最も成熟したPython Twitterライブラリ
  2. python-twitter-v2 — 軽量だがコミュニティ小規模
  3. requests + requests-oauthlib — 手動HTTP実装
- **Selected Approach**: tweepy
- **Rationale**: OAuth 1.0a/2.0両対応、v2全エンドポイント対応、活発なメンテナンス、豊富なドキュメント
- **Trade-offs**: 依存パッケージが増えるが、Lambda自動バンドリングで問題なし
- **Follow-up**: tweepyのバージョン固定（`tweepy>=4.14.0`）

### Decision: SSM Parameter Store SecureString によるクレデンシャル管理
- **Context**: Twitter APIの認証情報（4つのキー）の安全な管理
- **Alternatives Considered**:
  1. AWS Secrets Manager — 暗号化保存、自動ローテーション対応、$0.40/シークレット/月
  2. SSM Parameter Store SecureString — KMS暗号化、無料（スタンダードティア）
  3. Lambda環境変数 — 最もシンプルだがCloudFormationテンプレートに平文で残る
- **Selected Approach**: SSM Parameter Store SecureString
- **Rationale**: 無料でKMS暗号化が利用可能。Secrets Managerは$0.40/月のコストが発生し、個人プロジェクトの認証情報管理には過剰。`get_parameters_by_path()`で一括取得可能。
- **Trade-offs**: 自動ローテーション機能なし（Twitter APIキーのローテーション頻度は低いため問題なし）
- **Follow-up**: AWS CLIでパラメータを手動設定する手順を準備

## Risks & Mitigations
- **Twitter APIの仕様変更リスク** — tweepyのバージョンアップで対応。APIエンドポイントは変更頻度が低い
- **Bedrock API呼び出し失敗** — Lambda内でエラーハンドリング、該当回の投稿をスキップ
- **Twitter APIクレジット不足** — 月間コスト$1〜3と極めて低いが、支出上限を設定して安全策
- **Lambda コールドスタート** — 1日2回の実行なので毎回コールドスタートだが、処理時間は数秒以内で問題なし

## References
- [X API Pricing](https://docs.x.com/x-api/getting-started/pricing)
- [X API Create Post](https://docs.x.com/x-api/posts/create-post)
- [X API Get User Posts](https://docs.x.com/x-api/users/get-posts)
- [Tweepy Documentation](https://docs.tweepy.org/en/stable/)
- [EventBridge Scheduler L2 Construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_scheduler-readme.html)
- [EventBridge Scheduler Pricing](https://aws.amazon.com/eventbridge/pricing/)
