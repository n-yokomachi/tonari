# Requirements Document

## Introduction
ページフッター（入力フォームの上など）に、香水ソムリエAIへの質問をワンクリックで投げられるプリセット質問ボタンを用意する。デモや初回利用時に「何を聞けばいいかわからない」ユーザーが迷わず会話を始められることを目的とする。

質問内容はコード上で固定管理し、どの端末から開いても同じ質問が表示される。既存の設定画面にある質問の事前設定欄（追加・編集・削除・並び替え）は削除し、表示/非表示のトグルのみを残す。

## Requirements

### Requirement 1: 固定プリセット質問の表示
**Objective:** As a 初回利用ユーザー, I want 香水に関する代表的な質問がボタンとして表示されている, so that 何を聞けばいいか考えずにすぐ会話を始められる

#### Acceptance Criteria
1. The Scensei shall 香水ソムリエのコンセプトに沿ったプリセット質問をコード上に固定で定義し表示する
2. The Scensei shall プリセット質問に以下のカテゴリをカバーする内容を含む：おすすめ質問（例：「今日のおすすめの香水は？」）、シーン別質問（例：「ビジネスにおすすめの香水はある？」）、探索的質問（例：「初心者におすすめの香水を教えて」）
3. The Scensei shall プリセット質問をデフォルトで有効状態で提供する
4. The Scensei shall 質問内容をどの端末から開いても同一の状態で表示する（localStorageやユーザー設定に依存しない）

### Requirement 2: ワンクリック質問送信
**Objective:** As a ユーザー, I want プリセット質問ボタンをワンクリックで送信できる, so that テキスト入力の手間なく会話を開始できる

#### Acceptance Criteria
1. When ユーザーがプリセット質問ボタンをクリックした時, the Scensei shall そのボタンのテキストをそのままAIへの質問として送信する
2. When プリセット質問が送信された時, the Scensei shall 通常のチャット入力と同じパイプラインで処理する
3. While AIが応答を処理中の間, the Scensei shall プリセット質問ボタンのクリックを無効化する

### Requirement 3: 入力フォーム付近への配置
**Objective:** As a 初回利用ユーザー, I want 質問ボタンが入力フォームの近くに表示されている, so that 自然に目に入り操作方法がすぐわかる

#### Acceptance Criteria
1. The Scensei shall プリセット質問ボタンを入力フォームの上部に配置する
2. The Scensei shall デスクトップ・モバイル両方のレイアウトでプリセット質問ボタンを視認可能に表示する
3. When プリセット質問の数がコンテナ幅を超える場合, the Scensei shall 横スクロールで全ての質問にアクセス可能にする

### Requirement 4: 表示/非表示の設定と既存設定欄の削除
**Objective:** As a 開発者, I want プリセット質問の表示/非表示を設定画面から切り替えられる, so that デモ時と通常利用時で使い分けられる

#### Acceptance Criteria
1. The Scensei shall 設定画面にプリセット質問の表示/非表示トグルを提供する
2. The Scensei shall 既存の設定画面にある質問の事前設定欄（質問の追加・編集・削除・並び替え機能）を削除する
3. The Scensei shall 表示/非表示の設定をlocalStorageに永続化し、再訪問時に復元する

### Requirement 5: 視覚的なわかりやすさ
**Objective:** As a 初回利用ユーザー, I want 質問ボタンがクリック可能であることが一目でわかる, so that 迷わず操作できる

#### Acceptance Criteria
1. The Scensei shall プリセット質問ボタンをScenseiのテーマカラー（ゴールド/ダーク系）に調和したデザインで表示する
2. The Scensei shall ボタンにホバー/タップ時の視覚的フィードバックを提供する
3. The Scensei shall ボタンテキストが長い場合でも省略せず全文を表示する
