# Implementation Plan

- [x] 1. インフラストラクチャのセットアップ
- [x] 1.1 AgentCore GatewayにTavily統合ターゲットを追加する（コンソール経由）
  - AWS Management Consoleから既存Gateway（`scenseigateway-zxdprxgrqx`）を開く
  - Targetsタブから「Integration」タイプのターゲットを追加する
  - Target Nameを `TavilyTarget`、ProviderにTavilyを設定する
  - Credential Providerはコンソールが自動作成（`tavily-api-key`）
  - ツール名: `TavilyTarget__TavilySearchPost`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. システムプロンプトにWeb検索ガイドラインを追加する
  - `prompts.py` の `SCENSEI_SYSTEM_PROMPT` にWeb検索ツールの使用セクションを追加する
  - 使用タイミング（search_perfumesで見つからない場合、未知のブランド名、最新情報が必要な場合）を記述する
  - 検索クエリ作成のコツ（具体的なブランド名・商品名を含める、一般的な検索は避ける）を記述する
  - 検索優先度ルール（実体験データを優先、Web検索は補完的に使用）を明記する
  - 情報源明示ルール（Web検索結果を伝える際は「Webで調べたところ」と前置きする）を追加する
  - フォールバック指示（APIエラー時はLLMの知識で回答）を含める
  - 既存のプロンプト構造・フォーマットルールを維持する
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

- [x] 3. デプロイと動作確認
- [x] 3.1 AgentCore Runtimeにデプロイする
  - `agentcore deploy` でプロンプト変更を含むエージェントをデプロイする
  - デプロイ完了: `scensei-xajQ0R77kv`
  - _Requirements: 3.1_

- [x] 3.2 E2Eテストを実施する
  - DBにある香水の質問（例：「おすすめの香水」）→ search_perfumes結果が優先されることを確認する
  - DBにない香水の質問（例：「シャネル No.5について教えて」）→ Web検索で補完して回答されることを確認する
  - Web検索結果を含む回答で情報源が明示されていること（「Webで調べたところ」等）を確認する
  - _Requirements: 3.2, 4.1, 4.2, 4.3, 4.4_

- [x] 3.3 セットアップ手順をドキュメント化する
  - Credential Provider作成手順、Gateway Target追加手順、確認方法を記録する
  - 環境再構築時に再現可能な手順書とする
  - _Requirements: 1.1, 2.4_
