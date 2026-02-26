# Research & Design Decisions

## Summary
- **Feature**: `scheduled-news-notification`
- **Discovery Scope**: Complex Integration（既存アーキテクチャの拡張 + 新コンポーネント追加）
- **Key Findings**:
  - Lambda からの Web Push 送信には `pywebpush` ライブラリを使用。`cryptography` パッケージの Linux ネイティブビルドが必要（CDK の PythonFunction で自動処理可能）
  - SNS メール通知はサブスクリプション確認が必要（手動クリック）。コスト無料
  - Service Worker は `public/sw.js` に配置し、Next.js Pages Router で `/sw.js` として配信可能
  - VAPID 鍵は SSM Parameter Store（SecureString）に保存。ローテーション不要のため Secrets Manager は過剰

## Research Log

### Web Push 送信（Python Lambda）
- **Context**: News Trigger Lambda からブラウザへ Push 通知を送信する方法の調査
- **Sources Consulted**: pywebpush PyPI、GitHub README、py-vapid ドキュメント
- **Findings**:
  - `pywebpush` の `webpush()` 関数が主要 API。`subscription_info`、`data`、`vapid_private_key`、`vapid_claims` を渡す
  - 依存: `cryptography`（C拡張あり）、`http_ece`、`py_vapid`、`requests`
  - `vapid_private_key` は base64 DER 文字列を直接受け取れる（ファイルパス不要）
  - `vapid_claims` には `sub`（mailto:）が必須。`aud` と `exp` は自動設定
  - Lambda でのビルド: `cryptography` は Linux ターゲットでのビルドが必要。CDK の `PythonFunction` は Docker ベースで自動ビルドするため問題なし
- **Implications**: News Trigger Lambda は `pywebpush` を依存に追加し、SSM から VAPID 秘密鍵を取得して Web Push を送信する

### Service Worker と Next.js Pages Router
- **Context**: Web Push 受信用の Service Worker を Next.js Pages Router プロジェクトに統合する方法
- **Sources Consulted**: Next.js ドキュメント、DEV Community 記事、Designly ブログ
- **Findings**:
  - `public/sw.js` に配置すれば `/sw.js` として自動配信される
  - `_app.tsx` の `useEffect` で `navigator.serviceWorker.register('/sw.js')` を呼ぶのが標準パターン
  - `pushManager.subscribe()` に VAPID 公開鍵（URL-safe base64）を渡す
  - `PushManager` の存在チェックが必要（一部ブラウザ非対応）
  - `push` イベントハンドラで `self.registration.showNotification()` を呼ぶ
  - `notificationclick` イベントで `clients.openWindow()` または `clients.matchAll()` → `focus()` を実行
- **Implications**: `public/sw.js` を新規作成し、Push 購読ロジックは Admin 設定画面に配置

### SNS メール通知
- **Context**: ニュース要約をオーナーにメール送信するための SNS Topic 構成
- **Sources Consulted**: AWS CDK EmailSubscription API ドキュメント、AWS SNS ドキュメント
- **Findings**:
  - `sns.Topic` + `subscriptions.EmailSubscription` で CDK 定義可能
  - メールサブスクリプションはデプロイ後に手動確認が必要（確認メールのリンクをクリック）
  - 確認リンクの有効期限は 3 日間
  - SES と異なりサンドボックス制限なし
  - `PublishCommand` で `Subject` と `Message` を指定してメール送信
  - コスト: 月 1,000 件のメール通知は無料枠内
- **Implications**: `config/infra.json` にメールアドレスを設定し、CDK でサブスクリプションを自動作成。初回デプロイ後に確認メール承認が必要

### DynamoDB Web Push サブスクリプション管理
- **Context**: Web Push サブスクリプション情報の永続化スキーマ設計
- **Sources Consulted**: AWS DynamoDB ベストプラクティス、Web Push 仕様
- **Findings**:
  - PK=`userId`、SK=`endpoint` の複合キー設計が適切
  - 1ユーザーが複数ブラウザ/デバイスから購読可能
  - 属性: `p256dh`、`auth`、`createdAt`、`ttl`（任意）
  - Push サービスが 410 Gone を返した場合はサブスクリプションを即座に削除
  - DynamoDB TTL でサブスクリプションの自動有効期限切れも可能（今回は明示的削除で十分）
- **Implications**: `tonari-push-subscriptions` テーブルを新規作成（PK=userId、SK=endpoint）

### VAPID 鍵管理
- **Context**: VAPID 鍵の生成方法と安全な保管場所の選定
- **Sources Consulted**: py-vapid ドキュメント、AWS SSM vs Secrets Manager 比較記事
- **Findings**:
  - 生成: `npx web-push generate-vapid-keys` が最も簡単（URL-safe base64 形式で直接出力）
  - SSM Parameter Store（SecureString）が推奨: 無料、VAPID 鍵はローテーション不要のため Secrets Manager は過剰
  - 公開鍵はフロントエンドに公開する必要あり（`NEXT_PUBLIC_VAPID_PUBLIC_KEY` 環境変数）
  - 秘密鍵は Lambda が SSM から `WithDecryption=True` で取得
- **Implications**: VAPID 鍵を SSM に `/tonari/vapid/private-key`（SecureString）と `/tonari/vapid/public-key`（String）として手動保存。CDK では SSM パス参照のみ定義

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| tweet-trigger パターン踏襲 | EventBridge → 専用 Lambda → Cognito 認証 → AgentCore Runtime | 実績あり、既存パターンの再利用でリスク低 | Lambda の責務が大きくなる（AgentCore呼び出し + SNS発行 + Web Push送信） | 採用。通知送信は AgentCore 応答取得後に Lambda 内で実行 |
| Lambda 分離（収集用 + 通知用） | 収集 Lambda → SNS → 通知 Lambda | 責務分離が明確 | 複雑化、SNS でのメッセージペイロード制限 | 不採用。現段階ではオーバーエンジニアリング |

## Design Decisions

### Decision: News Trigger Lambda の責務範囲
- **Context**: ニュース収集（AgentCore 呼び出し）と通知送信（SNS + Web Push）を 1 つの Lambda で行うか分離するか
- **Alternatives Considered**:
  1. 1 Lambda で収集 + 通知送信を一貫処理
  2. 収集 Lambda → SNS → 通知 Lambda の 2 段階
- **Selected Approach**: 1 Lambda で一貫処理
- **Rationale**: 既存の tweet-trigger Lambda と同じパターン。朝晩 2 回の実行でスケールの懸念なし。Lambda 分離は現段階で不要な複雑性
- **Trade-offs**: Lambda のコード量は増えるが、デプロイ・運用がシンプル
- **Follow-up**: Lambda タイムアウトを 5 分に設定（AgentCore のニュース収集に時間がかかる可能性）

### Decision: Web Push サブスクリプション管理の API 配置
- **Context**: フロントエンドからサブスクリプション登録/解除を行う API の配置場所
- **Alternatives Considered**:
  1. Next.js API Routes（フロントエンド側）
  2. 既存の API Gateway + Lambda（CDK 管理）
- **Selected Approach**: Next.js API Routes
- **Rationale**: サブスクリプション操作はフロントエンドのブラウザ API と密結合しており、Next.js API Routes が自然。既存の Admin 認証ミドルウェアが適用される
- **Trade-offs**: DynamoDB へのアクセスにフロントエンド環境から AWS SDK が必要
- **Follow-up**: Vercel 環境変数に AWS 認証情報を設定する必要あり

### Decision: VAPID 鍵の保管場所
- **Context**: VAPID 鍵ペアの安全な保管方法
- **Selected Approach**: SSM Parameter Store（秘密鍵は SecureString、公開鍵は String）
- **Rationale**: 無料、VAPID 鍵はローテーション不要、既存パターン（Cognito client secret）と統一
- **Trade-offs**: 手動で鍵を生成・登録する初期セットアップが必要

## Risks & Mitigations
- **Risk**: AgentCore Runtime のニュース収集が Lambda タイムアウト（5分）を超える → Lambda タイムアウトを適切に設定、AgentCore 側のプロンプトで収集範囲を制限
- **Risk**: Web Push サブスクリプションの期限切れ → Push 送信時の 410 エラーで自動削除
- **Risk**: SNS メールサブスクリプションの手動確認忘れ → CDK デプロイ時の CfnOutput で確認リマインダーを表示
- **Risk**: pywebpush の cryptography パッケージが Lambda ランタイムで動作しない → CDK PythonFunction は Docker ベースでビルドするため問題ないが、要動作確認

## References
- [pywebpush - GitHub](https://github.com/web-push-libs/pywebpush) — Python Web Push ライブラリ
- [Web Push API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — ブラウザ Push API 仕様
- [VAPID - RFC 8292](https://tools.ietf.org/html/rfc8292) — VAPID 認証仕様
- [AWS SNS EmailSubscription - CDK Docs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sns_subscriptions.EmailSubscription.html) — CDK SNS メール統合
- [AWS SSM Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) — パラメータ管理
