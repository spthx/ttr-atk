# タタルの大繁盛商店 Unity / WebGL 移植仕様書

## 1. 目的と非目的

本書は、現行Web版のゲーム性を保ったまま、将来オリジナルの画像・名称・文章へ交換し、UnityおよびUnity WebGLへ段階移植するための実装契約を定める。

移植対象は、企業買収バトル、進行、難易度、保存、演出順序、コンテンツデータである。ReactのDOM構造やCSSをそのままUnityへ複製することは目的ではない。

コインは物理オブジェクトではない。Unity移植後も次を禁止する。

- Rigidbody、Collider、重力、衝突、安定判定
- 金額に比例するGameObject生成
- コイン山の崩落シミュレーション
- 見た目のためだけの常時Update
- WebGLでの不要な3Dレンダリング

## 2. 現行コードの責務境界

|責務|現行の正本|Unity側の想定|
|---|---|---|
|世界・物件・スキル|`src/data/initialData.ts`、`src/data/worldData.ts`|JSON DTOまたはScriptableObject|
|敵支援・零式・絶・酷の戦闘定義|`src/data/battleEncounterData.ts`|`BattleContentCatalog`|
|零式12章、絶、酷の定義|`src/utils/savage.ts`|`RaidCatalog`|
|純粋な数値計算|`src/utils/gameBalance.ts`、`src/utils/enemyAi.ts`、`src/utils/cruelBattle.ts`|C#ドメイン層|
|保存と互換処理|`src/utils/saveData.ts`、`src/utils/battleSession.ts`|バージョン付きSave DTO|
|画面状態と演出オーケストレーション|`src/components/BattleModal.tsx`|BattlePresenter / Timeline Runner|
|Web固有描画|`src/battle-capital-layer.css`|Canvas UI / Sprite Renderer|
|効果音|`src/utils/audio.ts`、`public/ff14-fankit/audio/`|AudioMixer + AudioClip Catalog|

`BATTLE_CONTENT_MANIFEST` はブラウザAPIや関数を含まないJSON境界であり、Unity向けエクスポートの起点とする。`schemaVersion` を必ず保持する。

## 3. Unity向けデータモデル

### 3.1 共通規則

- すべての永続IDは英数字とアンダースコアで固定し、表示名から生成しない。
- 表示名、説明、台詞、演出名はIDと分離する。
- ミリ秒は整数、倍率は小数、所有率は0～100で統一する。
- 金額は整数。将来の上限を見込み、C#では`long`を使う。
- 未知フィールドは無視し、未知の必須IDはインポートエラーにする。
- `schemaVersion`変更時はマイグレーターを1段ずつ適用する。

### 3.2 BattleContentCatalog

最低限、次を保持する。

```text
schemaVersion
enemySupportActions[]
enemySupportBalance
savageSupportProfiles[3][4]
savageAutoProfiles[3]
ultimateAutoPatterns[]
cruelScriptedBattle
```

敵アクションの基本DTOは次の通り。

```text
id
jobNameTextId
actionNameTextId
telegraphTextId
artKey
telegraphMs
castMs
impactMs
afterglowMs
leavingMs
interruptibility: interruptible | delay_only | unstoppable
effectType
effectParams
```

現行TSでは文字列を直接保持するが、オリジナル化時には`*TextId`へ移行し、ローカライズ表から解決する。

### 3.3 表示専用アクション

敵味方へ作用せず、名称と台詞だけを順番に見せるアクションを正式に扱う。

```text
effectType: presentation_only
effectParams: {}
speakerId
quoteTextId
```

`presentation_only` は資金、所有率、ゲージ速度、待ち時間、LB、乱数を変更してはならない。演出終了イベントだけを返す。

## 4. バトルランタイム

### 4.1 固定更新

現行の純粋計算をC#へ移植し、描画フレームとゲーム判断を分離する。

- ゲージ・クールダウン・継続効果: 固定刻み
- 敵AI判断: 定義された1.2～2.0秒間隔
- UI補間: `unscaledDeltaTime`で見た目だけ更新可能
- 演出停止中: ゲーム時計と入力可否を明示的に分離
- 一時停止・決着後: AI、資金回復、勝敗判定を停止

毎フレームAIを判断しない。決着処理は一度だけ発火する状態遷移とし、勝利効果音、報酬、保存、画面遷移をそれぞれ冪等にする。

### 4.2 演出シーケンス

すべての主要行動は次の順序を持つ。

```text
Name / Telegraph
Cast / Prepare
Impact / Hit stop
Afterglow
Leave / Complete
```

各段階は同じウインドウを維持し、不要な閉じ直しを行わない。カウントダウン中に操作可能な技は、`pausesBattle=false`をデータで指定する。

### 4.3 酷の二段階ギミック

- アクティブ時間約15秒で第一宣告。
- 所有率を最大10%へ落とすが、投入済み資本・残資金・LBを消さない。
- 回復区間の敵圧力倍率は0.58。
- 所有率50%到達、または回復35秒で第二宣告。
- 12秒のカウント中も投入とアビリティを許可。
- 75%以上なら成功。それ未満は査定失敗を確定し、カードの余韻完走後に一度だけ敗北へ遷移する。
- 第一・第二宣告は`unstoppable`。敵LB3は`delay_only`でスタンによる2.4秒延期のみ。

この仕様は特定のアビリティ装備を必須にしない。

## 5. コイン描画

### 5.1 論理モデル

ゲームロジックが持つのは投入総額、残資金、所有率、ゲージ速度、着金待ちだけである。表示は独立した投影とする。

現行の表示上限:

- 左右22本の固定列
- 1列最大36層
- 最大792表示単位/陣営をDOM増減なしで表現
- 投入1回の一時落下コイン最大16枚
- 表示閾値60段階

Unityでは22本の列をあらかじめ生成し、各列の表示層またはスプライト状態だけを更新する。一時コインは16個の固定プールを使う。

### 5.2 見た目の要件

- 少額でも列の足並みをそろえ、斜め一列にしない。
- 内側・外側を不規則に往復せず、短い機械的な積み上げビートで埋める。
- 拡縮で金額を誤魔化さない。
- 小さめのコインが密集し、中間段階を細かく刻む。
- 金額上限以降は列高を無限に伸ばさず、上段・オーバーフロー・光で示す。
- 数値はFF4～6風のフレームなしフローティング表示で、コイン中央より少し下へ出す。
- タブレット横持ちは列の配置幅を広げ、スマホ縦持ちの密度は維持する。

## 6. 音声と画像

`src/data/fankitAssets.ts`を論理アセットキーの正本とし、Unity側ではAddressablesのキーへ対応させる。ゲームロジックからファイル名を直接参照しない。

音声は遅延ロードし、デコード済みAudioClipを再利用する。シネマティック音は同時多重再生を避ける。現行ファンキット素材は将来のオリジナル化時に同一キーのまま差し替えられるようにする。

## 7. 保存互換

現行の正本は`SAVE_SCHEMA_VERSION = 3`。Unity版では次を分離する。

```text
SaveEnvelope
  schemaVersion
  contentVersion
  savedAtUtc
  playerState
  progressionState
  loadoutState
  battleRecoveryState?
```

廃止した木人モードの進行入口は再公開しない。旧Webセーブに木人戦セッションが残る場合は破棄して通常画面へ戻す。旧IDはマイグレーション用の読み取りにだけ残す。

## 8. 移植手順

1. 現行TSの純粋関数にゴールデンテストを固定する。
2. `BATTLE_CONTENT_MANIFEST`をJSONへエクスポートする。
3. C# DTOとJSON Schemaを作り、往復テストを行う。
4. `gameBalance`、`enemyAi`、`cruelBattle`を副作用なしで移植する。
5. 同一シード・同一入力列でWeb/C#結果を比較する。
6. Canvas UIで最小バトルを作る。
7. 22列＋16一時コインのプール描画を追加する。
8. 演出シーケンサー、音声、保存、進行を順に接続する。
9. PC、iOS相当、Android相当でProfiler比較を行う。
10. 画像・文章を論理キーのままオリジナル素材へ差し替える。

## 9. 合格条件

- 同一シードで勝敗、所要時間、行動数、最終所有率が許容差内。
- 通常、都市ボス、零式12章、絶、酷を通しで到達できる。
- 1戦2分未満、30出資未満を難易度テストで維持する。
- コインGameObject数が投入額で増えない。
- 決着、報酬、保存、効果音が二重発火しない。
- WebGLで横スクロール、メモリ増加、長時間後の入力停止がない。
- 既存セーブを読み、未知データは安全に既定値へ正規化する。
