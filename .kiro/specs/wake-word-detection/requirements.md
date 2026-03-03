# Requirements Document

## Introduction
Tonariに「TONaRi」ウェイクワード検知と音声入力機能を追加する。ユーザーが別ウィンドウで作業中に「TONaRi」と呼びかけると、音声入力モードが起動し、発話内容をテキスト変換してエージェントに送信する。Picovoice Porcupine WASMによるブラウザ内ウェイクワード検知と、Web Speech APIによる音声認識を組み合わせて実現する。

## Requirements

### Requirement 1: ウェイクワード検知
**Objective:** ユーザーとして、別ウィンドウで作業中に「TONaRi」と声をかけるだけでTonariを起動したい。追加のアプリやデバイスなしにブラウザ内で完結させたい。

#### Acceptance Criteria
1. When ウェイクワード検知が有効な状態でユーザーが「TONaRi」と発話した, the Tonari shall ウェイクワードを検知し音声入力モードを開始する
2. While ウェイクワード検知が有効, the Tonari shall ブラウザタブが visible but unfocused の状態でもマイク入力を継続的に監視する
3. When ユーザーがウェイクワード検知を無効に設定した, the Tonari shall マイク監視を停止しリソースを解放する
4. The Tonari shall ウェイクワード検知の処理をブラウザ内（WASM）で完結させ、音声データを外部サーバーに送信しない

### Requirement 2: 音声認識（Speech-to-Text）
**Objective:** ユーザーとして、ウェイクワード検知後に日本語で話した内容がリアルタイムにテキスト変換されてほしい。

#### Acceptance Criteria
1. When ウェイクワードが検知された, the Tonari shall Web Speech APIを使用して音声認識を開始する
2. While 音声認識が実行中, the Tonari shall 認識結果をリアルタイムにバッファに蓄積する
3. When 一定時間の無音が検出された, the Tonari shall 音声認識を終了しバッファの内容を確定する
4. The Tonari shall 日本語の音声を認識対象とする
5. If Web Speech APIがブラウザでサポートされていない, the Tonari shall ウェイクワード検知のみ有効とし、音声認識が利用不可である旨を表示する

### Requirement 3: テキスト送信フロー
**Objective:** ユーザーとして、音声認識で変換されたテキストが自動的にエージェントに送信されるか、入力フォームに反映されてほしい。

#### Acceptance Criteria
1. When 音声認識が無音検出により終了した, the Tonari shall バッファのテキストを自動的にエージェントに送信する
2. When 音声認識中にユーザーがTonariのブラウザタブにフォーカスを当てた, the Tonari shall バッファの内容を入力フォームに書き込み、ユーザーが編集・送信できる状態にする
3. When テキストが送信された, the Tonari shall 既存のチャットフローと同じ処理（ストリーミング応答、TTS再生、チャットログ表示）を実行する
4. If バッファが空の状態で音声認識が終了した, the Tonari shall 送信を行わず音声入力モードを終了する

### Requirement 4: UI/UXフィードバック
**Objective:** ユーザーとして、ウェイクワードが検知されたことや音声入力中であることを視覚的・聴覚的に認識したい。

#### Acceptance Criteria
1. When ウェイクワードが検知された, the Tonari shall 効果音を再生して検知を通知する
2. When ウェイクワードが検知された and アバターが睡眠モーション中, the Tonari shall 睡眠モーションを解除してアバターを起こす
3. While 音声認識が実行中, the Tonari shall リスニング中であることを示す視覚的インジケーターを表示する
4. When 音声認識結果がバッファに蓄積される, the Tonari shall 認識中のテキストをリアルタイムにプレビュー表示する

### Requirement 5: マイクロフォン管理
**Objective:** ユーザーとして、マイクの許可や状態が適切に管理され、不要なときはリソースを消費しないでほしい。

#### Acceptance Criteria
1. When ウェイクワード検知を初めて有効にした, the Tonari shall ブラウザのマイク使用許可をリクエストする
2. If マイク使用許可が拒否された, the Tonari shall ウェイクワード検知を有効にできない旨をユーザーに通知する
3. When ウェイクワード検知が無効化された, the Tonari shall マイクストリームを停止しAudioContextリソースを解放する
4. The Tonari shall Porcupineのウェイクワード検知とWeb Speech APIの音声認識でマイクストリームを適切に共有または切り替える

### Requirement 6: 設定管理
**Objective:** ユーザーとして、ウェイクワード検知のオン/オフを設定画面から切り替え、設定が次回アクセス時にも保持されてほしい。

#### Acceptance Criteria
1. The Tonari shall 設定画面にウェイクワード検知のオン/オフトグルを提供する
2. When ウェイクワード検知の設定が変更された, the Tonari shall 設定をlocalStorageに永続化する
3. When ページが再読み込みされた, the Tonari shall 保存された設定に基づいてウェイクワード検知を自動的に開始または停止する
4. The Tonari shall Picovoice Access Keyの設定欄を提供し、キーをlocalStorageに保存する
5. If Picovoice Access Keyが未設定の状態でウェイクワード検知を有効にしようとした, the Tonari shall Access Keyの入力を促すメッセージを表示する
