# Research & Design Decisions

## Summary
- **Feature**: `cross-device-memory-sharing`
- **Discovery Scope**: Extension（既存AgentCore Memory統合の拡張）
- **Key Findings**:
  - 既存のMemoryリソースに`update-memory` APIで4つのLTMストラテジーを追加可能（再作成不要）
  - LTMストラテジーの保存namespaceと取得namespace prefixは独立して設定でき、保存は`{sessionId}`付き、取得は`{actorId}`のみでクロスセッション検索が実現できる
  - `agentcore` CLIには`memory update`コマンドがないため、`aws bedrock-agentcore-control update-memory`を直接使用する必要がある

## Research Log

### AgentCore Memory UpdateMemory API
- **Context**: 既存メモリリソース`tonari_mem-SZ0n7JG0K4`にLTMストラテジーを追加できるか確認
- **Sources Consulted**: AWS公式ドキュメント（UpdateMemory API Reference）、AgentCore Starter Toolkit
- **Findings**:
  - `UpdateMemory` APIの`memoryStrategies`パラメータに`addMemoryStrategies`操作で追加可能
  - `modifyMemoryStrategies`（既存変更）、`deleteMemoryStrategies`（削除）も使用可能
  - `agentcore` CLI（starter toolkit）には`memory update`が存在しない。`aws bedrock-agentcore-control update-memory`を直接使用
- **Implications**: 既存リソースを破棄せずにストラテジーを追加できるため、既存STMデータを保持したまま移行可能

### LTM 4ストラテジーのNamespace設計
- **Context**: 4つのストラテジーそれぞれに適切なnamespaceパターンを設計
- **Sources Consulted**: AWS公式ドキュメント（Memory Organization、Session Actor Namespace、Memory Strategies）、Strands Agents ドキュメント
- **Findings**:
  - **Semantic**: `/facts/{actorId}/` — actorId単位で事実を蓄積。`{sessionId}`不要
  - **User Preference**: `/preferences/{actorId}/` — actorId単位で好みを蓄積。`{sessionId}`不要
  - **Summary**: `/summaries/{actorId}/{sessionId}/` — セッション単位で要約を生成・保存。取得時は`/summaries/{actorId}/`のprefix検索で横断取得
  - **Episodic**: `/episodes/{actorId}/{sessionId}/` — セッション単位でエピソード保存。Reflection namespaceは`/reflections/{actorId}/`でactorId単位
  - Namespace末尾の`/`はプレフィックス衝突防止のために必須
- **Implications**: 保存側namespaceと取得側namespace prefixを分離することで、セッション単位の保存とクロスセッション取得を両立

### Strands Agents RetrievalConfig マッピング
- **Context**: `AgentCoreMemoryConfig`の`retrieval_config`が各ストラテジーのnamespaceとどう対応するか
- **Sources Consulted**: Strands Agents公式ドキュメント、AgentCore SDK Memory
- **Findings**:
  - `retrieval_config`の辞書キーはnamespace prefixとして機能し、そのprefix以下のLTMレコードをセマンティック検索する
  - `{actorId}`と`{sessionId}`のプレースホルダーは`AgentCoreMemorySessionManager`が実行時に実際の値に自動置換
  - prefix検索のため、保存namespace `/summaries/{actorId}/{sessionId}/`に対して取得prefix `/summaries/{actorId}/`を指定すると全sessionIdのレコードが横断取得される
- **Implications**: retrieval_configのキーを変更するだけでクロスセッション取得が実現可能

## Design Decisions

### Decision: actorIdの固定値化
- **Context**: 個人専用エージェントのため、全端末で同一オーナーとして識別する必要がある
- **Alternatives Considered**:
  1. 固定文字列（例: `tonari-owner`）— 最もシンプル
  2. 認証情報（WebAuthn）からactorIdを導出 — 将来的な拡張性あり
  3. サーバーサイドで固定actorIdを割り当て — フロントエンド変更不要
- **Selected Approach**: 固定文字列`tonari-owner`を使用
- **Rationale**: 個人専用であり、認証によるユーザー識別は不要。最小変更で目的を達成
- **Trade-offs**: 将来マルチユーザー対応する場合は認証ベースへの切り替えが必要
- **Follow-up**: マルチユーザー対応が必要になった場合はWebAuthn IDをactorIdに利用する設計を検討

### Decision: Summaryストラテジーの保存/取得namespace分離
- **Context**: サマリーはセッション単位で生成されるが、取得時にはクロスセッションで検索したい
- **Alternatives Considered**:
  1. 保存: `{sessionId}`付き、取得: `{actorId}`のみのprefix検索
  2. 保存・取得ともに`{actorId}`のみ — Summaryストラテジーの仕様に反する可能性
- **Selected Approach**: 保存は`/summaries/{actorId}/{sessionId}/`、取得は`/summaries/{actorId}/`
- **Rationale**: Summaryストラテジーはセッション単位で要約を生成するため保存側に`{sessionId}`が必要。取得はprefix検索で自然にクロスセッション化
- **Trade-offs**: なし。AgentCore Memoryの設計に沿った自然なアプローチ

## Risks & Mitigations
- **既存STMデータとの互換性**: ストラテジー追加は既存データに影響しない（追加操作のため）。リスク低
- **LTM抽出の非同期性**: LTMレコードの抽出には5-60秒かかる。即時反映を期待するユーザーには注意が必要。→ UIへの即時影響はないため許容
- **固定actorId変更時の既存データ**: 過去のランダムactorIdで蓄積されたLTMデータは新しい固定actorIdでは取得できない。→ 現在LTMストラテジーが未設定のためLTMデータは存在せず、影響なし

## References
- [UpdateMemory API](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_UpdateMemory.html)
- [Memory Organization](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-organization.html)
- [Memory Strategies](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html)
- [Session Actor Namespace](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/session-actor-namespace.html)
- [Episodic Memory Strategy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/episodic-memory-strategy.html)
- [Strands Agents - AgentCore Memory](https://strandsagents.com/latest/documentation/docs/community/session-managers/agentcore-memory/)
