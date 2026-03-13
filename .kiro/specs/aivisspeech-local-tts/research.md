# Research & Design Decisions

## Summary
- **Feature**: `aivisspeech-local-tts`
- **Discovery Scope**: Extension（既存TTSシステムの拡張）
- **Key Findings**:
  - AivisSpeech Engine APIはVOICEVOX互換（`/audio_query` → `/synthesis`）、レスポンスはWAV形式
  - 既存LipSyncの `playFromArrayBuffer(buffer, onEnded, isNeedDecode: true)` でWAVデコード再生が可能
  - ブラウザからlocalhost直接通信時のCORS制約: AivisSpeech EngineはデフォルトでCORS許可済み（`--cors`オプション）

## Research Log

### AivisSpeech Engine API仕様
- **Context**: ブラウザから直接呼び出すAPIの仕様確認
- **Sources Consulted**:
  - [AivisSpeech Engine GitHub](https://github.com/Aivis-Project/AivisSpeech-Engine)
  - [AivisSpeech Engine API使い方 - Qiita](https://qiita.com/aqua_ix/items/196b235e83798b8c3631)
- **Findings**:
  - デフォルトポート: 10101
  - `/speakers` (GET): 利用可能な話者一覧をJSON配列で返す
  - `/audio_query?text={text}&speaker={id}` (POST): テキストから音声クエリJSONを生成
  - `/synthesis?speaker={id}` (POST, body: audio_query JSON): WAVバイナリを返す
  - `/version` (GET): エンジンバージョン文字列を返す
  - VOICEVOX ENGINE APIと概ね互換。ただしAudioQuery内の一部パラメータに差異あり（`intonationScale`の意味が異なる）
  - speaker IDはVOICEVOXの連番ではなくMD5ハッシュベースの大きな数値（例: `888753760`）
- **Implications**: APIクライアントは2ステップ呼び出し（audio_query → synthesis）で実装。speaker IDは数値型で扱う

### Docker起動とモデル管理
- **Context**: ユーザーがWindows PCでセットアップする手順の確認
- **Sources Consulted**:
  - [AivisSpeech Engine GitHub - Docker](https://github.com/Aivis-Project/AivisSpeech-Engine)
  - [Docker Hub](https://hub.docker.com/r/voicevox/voicevox_engine)（参考）
- **Findings**:
  - CPU版: `ghcr.io/aivis-project/aivisspeech-engine:cpu-latest`
  - GPU版（NVIDIA）: `ghcr.io/aivis-project/aivisspeech-engine:nvidia-latest`
  - モデルディレクトリをボリュームマウントして`.aivmx`ファイルを追加可能
  - Windows: `-v %USERPROFILE%/.local/share/AivisSpeech-Engine:/home/user/.local/share/AivisSpeech-Engine-Dev`
- **Implications**: ドキュメントにはCPU版/GPU版の両方のコマンドを記載。モデル追加手順も含める

### 既存LipSyncとの互換性
- **Context**: AivisSpeechのWAVレスポンスを既存音声再生パイプラインで処理可能か
- **Findings**:
  - 現在のPollyパス: `isNeedDecode: false`（PCM16直接再生、sampleRate: 16000）
  - LipSync.playFromArrayBuffer: `isNeedDecode: true`の場合、`AudioContext.decodeAudioData()`でWAV/MP3等をデコード
  - AivisSpeechは標準WAV（PCM16、24kHz）を返すため `isNeedDecode: true` で正常にデコード可能
- **Implications**: AivisSpeechパスでは `isNeedDecode: true` を使用。SpeakQueueのインターフェースはそのまま利用可能

### CORS対応
- **Context**: ブラウザからlocalhost:10101へのクロスオリジンリクエスト
- **Findings**:
  - AivisSpeech EngineはFastAPIベースで、デフォルトでCORSミドルウェアが有効
  - `--allow_origin` オプションで許可オリジンを制御可能（デフォルト: all origins）
  - Vercel上のフロントエンドからもCORS問題なくアクセス可能（ただしlocalhost同士の場合のみ実用的）
- **Implications**: 特別なCORS設定は不要。ブラウザからの直接fetch呼び出しが可能

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Strategy Pattern | TTSエンジンをStrategy interfaceで抽象化し、Polly/AivisSpeechを切替可能にする | 拡張性高い、テスト容易 | 過度な抽象化の可能性 | 採用: シンプルな分岐で十分だが、将来のエンジン追加に備える |
| 直接分岐 | speakCharacter内でif分岐 | 最小変更 | エンジン追加時にコード肥大化 | 不採用: 現状でも2エンジン分の分岐が必要 |

## Design Decisions

### Decision: TTSクライアントの抽象化レベル
- **Context**: Polly（サーバー経由）とAivisSpeech（ブラウザ直接）の2つのTTSエンジンを切り替え可能にする
- **Alternatives Considered**:
  1. speakCharacter.ts内で直接if分岐 — 最小変更だが保守性低下
  2. TTSクライアント関数を分離し、設定に応じて呼び分け — 適度な分離
- **Selected Approach**: TTSクライアント関数の分離（Option 2）
- **Rationale**: speakCharacter.tsの責務を音声再生制御に保ち、TTS取得ロジックを別関数に分離。過度な抽象化（interfaceやclass）は避け、関数レベルの分離で十分
- **Trade-offs**: Polly用のAPIルートコードはそのまま残る。設定による切り替えが増えるがUI上で明確に分かれる
- **Follow-up**: AivisSpeechが安定稼働したらPolly側の削除を検討（Requirement 6）

### Decision: speaker IDの管理方式
- **Context**: AivisSpeechのspeaker IDは大きな数値（MD5ハッシュベース）で、ユーザーが直接入力するのは非現実的
- **Alternatives Considered**:
  1. APIから動的取得して選択肢を構築 — UXは良いがEngine起動が前提
  2. 固定リストをフロントエンドに定義 — Engineが停止中でも選択可能だがモデル追加時にコード変更が必要
  3. テキスト入力でspeaker IDを直入力 — 実装は簡単だがUXが悪い
- **Selected Approach**: テキスト入力（Option 3）を初期実装とし、将来的にAPI動的取得（Option 1）を追加
- **Rationale**: ユーザーが限られており（個人プロジェクト）、セットアップドキュメントでspeaker IDの確認方法を案内すれば十分。動的取得はEngine接続に依存するため、初期はシンプルに保つ
- **Trade-offs**: UXは最小限だが、個人利用では問題なし
- **Follow-up**: 必要に応じて`/speakers` APIからのリスト取得UIを追加

## Risks & Mitigations
- **AivisSpeech Engine未起動時**: フォールバックとしてテキストベースリップシンクに切り替え（Requirement 2.4）
- **CORS問題**: AivisSpeechはデフォルトで全オリジン許可だが、ブラウザセキュリティ設定によりブロックされる可能性 → ドキュメントにトラブルシューティング記載
- **レイテンシ**: 2ステップAPI（audio_query → synthesis）のため、Polly（1ステップ）より遅い可能性 → ローカル通信のため実用上は問題なし

## References
- [AivisSpeech Engine GitHub](https://github.com/Aivis-Project/AivisSpeech-Engine) — API仕様、Docker起動方法
- [AivisSpeech Engine API使い方 - Qiita](https://qiita.com/aqua_ix/items/196b235e83798b8c3631) — API呼び出し例
- [Aivis Project 公式サイト](https://aivis-project.com/) — プロジェクト概要
