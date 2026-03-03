# Requirements Document

## Introduction
TonariエージェントにNotionワークスペースとの連携機能を追加する。オーナーが会話を通じてNotionのページ検索・閲覧・作成・更新・データベースクエリを行えるようにする。既存のMCP Gateway + Lambda Toolパターンに従い、5つの汎用ツールを提供する。ショートカットツール（Quick Notes追加等）は設けず、よく使うデータベースのIDやスキーマはエージェントのシステムプロンプトに記載し、汎用ツールの組み合わせで対応する。

## Requirements

### Requirement 1: ページ検索
**Objective:** オーナーとして、会話を通じてNotionワークスペース内のページをキーワード検索したい。Notionアプリを開かずに、Tonariに聞くだけで関連ページを見つけられるようにするため。

#### Acceptance Criteria
1. When オーナーがNotionのページをキーワードで検索するよう指示した場合, the Tonari Agent shall Notion APIを使用してワークスペース内のページを検索し、該当するページのタイトル・URL・最終更新日時をリストで返す
2. When 検索結果が複数件ある場合, the Tonari Agent shall 最終更新日時の降順で結果を返す
3. If 検索結果が0件の場合, the Tonari Agent shall 「該当するページが見つかりませんでした」と自然な言い回しで伝える
4. When オーナーが検索結果の上限数を指定した場合, the Tonari Agent shall 指定された件数以内で結果を返す（デフォルトは10件）

### Requirement 2: ページ内容の取得
**Objective:** オーナーとして、特定のNotionページのプロパティとコンテンツを会話内で確認したい。Notionアプリを開かずに、ページの内容をTonariに読み上げてもらうため。

#### Acceptance Criteria
1. When オーナーがNotionページの内容を確認するよう指示した場合, the Tonari Agent shall ページIDを指定してプロパティ（タイトル、日付、ステータス等）とブロック（テキスト、リスト、ToDoなど）を取得して返す
2. When ページに複数種類のブロック（段落、見出し、箇条書き、ToDoなど）が含まれている場合, the Tonari Agent shall 各ブロックの内容を可読形式のテキストに変換して返す
3. If 指定されたページIDが存在しないか、Integrationのアクセス権がない場合, the Tonari Agent shall エラーを自然な言い回しで伝える

### Requirement 3: ページ作成
**Objective:** オーナーとして、会話を通じてNotionにページを作成したい。メモ、ブックマーク、議事録などを会話の流れの中でNotionに保存できるようにするため。

#### Acceptance Criteria
1. When オーナーがNotionデータベース配下にページを作成するよう指示した場合, the Tonari Agent shall 指定されたデータベースIDの配下にプロパティを設定してページを作成する
2. When オーナーが既存ページ配下にサブページを作成するよう指示した場合, the Tonari Agent shall 指定された親ページIDの配下にページを作成する
3. When ページ作成時にテキストコンテンツが指定された場合, the Tonari Agent shall コンテンツをブロック（段落）として含めたページを作成する
4. When ページ作成が成功した場合, the Tonari Agent shall 作成されたページのタイトルとURLを確認メッセージとして伝える
5. If database_idもparent_page_idも指定されていない場合, the Tonari Agent shall エラーメッセージを返す

### Requirement 4: ページ更新・アーカイブ
**Objective:** オーナーとして、既存のNotionページのプロパティを変更したり、コンテンツを追記したり、不要なページをアーカイブしたい。Notionを開かずに会話だけでページを管理できるようにするため。

#### Acceptance Criteria
1. When オーナーがNotionページのプロパティ更新を指示した場合, the Tonari Agent shall ページIDを指定してプロパティ（ステータス、タグ、日付等）を更新する
2. When オーナーがNotionページにコンテンツを追記するよう指示した場合, the Tonari Agent shall ページIDを指定してテキストブロックを末尾に追加する
3. When オーナーがNotionページの削除（アーカイブ）を指示した場合, the Tonari Agent shall ページのarchivedプロパティをtrueに設定してゴミ箱に移動する
4. When ページ更新が成功した場合, the Tonari Agent shall 実行した操作内容（プロパティ更新、コンテンツ追加、アーカイブ等）を確認メッセージとして伝える
5. If 指定されたページIDが存在しない場合, the Tonari Agent shall エラーを自然な言い回しで伝える

### Requirement 5: データベースクエリ
**Objective:** オーナーとして、Notionデータベースをフィルタやソート付きでクエリしたい。特定条件に合うページを効率的に見つけられるようにするため。

#### Acceptance Criteria
1. When オーナーがNotionデータベースの内容を確認するよう指示した場合, the Tonari Agent shall データベースIDを指定してページ一覧（プロパティのサマリ付き）を取得する
2. When オーナーが条件を指定してデータベースを検索するよう指示した場合, the Tonari Agent shall Notion APIのフィルタ構文を使用して条件に合致するページのみを返す
3. When オーナーがソート順を指定した場合, the Tonari Agent shall Notion APIのソート構文を使用して指定順でページを返す
4. If データベースIDが指定されていない場合, the Tonari Agent shall エラーメッセージを返す
5. If フィルタやソートのJSON形式が不正な場合, the Tonari Agent shall パースエラーを自然な言い回しで伝える

### Requirement 6: 認証・セキュリティ
**Objective:** オーナーとして、Notionワークスペースへのアクセスがセキュアに管理されていることを確認したい。個人のNotion情報が適切に保護された状態で連携するため。

#### Acceptance Criteria
1. The Tonari System shall Notion Internal Integration TokenをAWS SSM Parameter Store（SecureString）に安全に保管する
2. The Tonari System shall Lambda関数からSSMパラメータへのアクセスに最小権限のIAMポリシーを適用する
3. If Notion APIトークンが無効または期限切れの場合, the Tonari Agent shall 技術的詳細を表示せず、自然な言い回しでアクセスできないことを伝える
4. If Notion APIのレート制限に達した場合, the Tonari Agent shall しばらく待ってから再試行するよう自然に伝える
5. If Integrationが対象ページ/データベースに接続されていない場合, the Tonari Agent shall アクセス権限がないことを自然に伝える

### Requirement 7: エージェントのNotion活用ガイダンス
**Objective:** オーナーとして、Tonariがシステムプロンプトを通じてNotionの活用方法を理解し、汎用ツールを適切に使い分けてほしい。「メモして」「ブックマーク保存して」等のカジュアルな指示に対して、適切なデータベースとプロパティを選択して操作できるようにするため。

#### Acceptance Criteria
1. The Tonari Agent shall システムプロンプトに記載されたNotionデータベース情報（ID、プロパティスキーマ、用途）を参照して、オーナーの意図に合ったデータベースを選択する
2. When オーナーが「メモして」「ブックマークに追加して」等のカジュアルな指示をした場合, the Tonari Agent shall システムプロンプトの活用パターンに従い、該当するデータベースにページを作成する
3. When オーナーが「Notionで何ができるの？」と質問した場合, the Tonari Agent shall ページ検索、閲覧、作成、更新、データベースクエリの機能を自然な言い回しで案内する
4. The Tonari Agent shall Notionツールの結果を「あなたのNotionワークスペース」として自然に伝え、「API」「データベースID」などの技術用語を使用しない
5. When 他のツール（Gmail、Calendar等）との連携が有益な場面が検出された場合, the Tonari Agent shall Notionとの連携を自然に提案する（例：「メールの内容をNotionにまとめておきましょうか？」）

### Requirement 8: インフラストラクチャ
**Objective:** 開発者として、既存のMCP Gateway + Lambda Toolパターンに完全に準拠した形でNotion連携を追加したい。既存ツール（Calendar、Gmail等）と同一のパターンで統一的に管理するため。

#### Acceptance Criteria
1. The Tonari System shall `infra/lambda/notion-tool/` ディレクトリにPython Lambda関数を配置し、5つのツール（search_pages, get_page, create_page, update_page, query_database）をアクションベースのディスパッチで処理する
2. The Tonari System shall CDK PythonFunctionとしてLambda関数を定義し、notion-client依存をrequirements.txtから自動バンドルする
3. The Tonari System shall AgentCore GatewayにLambda Targetとして5つのツールスキーマを登録する
4. The Tonari System shall Lambda関数にSSM Parameter Store（`/tonari/notion/*`）への読み取りIAMポリシーを付与する
5. The Tonari System shall 既存のGatewayロールのLambdaInvokeポリシーにnotion-tool Lambdaを含める
