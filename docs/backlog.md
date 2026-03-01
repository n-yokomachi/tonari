# Backlog

## Gmail Lambda

- [ ] search_emails の N+1 クエリパターン: messages.list → 各 message.get をループ呼び出ししている。Gmail Batch API で一括取得に変更する
- [ ] create_draft のヘッダーインジェクション防御: to/subject に改行文字が含まれる場合のバリデーション追加
- [ ] requirements.txt のバージョンピニング: google-api-python-client 等の依存パッケージのバージョンを固定する

## フロントエンド

- [ ] BriefingButton コンポーネントの重複: menu.tsx と mobileHeader.tsx に同一コンポーネントが存在する。共通化する
- [ ] BriefingButton の chatProcessing 二重管理: homeStore.chatProcessing と独自 isProcessing state の整理
