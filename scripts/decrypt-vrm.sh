#!/bin/bash
# Vercel ビルド時に git-crypt で暗号化された VRM ファイルを復号する
# 環境変数 GIT_CRYPT_KEY に base64 エンコードされたキーが必要

set -e

if [ -z "$GIT_CRYPT_KEY" ]; then
  echo "GIT_CRYPT_KEY not set, skipping VRM decryption"
  exit 0
fi

# git-crypt のインストール（Vercel = Amazon Linux 2023 環境用）
if ! command -v git-crypt &> /dev/null; then
  echo "Installing git-crypt..."

  # OpenSSL 1.1 互換ライブラリのインストール（git-crypt が必要とする）
  if command -v dnf &> /dev/null; then
    dnf install -y compat-openssl11 2>/dev/null || true
  elif command -v yum &> /dev/null; then
    yum install -y compat-openssl11 2>/dev/null || true
  fi

  # git-crypt バイナリを取得
  curl -sL "https://github.com/AGWA/git-crypt/releases/download/0.7.0/git-crypt-0.7.0-linux-x86_64" -o /tmp/git-crypt
  chmod +x /tmp/git-crypt

  # libcrypto.so.1.1 の場所を LD_LIBRARY_PATH に追加
  OPENSSL11_LIB=$(find /usr/lib64 /usr/lib /lib64 /lib -name "libcrypto.so.1.1" 2>/dev/null | head -1)
  if [ -n "$OPENSSL11_LIB" ]; then
    export LD_LIBRARY_PATH="$(dirname "$OPENSSL11_LIB"):${LD_LIBRARY_PATH:-}"
    echo "Found OpenSSL 1.1 at: $OPENSSL11_LIB"
  else
    echo "Warning: libcrypto.so.1.1 not found, git-crypt may fail"
  fi

  export PATH="/tmp:$PATH"
fi

# キーを復元して unlock
echo "$GIT_CRYPT_KEY" | base64 -d > /tmp/git-crypt-key
git-crypt unlock /tmp/git-crypt-key
rm -f /tmp/git-crypt-key

echo "VRM files decrypted successfully"
