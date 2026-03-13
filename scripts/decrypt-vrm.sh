#!/bin/bash
# Vercel ビルド時に git-crypt で暗号化された VRM ファイルを復号する
# 環境変数 GIT_CRYPT_KEY に base64 エンコードされたキーが必要

set -e

if [ -z "$GIT_CRYPT_KEY" ]; then
  echo "GIT_CRYPT_KEY not set, skipping VRM decryption"
  exit 0
fi

# git-crypt のインストール（Linux/Vercel 環境用）
if ! command -v git-crypt &> /dev/null; then
  echo "Installing git-crypt..."
  curl -sL https://github.com/oholovko/git-crypt-windows/releases/download/1.0.35/git-crypt.exe -o /tmp/git-crypt 2>/dev/null || true

  # Linux 用バイナリを取得（Vercel は Linux 環境）
  apt-get update -qq && apt-get install -y -qq git-crypt 2>/dev/null || {
    echo "apt-get failed, trying static binary..."
    curl -sL "https://github.com/AGWA/git-crypt/releases/download/0.7.0/git-crypt-0.7.0-linux-x86_64" -o /tmp/git-crypt
    chmod +x /tmp/git-crypt
    export PATH="/tmp:$PATH"
  }
fi

# キーを復元して unlock
echo "$GIT_CRYPT_KEY" | base64 -d > /tmp/git-crypt-key
git-crypt unlock /tmp/git-crypt-key
rm -f /tmp/git-crypt-key

echo "VRM files decrypted successfully"
