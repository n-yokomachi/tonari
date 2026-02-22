# Phase 3: 3Dアバター設定（VRM）

## 目的

Scenseiの香水ソムリエとしてのキャラクター性を表現するVRM 3Dアバターを設定し、表情・動きによってユーザーとのインタラクションを向上させる。

## 完了条件

- [x] VRMモデルの選定・入手（AITuber-kitデフォルト`nikechan_v2.vrm`を使用）
- [x] モデルファイルを`public/vrm/`に配置（既存モデル6つあり）
- [x] モデル読み込み設定の更新（`.env`にVRM設定追加済み）
- [x] 表情（BlendShape）がAIの感情タグと連動している（`expressionController.ts`で実装済み）
- [x] アイドルアニメーション（待機時の動き）が動作している（`autoBlink.ts`, `idle_loop.vrma`で実装済み）

## VRMとは

VRM（Virtual Reality Model）は、VRアバター向けの3Dモデルファイルフォーマット。

- **ベース**: glTF 2.0
- **開発**: VRMコンソーシアム（pixiv主導）
- **特徴**: 人型アバターに特化、表情・視線・物理演算を標準サポート
- **ライセンス**: オープンフォーマット

## 現状の構成

AITuber-kitはVRMとLive2Dの両方をサポートしている。

```
public/vrm/
└── (デフォルトVRMモデルがあれば配置)
```

## 実装タスク

### 1. VRMモデルの選定

#### 選択肢

1. **VRoid Hubから無料モデルを入手**
   - [VRoid Hub](https://hub.vroid.com/)で「利用可能」フィルタ
   - 商用利用可能か確認

2. **VRoid Studioで自作**
   - [VRoid Studio](https://vroid.com/studio)（無料ツール）
   - カスタマイズ自由、著作権クリア

3. **Boothで購入/入手**
   - [Booth](https://booth.pm/)で「VRM」検索
   - 有料・無料モデル多数

4. **AITuber-kitデフォルトモデル使用**
   - 追加作業不要

#### 推奨

MVP段階では**VRoid Hubの無料モデル**または**AITuber-kitデフォルト**を使用。

### 2. モデルファイル配置

```
public/
└── vrm/
    └── scensei.vrm
```

### 3. モデル読み込み設定

環境変数でモデルパスを設定:

```env
# .env
NEXT_PUBLIC_AVATAR_TYPE=vrm
NEXT_PUBLIC_AVATAR_VRM_PATH=/vrm/scensei.vrm
```

### 4. 表情（BlendShape）の確認・調整

VRMは標準的な表情プリセットを持つ:

| プリセット名 | 説明 |
|-------------|------|
| neutral | 通常 |
| joy / happy | 喜び |
| angry | 怒り |
| sorrow / sad | 悲しみ |
| fun | 楽しい |
| surprised | 驚き |
| relaxed | リラックス |

#### AIの感情タグとのマッピング

| 感情タグ | VRM BlendShape |
|---------|---------------|
| [neutral] | neutral |
| [happy] | joy / happy |
| [sad] | sorrow / sad |
| [angry] | angry |
| [relaxed] | relaxed |
| [surprised] | surprised |

### 5. アイドルアニメーション設定

待機中の自然な動き:

- **自動まばたき**: VRM標準機能
- **呼吸**: 体の微細な動き
- **視線移動**: ユーザー追従または自然な動き
- **髪・衣装揺れ**: VRM物理演算（SpringBone）

## 技術的な詳細

### VRMファイル構造

VRMは単一の`.vrm`ファイルにすべてが含まれる:

- メッシュデータ
- テクスチャ
- ボーン構造
- BlendShape（表情）
- 物理演算設定（SpringBone）
- メタ情報（ライセンス等）

### AITuber-kitのVRM対応

AITuber-kitは`@pixiv/three-vrm`を使用してVRMをレンダリング:

```typescript
// three-vrmによるVRM読み込み
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
```

### VRMメタ情報の確認

VRMファイルには利用条件がメタデータとして埋め込まれている:

- `allowedUserName`: 利用可能なユーザー
- `violentUssageName`: 暴力表現での利用
- `sexualUssageName`: 性的表現での利用
- `commercialUssageName`: 商用利用
- `licenseName`: ライセンス種別

## テスト項目

- [ ] VRMモデルが正しく表示される
- [ ] まばたきが自然に動作する
- [ ] 感情タグ[happy]で笑顔になる
- [ ] 感情タグ[sad]で悲しい表情になる
- [ ] 髪・衣装の物理演算が動作する
- [ ] ウィンドウリサイズ時にモデルが崩れない
- [ ] モバイル端末でも表示される

## 備考

### VRMモデル選定のポイント

- **ファイルサイズ**: 10MB以下推奨（Web読み込み速度）
- **ポリゴン数**: 3万ポリゴン以下推奨
- **BlendShape**: 基本表情が設定されているか
- **ライセンス**: 商用利用可能か

### 参考リンク

- [VRM公式](https://vrm.dev/)
- [VRoid Hub](https://hub.vroid.com/)
- [VRoid Studio](https://vroid.com/studio)
- [three-vrm (pixiv)](https://github.com/pixiv/three-vrm)
- [AITuber-kit VRM設定](https://docs.aituberkit.com/)
