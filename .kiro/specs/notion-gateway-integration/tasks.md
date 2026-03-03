# Implementation Plan

- [x] 1. Lambda関数の基盤構築（認証・ディスパッチ・ヘルパー）
  - SSM Parameter Storeから Notion APIトークンを取得し、notion-clientでNotionクライアントを初期化する。クライアントはグローバル変数にキャッシュし、認証エラー時にクリアして再取得する
  - Lambda handlerでeventの`action`フィールドに基づき6つのツール関数にディスパッチするルーティングを実装する。不明なactionにはエラーレスポンスを返す
  - Notionのrich_text配列からプレーンテキストを抽出するヘルパー、プロパティ値を型ごとに変換するヘルパー（title, rich_text, number, select, multi_select, date, checkbox, url, status, people, relation）を実装する
  - Notion API呼び出し時のエラーハンドリングを実装する。HTTPステータスコード（401, 403, 404, 429, 5xx）ごとに日本語のユーザーフレンドリーなメッセージを返す
  - 必須パラメータの欠落チェック、JSON文字列のパース試行などの入力バリデーションを実装する
  - requirements.txtに`notion-client`依存を記載する
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1_

- [x] 2. Notionツールアクションの実装
- [x] 2.1 search_pagesアクションの実装
  - Notion Search APIを使用してワークスペース内のページをキーワード検索する機能を実装する
  - 検索結果からページのタイトル、URL、最終更新日時を抽出し、更新日時の降順でリストとして返す
  - max_resultsパラメータで結果件数を制限する（デフォルト10件）
  - 検索結果が0件の場合は適切なメッセージを返す
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.2 get_pageアクションの実装
  - Pages APIでページのプロパティ（タイトル、日付、ステータス等）を取得する機能を実装する
  - Blocks APIでページ内のブロック（段落、見出し、箇条書き、ToDoなど）を取得し、可読テキストに変換する
  - include_blocksパラメータでブロック取得の有無を制御する（デフォルトtrue）
  - ページが見つからない場合やアクセス権がない場合のエラーハンドリングを行う
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.3 create_pageアクションの実装
  - データベース配下またはページ配下にページを作成する機能を実装する。database_idまたはparent_page_idのいずれかを親として指定する
  - titleパラメータによる簡易タイトル指定と、propertiesパラメータによる詳細プロパティ指定の両方をサポートする
  - contentパラメータが指定された場合、テキストを段落ブロックとしてページに含める
  - 作成成功時にページのタイトルとURLを返す。database_idもparent_page_idも未指定の場合はエラーを返す
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.4 update_pageアクションの実装
  - ページIDを指定してプロパティ（ステータス、タグ、日付等）を更新する機能を実装する
  - contentパラメータが指定された場合、テキストブロックをページ末尾に追記する（Blocks Append API使用）
  - archivedパラメータをtrueにすることでページをゴミ箱に移動する機能を実装する
  - 更新成功時に実行した操作内容を確認メッセージとして返す。ページが見つからない場合はエラーを返す
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.5 query_databaseアクションの実装
  - データベースIDを指定してページ一覧をプロパティサマリ付きで取得する機能を実装する
  - filterパラメータでNotion APIフィルタ構文によるフィルタリングをサポートする
  - sortsパラメータでNotion APIソート構文による並べ替えをサポートする
  - max_resultsパラメータで結果件数を制限する（デフォルト20件）。database_id未指定時やJSON形式不正時はエラーを返す
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2.6 get_databaseアクションの実装
  - データベースIDを指定してデータベースのプロパティスキーマ（カラム定義）を取得する機能を実装する
  - 各プロパティの名前、型、選択肢一覧（select/multi_select/statusの場合）を返す
  - エージェントがページ作成・更新前にDBの構造と利用可能な選択肢を把握できるようにする
  - _Requirements: 5.1, 7.1_

- [x] 3. CDKインフラストラクチャ統合
- [x] 3.1 (P) WorkloadConstructにnotion-tool Lambda定義を追加
  - PythonFunctionでnotion-tool Lambda関数を定義する（functionName: tonari-notion-tool、Python 3.12、タイムアウト30秒、メモリ128MB）
  - パブリックプロパティとしてnotionToolLambdaを公開する
  - SSM Parameter Store `/tonari/notion/*` パスへの読み取り権限（ssm:GetParameter）をLambdaロールに付与する
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 3.2 (P) AgentCoreConstructにGateway Target登録を追加
  - AgentCoreConstructPropsにnotionToolLambdaプロパティを追加する
  - lambdaFunctions配列にnotionToolLambdaを追加し、GatewayロールのLambdaInvokeポリシーに含める
  - NotionTool Lambda Targetとして6つのツール（search_pages, get_page, create_page, update_page, query_database, get_database）のスキーマを登録する。各スキーマにはactionフィールドを含める
  - _Requirements: 8.3, 8.5_

- [x] 3.3 TonariStackにnotion-tool Lambdaのwiring追加
  - AgentCoreConstruct初期化時にWorkloadConstructのnotionToolLambdaを渡すwiringを追加する
  - _Requirements: 8.3_

- [x] 4. (P) システムプロンプトへのNotion活用ガイダンス追加
  - システムプロンプトにNotion連携セクションを追加し、6つのツールの使い方とパラメータを記載する
  - オーナーの4つのデータベース（Quick Notes, Bookmarks, Product Idea, Blog Idea）のIDと用途を記載する。DB IDは初期段階ではプレースホルダを使用する。プロパティスキーマはハードコードせず、get_databaseで動的取得する方針をエージェントに指示する
  - カジュアルな指示から適切なDB操作へのマッピングパターンを記載する（「メモして」→ Quick Notes、「ブックマークして」→ Bookmarks等）
  - ページ作成・更新の前にget_databaseでスキーマを確認し、利用可能なプロパティと選択肢に基づいて操作するようガイダンスを記載する
  - Notionツールの結果を自然に伝えるためのルール（技術用語禁止等）と、他ツール（Gmail, Calendar等）との連携提案パターンを記載する
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. CDKテンプレート生成の検証
  - `cdk synth`を実行し、CloudFormationテンプレートが正常に生成されることを確認する
  - テンプレート内にnotion-tool Lambda関数が含まれ、SSM権限が付与されていることを検証する
  - Gateway Targetに6つのNotionツールが登録されていることを検証する
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

## Requirements Coverage

| Requirement | Tasks |
|-------------|-------|
| 1.1, 1.2, 1.3, 1.4 | 2.1 |
| 2.1, 2.2, 2.3 | 2.2 |
| 3.1, 3.2, 3.3, 3.4, 3.5 | 2.3 |
| 4.1, 4.2, 4.3, 4.4, 4.5 | 2.4 |
| 5.1, 5.2, 5.3, 5.4, 5.5 | 2.5, 2.6 |
| 6.1, 6.2, 6.3, 6.4, 6.5 | 1 |
| 7.1, 7.2, 7.3, 7.4, 7.5 | 2.6, 4 |
| 8.1, 8.2, 8.4 | 1, 3.1 |
| 8.3, 8.5 | 3.2, 3.3 |
