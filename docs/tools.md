# エージェントツール一覧

Tonariエージェントが使用可能なMCPツールの一覧。
すべてのツールはMCP Gateway Target経由でLambda関数として実行される。

## 概要

| Gateway Target | ツール数 | 概要 |
|---------------|---------|------|
| [perfume-search](#perfume-search) | 1 | 香水データベース検索 |
| [diary-tool](#diary-tool) | 2 | 日記の保存・取得 |
| [task-tool](#task-tool) | 4 | タスク管理（CRUD） |
| [calendar-tool](#calendar-tool) | 6 | Googleカレンダー操作 |
| [date-tool](#date-tool) | 3 | 日付計算ユーティリティ |
| [twitter-read](#twitter-read) | 1 | ツイート取得 |
| [twitter-write](#twitter-write) | 1 | ツイート投稿 |
| [TavilySearch](#tavilysearch) | 1 | Web検索 |

---

## perfume-search

香水データベースから香水を検索する。

| ツール名 | 説明 |
|---------|------|
| `search_perfumes` | キーワード（ブランド名、香りの特徴、季節、シーンなど）で香水を検索 |

**Lambda**: `tonari-perfume-search`
**データソース**: DynamoDB (`tonari-perfumes`)

### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `query` | string | ✅ | 検索キーワード |
| `limit` | number | | 最大取得件数（デフォルト: 5） |

---

## diary-tool

オーナーの日記の保存と取得を行う。

| ツール名 | 説明 |
|---------|------|
| `save_diary` | 日記エントリーを保存 |
| `get_diaries` | 日記エントリーを日付降順で取得 |

**Lambda**: `tonari-diary-tool`
**データソース**: DynamoDB (`tonari-diary`)

### save_diary パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `user_id` | string | ✅ | ユーザーID |
| `date` | string | ✅ | 日付（YYYY-MM-DD） |
| `body` | string | ✅ | 日記本文 |

### get_diaries パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `user_id` | string | ✅ | ユーザーID |
| `limit` | number | | 最大取得件数（デフォルト: 10） |

---

## task-tool

オーナーのタスクの追加・一覧・完了・更新を行う。

| ツール名 | 説明 |
|---------|------|
| `list_tasks` | アクティブなタスク一覧を取得（期限フィルタ対応） |
| `add_task` | 新しいタスクを追加 |
| `complete_task` | タスクを完了にする |
| `update_task` | タスクのタイトルや期限を更新 |

**Lambda**: `tonari-task-tool`
**データソース**: DynamoDB (`tonari-tasks`)

### list_tasks パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `user_id` | string | ✅ | ユーザーID |
| `include_completed` | boolean | | 完了済みタスクを含む（デフォルト: false） |
| `days_until_due` | number | | 期限がN日以内のタスクに絞り込み |

### add_task パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `user_id` | string | ✅ | ユーザーID |
| `title` | string | ✅ | タスクタイトル |
| `due_date` | string | | 期限（YYYY-MM-DD） |

### complete_task パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `user_id` | string | ✅ | ユーザーID |
| `task_id` | string | ✅ | タスクID |

### update_task パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `user_id` | string | ✅ | ユーザーID |
| `task_id` | string | ✅ | タスクID |
| `title` | string | | 新しいタイトル |
| `due_date` | string | | 新しい期限（YYYY-MM-DD、空文字で削除） |

---

## calendar-tool

Googleカレンダーの予定の閲覧・作成・変更・削除・空き時間確認・スケジュール提案を行う。

| ツール名 | 説明 |
|---------|------|
| `list_events` | 指定日・期間の予定一覧を取得 |
| `check_availability` | 空き状況を確認（日単位・時間帯・期間） |
| `create_event` | 新しい予定を作成 |
| `update_event` | 既存の予定を更新 |
| `delete_event` | 予定を削除 |
| `suggest_schedule` | 空き時間を分析して候補日時を提案 |

**Lambda**: `tonari-calendar-tool`
**データソース**: Google Calendar API v3（OAuth2認証、SSM Parameter Store経由）

### list_events パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `date` | string | | 日付（YYYY-MM-DD、単日指定） |
| `date_from` | string | | 開始日（YYYY-MM-DD、範囲指定） |
| `date_to` | string | | 終了日（YYYY-MM-DD、範囲指定） |

省略時は今日の予定を取得する。

### check_availability パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `check_type` | string | ✅ | 確認モード: `day`, `time_slot`, `range` |
| `date` | string | | 日付（`day`/`time_slot`モード用） |
| `date_from` | string | | 開始日（`range`モード用） |
| `date_to` | string | | 終了日（`range`モード用） |
| `time_from` | string | | 開始時刻 HH:MM（`time_slot`モード用、デフォルト: 09:00） |
| `time_to` | string | | 終了時刻 HH:MM（`time_slot`モード用、デフォルト: 18:00） |

### create_event パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `title` | string | ✅ | イベントタイトル |
| `start` | string | ✅ | 開始日時（YYYY-MM-DD で終日、ISO 8601 で時間指定） |
| `end` | string | | 終了日時（省略時: 時間指定なら1時間後、終日なら当日） |
| `location` | string | | 場所 |
| `description` | string | | 説明 |

### update_event パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `event_id` | string | ✅ | イベントID |
| `title` | string | | 新しいタイトル |
| `start` | string | | 新しい開始日時 |
| `end` | string | | 新しい終了日時 |
| `location` | string | | 新しい場所 |
| `description` | string | | 新しい説明 |

### delete_event パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `event_id` | string | ✅ | 削除対象のイベントID |

### suggest_schedule パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `date_from` | string | ✅ | 検索開始日（YYYY-MM-DD） |
| `date_to` | string | ✅ | 検索終了日（YYYY-MM-DD） |
| `duration_minutes` | number | ✅ | 所要時間（分） |
| `preferred_time_from` | string | | 希望開始時刻 HH:MM（デフォルト: 09:00） |
| `preferred_time_to` | string | | 希望終了時刻 HH:MM（デフォルト: 18:00） |

最大5件の候補を返す。

---

## date-tool

日付の計算・変換を正確に行うユーティリティ。LLMが苦手な日付演算を確実に処理する。

| ツール名 | 説明 |
|---------|------|
| `get_current_datetime` | 現在の日付・時刻・曜日・週番号（JST）を取得 |
| `calculate_date` | 基準日から日数・週数・月数を加減算 |
| `list_dates_in_range` | 指定期間内の特定曜日を一覧取得 |

**Lambda**: `tonari-date-tool`
**データソース**: なし（純粋な計算処理）

### get_current_datetime パラメータ

パラメータなし。

### calculate_date パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `base_date` | string | | 基準日（YYYY-MM-DD、省略時は今日） |
| `offset_days` | number | | 加算する日数（負の値で減算） |
| `offset_weeks` | number | | 加算する週数（負の値で減算） |
| `offset_months` | number | | 加算する月数（負の値で減算） |

`offset_days`、`offset_weeks`、`offset_months` は組み合わせ可能。

### list_dates_in_range パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `start_date` | string | ✅ | 開始日（YYYY-MM-DD） |
| `end_date` | string | ✅ | 終了日（YYYY-MM-DD） |
| `weekday` | string | ✅ | 曜日名（月〜日、または Monday〜Sunday） |

範囲は最大1年以内。

---

## twitter-read

オーナーの当日のツイートを取得する。

| ツール名 | 説明 |
|---------|------|
| `get_todays_tweets` | 当日投稿されたツイートを取得 |

**Lambda**: `tonari-twitter-read`
**データソース**: Twitter API v2（Bearer Token、SSM Parameter Store経由）

### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `owner_user_id` | string | ✅ | TwitterユーザーID |
| `max_count` | number | | 最大取得件数（デフォルト: 3） |

---

## twitter-write

Tonariアカウントからツイートを投稿する。

| ツール名 | 説明 |
|---------|------|
| `post_tweet` | ツイートを投稿 |

**Lambda**: `tonari-twitter-write`
**データソース**: Twitter API v2（OAuth 1.0a、SSM Parameter Store経由）

### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `text` | string | ✅ | ツイート本文（最大280文字） |

---

## TavilySearch

Web検索で最新情報を取得する。

| ツール名 | 説明 |
|---------|------|
| `TavilySearchPost` | Webを検索して関連情報を取得 |

**設定**: AWSコンソールからGateway Targetとして手動登録（API Key Credential Provider使用）

### パラメータ

Tavily Search APIの標準パラメータに準拠。
