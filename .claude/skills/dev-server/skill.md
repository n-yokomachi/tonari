---
name: dev-server
description: ローカルサーバーを起動する。開発サーバー、サーバー立てる、dev起動する場合に使用。
allowed-tools: Bash
---

# ローカル開発サーバー起動スキル

Port 3000 / 3001 を使用中のプロセスを確実にキルしてから、Port 3000 で Next.js 開発サーバーを起動する。

## 実行手順

### 1. 既存プロセスのキル

Port 3000 と 3001 で起動中のプロセスをすべて停止し、ポートが解放されるまで待つ。

#### macOS / Linux の場合

```bash
for port in 3000 3001; do
  pids=$(lsof -ti :$port 2>/dev/null)
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
done
sleep 1
```

#### Windows の場合

```bash
for port in 3000 3001; do
  pid=$(netstat -ano 2>/dev/null | grep ":${port}.*LISTENING" | awk '{print $5}' | head -1)
  [ -n "$pid" ] && taskkill //F //PID "$pid" 2>/dev/null || true
done
sleep 1
```

### 2. 開発サーバーの起動

バックグラウンドで Port 3000 で起動する。

```bash
npm run dev
```

`run_in_background: true` で実行し、起動完了を確認する。

### 3. 起動確認

出力に `Ready` が含まれていることを確認し、URL をユーザーに伝える。
Port 3000 で起動していること（3001 にフォールバックしていないこと）を確認する。
