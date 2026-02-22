# Requirements Document

## Introduction

Tonariはオーナー1人のための専属パーソナルAIエージェントである。アクセス元の端末やセッションに関係なく、常にオーナー専属のエージェントとして振る舞い、STM（短期記憶）・LTM（長期記憶）を含むすべてのメモリをオーナーのために一元管理する必要がある。

現在の実装では、actorIdがブラウザのlocalStorageでランダム生成されるため端末ごとに別ユーザー扱いとなり、またLTMストラテジーがMemoryリソースに未設定のため長期記憶が蓄積されない。本機能では、オーナー専属エージェントとしてのメモリアーキテクチャを確立する。

## Requirements

### Requirement 1: オーナー専属エージェントとしてのメモリ統一
**Objective:** オーナーとして、どの端末・どのセッションからTonariにアクセスしても、常に自分専属のエージェントとして振る舞い、すべてのメモリ（STM・LTM）が自分のものとして管理されてほしい。

#### Acceptance Criteria
1. The Tonari shall アクセス元の端末やセッションに関係なく、常に同一オーナーの専属エージェントとして振る舞う
2. The Tonari Frontend shall すべての端末・すべてのセッションで同一の固定actorIdを使用し、AgentCoreバックエンドにリクエストを送信する
3. The Tonari shall STMはセッション単位で会話コンテキストを管理しつつ、LTMを通じてセッション間の知識を共有することで、オーナーとの継続的な対話体験を提供する

### Requirement 2: LTM Semanticストラテジーの導入
**Objective:** オーナーとして、会話中に伝えた事実情報（購入履歴、試した香水、重要な出来事等）が端末やセッションを問わず永続的に記憶されてほしい。これにより、毎回同じ情報を繰り返し伝える必要がなくなる。

#### Acceptance Criteria
1. The AgentCore Memory shall 会話イベントから事実情報を自動的に抽出し、長期記憶レコードとして永続化する
2. The AgentCore Memory shall 事実情報をオーナー単位のnamespaceに保存し、端末やセッションを問わず検索可能にする
3. When オーナーが過去に伝えた事実に関連する質問をした場合, the Tonari Agent shall セマンティック検索により関連する事実情報を取得し、回答に反映する

### Requirement 3: LTM User Preferenceストラテジーの導入
**Objective:** オーナーとして、自分の好みや嗜好（好きな香り、苦手な香り、予算感、TPOの好み等）が端末やセッションを問わず学習・蓄積されてほしい。これにより、常にパーソナライズされた提案を受けられる。

#### Acceptance Criteria
1. The AgentCore Memory shall 会話イベントからオーナーの好み・嗜好を自動的に識別・抽出し、長期記憶レコードとして永続化する
2. The AgentCore Memory shall オーナーの好みをオーナー単位のnamespaceに保存し、端末やセッションを問わず検索可能にする
3. When オーナーが提案やおすすめを求めた場合, the Tonari Agent shall 蓄積された好み情報をセマンティック検索で取得し、パーソナライズされた回答を生成する

### Requirement 4: LTM Summaryストラテジーの導入
**Objective:** オーナーとして、過去のセッションで話した内容の要約が端末やセッションを問わず保持されてほしい。これにより、どこからアクセスしても「前に話したこと」を踏まえた対話ができる。

#### Acceptance Criteria
1. The AgentCore Memory shall 各セッションの会話内容から要約を自動生成し、長期記憶レコードとして永続化する
2. The AgentCore Memory shall 要約をセッション単位で保存しつつ、取得時にはオーナー単位のprefix検索により全セッション・全端末の要約を横断検索可能にする
3. When オーナーが過去の会話に関連する話題を持ちかけた場合, the Tonari Agent shall 端末やセッションを問わず過去の要約をセマンティック検索で取得し、文脈を踏まえた回答を生成する

### Requirement 5: LTM Episodicストラテジーの導入
**Objective:** オーナーとして、Tonariとの意味のあるインタラクション（香水相談のエピソード等）が端末やセッションを問わず構造化された記憶として残り、過去のエピソードから学んだ知見が今後の対話に活かされてほしい。

#### Acceptance Criteria
1. The AgentCore Memory shall オーナーとの意味のあるインタラクションを構造化されたエピソード（状況・意図・評価・正当化）として記録し、長期記憶として永続化する
2. The AgentCore Memory shall エピソードをセッション単位で保存しつつ、取得時にはオーナー単位のprefix検索により全セッション・全端末のエピソードを横断検索可能にする
3. The AgentCore Memory shall 複数のエピソードを横断して振り返り（リフレクション）を生成し、オーナー単位のnamespaceに保存する
4. When オーナーが過去に類似のインタラクションがあった話題について相談した場合, the Tonari Agent shall 端末やセッションを問わず関連するエピソードおよび振り返りをセマンティック検索で取得し、過去の経験を踏まえた回答を生成する
