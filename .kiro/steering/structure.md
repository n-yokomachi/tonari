# Project Structure

## Organization Philosophy

**Feature-based + Layer-based hybrid**: UIコンポーネントは`components/`、ビジネスロジックは`features/`に配置。Next.js Pages Routerの規約に従い、APIは`pages/api/`に配置。

## Directory Patterns

### Frontend Source (`/src/`)

**Components** (`/src/components/`)
- UIコンポーネント（表示責務のみ）
- ファイル名: camelCase (`assistantText.tsx`)
- サブディレクトリで機能グループ化 (`settings/`, `modelProvider/`)

**Features** (`/src/features/`)
- ビジネスロジックとドメイン固有の処理
- 機能単位でディレクトリ分割 (`chat/`, `vrmViewer/`, `lipSync/`)
- Zustandストアは `features/stores/` に配置
- 定数・設定値は `features/constants/` に配置（例: `VRM_MODELS`, `DEFAULT_VRM`）

**Pages** (`/src/pages/`)
- Next.js Pages Router規約に従う
- APIエンドポイントは `pages/api/` に配置
- 管理画面は `pages/admin/` に配置

**Lib** (`/src/lib/`)
- 汎用ユーティリティライブラリ
- VRM関連の低レベル実装 (`VRMAnimation/`, `VRMLookAtSmootherLoaderPlugin/`)

### Backend Source (`/agentcore/`)

```
agentcore/
├── app.py              # AgentCore Runtime エントリポイント
├── src/agent/          # エージェント実装
│   ├── scensei_agent.py
│   └── prompts.py
└── pyproject.toml      # Python依存関係
```

### Infrastructure (`/infra/`)

```
infra/
├── lib/scensei-stack.ts  # CDKスタック定義
├── lambda/               # Lambda関数コード
└── bin/infra.ts          # CDKアプリエントリ
```

### Configuration (`/config/`)

| File | Purpose |
|------|---------|
| `app.json` | フロントエンド設定（シークレット以外、背景・キャラクター・AI設定等） |
| `agentcore.json` | AgentCore Runtime設定 |
| `infra.json` | CDKインフラ設定 |

## Naming Conventions

- **React Components**: PascalCase (`MessageInput.tsx`)
- **Utility Files**: camelCase (`buildUrl.ts`)
- **API Routes**: kebab-case (`save-chat-log.ts`)
- **Python**: snake_case (`scensei_agent.py`)

## Import Organization

```typescript
// 1. External packages
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// 2. Absolute imports (features, components)
import { settingsStore } from '@/features/stores/settings'

// 3. Relative imports
import { FormProps } from './types'
```

**Path Aliases**:
- `@/` → `src/`

## Code Organization Principles

### コンポーネント設計
- UIコンポーネントはビジネスロジックを持たない
- 状態管理はZustandストア経由
- プロップスドリリングよりストア参照を優先

### API設計
- Next.js API Routesは軽量なプロキシ層
- 重い処理はAgentCore Runtimeに委譲
- 認証はミドルウェア(`middleware.ts`)で一元管理

### 環境変数
- シークレットは`.env`で管理（`.gitignore`済み）
- 非シークレット設定は`config/`配下のJSONで管理
- 型定義は`features/constants/`で管理

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
