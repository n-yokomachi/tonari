# Implementation Plan

- [x] 1. (P) フロントエンドのactorIdをオーナー固定値に変更
  - `getActorId()`関数を固定文字列`tonari-owner`を返却するように変更する
  - `localStorage`によるランダムUUID生成・保存ロジックを削除する
  - `getSessionId()`関数はSTMの会話コンテキスト管理に必要なため変更しない
  - 既存の`localStorage`に保存されたランダムactorIdのクリーンアップは不要（参照されなくなるだけで無害）
  - _Requirements: 1.1, 1.2_
  - _Contracts: OwnerActorId_

- [x] 2. (P) バックエンドのretrieval_configをクロスセッション対応に拡張
  - `AgentCoreMemoryConfig`の`retrieval_config`を3つのnamespace prefixから5つに拡張する
  - 既存のpreferences・factsのnamespaceキー末尾に`/`を追加する（プレフィックス衝突防止）
  - summariesの取得prefixから`{sessionId}`を除外し、`/summaries/{actorId}/`にすることで全セッション横断取得を実現する
  - episodicメモリの取得prefix `/episodes/{actorId}/`を追加する（クロスセッション）
  - episodicリフレクションの取得prefix `/reflections/{actorId}/`を追加する（クロスセッション）
  - 各namespace prefixの`top_k`と`relevance_score`を設定する（preferences: 5/0.5, facts: 10/0.4, summaries: 3/0.6, episodes: 3/0.5, reflections: 3/0.5）
  - _Requirements: 1.3, 2.2, 2.3, 3.2, 3.3, 4.2, 4.3, 5.2, 5.4_
  - _Contracts: RetrievalConfig Service Interface_

- [x] 3. (P) AgentCore MemoryリソースにLTM 4ストラテジーを設定
  - 既存メモリリソース`tonari_mem-SZ0n7JG0K4`に`aws bedrock-agentcore-control update-memory`で4つのLTMストラテジーを追加する
  - Semanticストラテジー: 事実情報の自動抽出、namespace `/facts/{actorId}/`
  - User Preferenceストラテジー: 好み・嗜好の自動学習、namespace `/preferences/{actorId}/`
  - Summaryストラテジー: セッション要約の自動生成、namespace `/summaries/{actorId}/{sessionId}/`
  - Episodicストラテジー: エピソード記憶の構造化保存、namespace `/episodes/{actorId}/{sessionId}/`、リフレクション namespace `/reflections/{actorId}/`
  - 追加後に`get-memory`で4ストラテジーが正しく設定されていることを確認する
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 5.3_
  - _Contracts: MemoryStrategies API Contract_

- [x] 4. ビルド検証
  - `npm run build`でフロントエンドのビルドが成功することを確認する
  - ビルドエラーがある場合はPrettier/ESLintで修正する
  - _Requirements: 1.1, 1.2_
