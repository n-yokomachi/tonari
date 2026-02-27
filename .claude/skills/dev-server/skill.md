---
name: dev-server
description: ローカルサーバーを起動する。開発サーバー、サーバー立てる、dev起動する場合に使用。
allowed-tools: Bash
---

# ローカル開発サーバー起動スキル

Port 3000 / 3001 を使用中のプロセスをキルしてから、Port 3000 で Next.js 開発サーバーを起動します。

## 実行手順

1. **既存プロセスのキル**

   Port 3000 と 3001 で起動中のプロセスを停止する。

   ```bash
   lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true
   ```

2. **開発サーバーの起動**

   バックグラウンドで Port 3000 で起動する。

   ```bash
   npm run dev
   ```

   `run_in_background: true` で実行し、起動完了を確認する。

3. **起動確認**

   出力に `Ready` が含まれていることを確認し、URL をユーザーに伝える。
