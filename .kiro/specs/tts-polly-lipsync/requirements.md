# Requirements Document

## Project Description (Input)
TTS機能：Amazon Pollyによる音声読み上げ＋リップシンク復活。Issue #32: 現在テキストのみで応答しているTonariに、Amazon Pollyを使った音声読み上げ機能を追加する。AITuber-kitベースのコードに無効化状態で残っている音声再生インフラ（LipSync, SpeakQueue）を再有効化し、Pollyで合成した音声でVRMモデルのリップシンクを連動させる。具体的には：(1) Amazon Polly APIルート（/api/tts）を新規作成し、PCM16形式で音声を返す (2) 感情に応じたSSML prosody変換（happy, sad, angry等）を実装 (3) LipSyncクラスを再有効化し、音声波形の音量解析でリップシンクを制御 (4) SpeakQueueによるキュー管理でスムーズな再生を実現 (5) 設定画面に音声ON/OFFトグルを追加し、OFFの場合は既存のテキストベース口パクを維持

## Introduction

TonariのAI応答にAmazon Pollyによる音声読み上げ機能を追加し、VRMモデルのリップシンクを音声波形と連動させる。既存のテキストベース口パクアニメーションを維持しつつ、ユーザーが設定で音声出力のON/OFFを切り替えられるようにする。

## Requirements

### Requirement 1: 音声合成API

**Objective:** ユーザーとして、AIの応答テキストを日本語の自然な音声に変換する仕組みがほしい。テキストのみの対話から音声付きの対話にアップグレードするため。

#### Acceptance Criteria
1. When AIの応答テキストが送信された時, the TTS API shall テキストをPCM16形式の音声バイナリに変換して返却する
2. The TTS API shall 日本語ニューラル音声を使用して自然な発話を生成する
3. If テキストが空またはリクエストが不正な場合, the TTS API shall 適切なエラーレスポンスを返却する
4. The TTS API shall サーバーサイドで音声合成を行い、APIキーをクライアントに露出しない

### Requirement 2: 感情連動音声

**Objective:** ユーザーとして、AIの感情に応じて声の抑揚が変化してほしい。感情表現が豊かで自然な対話体験を得るため。

#### Acceptance Criteria
1. When 感情タグ付きのテキストが送信された時, the TTS API shall 感情に応じた音声パラメータ（速度・ピッチ・音量）を適用して音声を生成する
2. The TTS API shall happy, sad, angry, surprised, relaxed, neutralの感情に対応する
3. If 未知の感情タグが指定された場合, the TTS API shall neutralとして処理する

### Requirement 3: 音声リップシンク

**Objective:** ユーザーとして、音声再生中にVRMモデルの口が音声に合わせて動いてほしい。視覚的に自然な対話体験を得るため。

#### Acceptance Criteria
1. While 音声が再生中の間, the VRM Model shall 音声波形の音量に連動して口の開閉アニメーションを実行する
2. When 音声再生が完了した時, the VRM Model shall 口を閉じた状態に戻る
3. The VRM Model shall 音量が小さい時は口をほぼ閉じ、音量が大きい時は口を大きく開ける

### Requirement 4: 音声再生キュー管理

**Objective:** ユーザーとして、複数の文からなるAI応答が順序通りスムーズに再生されてほしい。途切れや順序入れ替わりのない一貫した音声体験を得るため。

#### Acceptance Criteria
1. When 複数の文が順次生成された時, the 音声再生システム shall 文の生成順序を維持して順番に再生する
2. When Stopボタンが押された時, the 音声再生システム shall 現在の再生を即座に停止し、キューに残る音声をすべて破棄する
3. When 新しい会話セッションが開始された時, the 音声再生システム shall 前のセッションの残存キューを破棄する
4. While 音声を再生中の間, the UIシステム shall 発話中であることを状態として保持する

### Requirement 5: 音声出力設定

**Objective:** ユーザーとして、音声出力のON/OFFを設定画面から切り替えたい。自分の好みや環境に応じて音声の有無を選べるようにするため。

#### Acceptance Criteria
1. The 設定画面 shall 音声出力のON/OFFトグルを提供する
2. The 音声出力設定 shall デフォルトでOFFとする
3. When 音声出力設定が変更された時, the 設定システム shall ブラウザに設定を永続化し、次回アクセス時に復元する
4. While 音声出力がOFFの間, the 対話システム shall 既存のテキストベース口パクアニメーションを使用する
5. While 音声出力がONの間, the 対話システム shall 音声合成APIを呼び出して音声を再生し、音声リップシンクを実行する

### Requirement 6: エラーハンドリングとフォールバック

**Objective:** ユーザーとして、音声合成に失敗した場合でも対話が中断されないでほしい。安定した対話体験を維持するため。

#### Acceptance Criteria
1. If 音声合成APIがエラーを返した場合, the 対話システム shall テキストベース口パクアニメーションにフォールバックする
2. If ネットワーク接続が不安定な場合, the 対話システム shall テキスト表示は即座に行い、音声再生のみスキップする
3. While ブラウザのAutoPlay制約により音声再生がブロックされている間, the 音声再生システム shall ユーザーの初回操作を検出して自動的に音声再生を開始する
