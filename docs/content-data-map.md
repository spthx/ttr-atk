# コンテンツ・テキスト・アセット配置表

## 1. 正本一覧

|種類|正本|備考|
|---|---|---|
|共通型|`src/types.ts`|Property、Skill、Synergy、BattleResult等|
|初期物件・スキル・シナジー|`src/data/initialData.ts`|IDを保存互換キーとして扱う|
|都市・時代順|`src/data/worldData.ts`|通常進行の順序|
|企業連合・候補|`src/data/allianceData.ts`|世界観上の一般名は一括改名しない|
|敵支援と高難度戦闘データ|`src/data/battleEncounterData.ts`|Unity/editor用JSON境界あり。絶6パターンは開幕／瀕死行動と具体的な対処手順を同じ正本で持つ|
|ファンキット論理キー|`src/data/fankitAssets.ts`|UIから実ファイル名を隠す|
|ヘルプ|`src/data/helpText.ts`|操作説明、用語|
|零式12章・絶・酷商戦|`src/utils/savage.ts`|3シリーズ×4層、`酷商戦`／`酷-もう1人のわたし`|
|業商戦の帳簿・ものまね|`src/utils/karmaBattle.ts`|`業商戦：値札のない一株`の四頁、修正、逆順の写し、無銘口座|
|幻・商戦の抽選・連勝正規化|`src/utils/phantomBattle.ts`|零式全12層から抽選。永続戦績は現在連勝数のみ|
|戦闘数値|`src/utils/gameBalance.ts`|純粋関数を維持|
|敵AI|`src/utils/enemyAi.ts`|毎フレーム判断しない|
|酷の段階処理|`src/utils/cruelBattle.ts`|第一・第二宣告|
|進行シナジー|`src/utils/synergy.ts`|自動置換優先度|
|勝利後精算・離反|`src/utils/battleSettlement.ts`|利益独占0%／五分の祝儀50%／大盤振る舞い100%（離反防止・危険度30回復）|
|セーブ|`src/utils/saveData.ts`|schemaVersion 3。幻・商戦は現在連勝数のみ保存|
|中断復帰|`src/utils/battleSession.ts`|決着前のセッション。幻・商戦のブリーフィング取消では抽選相手と連勝数を維持|
|音声再生|`src/utils/audio.ts`|単一AudioContext、遅延デコード|
|商戦UIと演出順|`src/components/BattleModal.tsx`|データではなく実行器へ縮小していく|
|商戦フィールド描画|`src/components/BattleCapitalCanvas.tsx`、`src/components/BattleCapitalCanvas.css`、`src/utils/battleCanvasQuality.ts`、`src/battle-capital-layer.css`|両陣営共通1枚のCanvas2D。背景・所有率前線・圧力・22列×2・overflow・packet・風・VSを同一sceneへ投影。30fpsはDPR 1.5、60fpsはDPR 2を内部解像度の上限とする|

関連する設計基準:

- [難易度進行・敗北学習設計](./difficulty-progression-design.md)
- [商戦フィールド描画 WebGL2 フォールバック実装手引き](./coin-webgl2-fallback-guide.md)
- [Unity / WebGL 移植仕様書](./unity-webgl-migration-spec.md)

## 2. テキストの所在

現状は完全なローカライズ表へ集約されていない。オリジナル化時の探索順は次の通り。

1. `src/data/initialData.ts`: 物件、スキル、シナジーの名前と説明
2. `src/data/battleEncounterData.ts`: 敵ジョブ、行動名、予兆文
3. `src/utils/savage.ts`: 零式、絶、酷商戦の名称と説明
4. `src/utils/karmaBattle.ts`: 業商戦の名称、四頁帳簿、ものまねの系統と無銘口座
5. `src/utils/phantomBattle.ts`: 幻・商戦の名称、説明、全12層からの抽選
6. `src/data/helpText.ts`: ヘルプ本文
7. `src/components/BattleModal.tsx`: 戦況、タタル分析、演出中の動作文
8. `src/App.tsx`と各View: 画面見出し、解放説明、ボタン

将来の移行先:

```text
content/text/ja.json
content/text/en.json
```

キー例:

```text
property.gridania_fruit.name
skill.fast_action.name
synergy.light_of_hope.description
enemy_action.cure.telegraph
battle.result.tataru.loss.insufficient_capital
ui.battle.commit
```

セーブには表示文字列を保存せず、IDだけを保存する。

## 3. 画像

### 3.1 現行正式アセット

`public/ff14-fankit/`配下をファンキット素材として扱う。

- `minion-wind-up-tataru.png`: 通常タタル
- `minion-dress-up-tataru.png`: 差分タタル
- `job-*.png`: ジョブ・支援キャラクター
- `job-paladin.png`: かばう・パッセのナイト
- `job-darkknight.png`: リビングデッド系
- `app-icons/`: ホーム画面用タタルアイコン
- `*.webp`: 背景用ファンキット画像

参照は`src/data/fankitAssets.ts`へ集約する。コンポーネントへ新しい直書きパスを増やさない。

### 3.2 コイン画像

コインは`BattleCapitalCanvas`のCanvas2Dへ決定論的に描き、左右22列を固定sceneとして扱う。投入額に比例してDOM nodeや描画資源を無制限に生成しない。将来texture atlasへ差し替える際は、同じ論理キーで次を用意する。

```text
coin_player_unit
coin_enemy_unit
coin_player_medallion
coin_enemy_medallion
coin_player_overflow
coin_enemy_overflow
```

画像側に大量のコインを描き込んだ段階スプライトを採用する場合も、ゲーム内の列数・一時コイン上限は変更しない。

## 4. 音声

現行ファンキット音声:

- `FFXIV_Enter_Instance.mp3`: 商戦開始
- `FFXIV_Feature_Unlocked.mp3`: 解放
- `FFXIV_Limit_Break_Activated.mp3`: LB
- `FFXIV_FATE01_Complete.mp3`: 勝利
- `FFXIV_Instance_Failed.mp3`: 敗北

`src/utils/audio.ts`は必要時だけ取得・デコードし、AudioBufferをキャッシュする。シネマティック用ソースは前の音を停止またはフェードしてから再生する。ファイル取得失敗時のみ軽い合成音へフォールバックする。

将来のオリジナル化ではファイルだけを交換し、呼出側の`playDutyStart`、`playLimitBreak`等は維持する。

## 5. データ依存関係

```text
types.ts
  ├─ data/*.ts
  ├─ utils/gameBalance.ts
  └─ utils/saveData.ts

data/battleEncounterData.ts
  ├─ utils/gameBalance.ts
  ├─ utils/cruelBattle.ts
  ├─ utils/karmaBattle.ts
  ├─ components/BattleModal.tsx
  └─ scripts/check-*.ts

utilsの純粋計算
  └─ components / views
```

禁止する依存:

- `data`からReactコンポーネントを参照
- 純粋計算からDOM、AudioContext、localStorageを参照
- セーブから表示名や画像パスを正本として参照
- CSSや画像の寸法を難易度計算に利用

## 6. 廃止・互換対象

木人戦は公開導線から削除済み。`training`の型、復帰処理、一部純粋関数は、旧セーブを安全に読み捨てるための互換コードとして残る。新規コンテンツ、公開タブ、解放導線から木人を参照してはならない。

互換コードを完全削除する条件:

1. 保存スキーマを更新する。
2. 旧木人セッションを破棄するマイグレーションを1版以上公開する。
3. 公開セーブの復帰率を確認する。
4. 参照テストを新スキーマへ置換する。

## 7. 検証コマンド

```text
npm run lint
npm run check:balance
npm run check:progression
npm run check:readiness
npm run check:simulations
npm run check:visuals
npm run build
```

`check:simulations`は500戦を基準とする。`check:balance`は`BATTLE_CONTENT_MANIFEST`のJSON往復を確認する。ビルド後、`dist`、`build`、`public/game`等の生成物が意図せずGit差分へ残っていないことを確認する。

## 8. 変更時チェックリスト

- 既存IDを表示名変更のために改名していない。
- シナジーの自動置換順を壊していない。
- 開幕・窮地オートと通常枠が重複していない。
- 敵アクションの割込区分が定義されている。
- 無敵後の有限防御とナイト退場が検証されている。
- コイン列と一時packet表示数の上限が固定されている。
- 1戦2分、30出資の上限をシミュレーションで確認した。
- リザルトの黒字・赤字、タタル分析、ご祝儀、戦闘記録の順が保たれている。
- セーブと中断復帰が二重精算を起こさない。
- 業商戦と幻・商戦は酷商戦踏破後に並行して解放される。業商戦は開幕50%から55%・70%・85%・95%へ進めた四頁を一頁だけ修正し、第四頁から第一頁へのものまねを6秒の予告中に対処する。指定二系統は完全取消、ほかの別系統は50%、同系統・無行動は100%着弾。競合予算の24%は開始時に無銘口座へ隔離され、途中の隠し増資には使わない。
- 業商戦は参加費・攻略報酬・精算がすべて0の記録専用戦で、勝利時は`karmaCleared`だけを保存する。通常経済、人脈、持越しLB、幻・商戦の連勝数は勝敗・撤退を問わず保護する。
- 幻・商戦は抽選層の零式ギミックと絶相当の基礎力だけを組み合わせている。
- 幻・商戦の敗北・戦闘中撤退は現在連勝数を0へ戻し、ブリーフィング取消は連勝数と抽選相手を維持する。
- 幻・商戦の結果が通常資金、所有権、人脈、独立危険度、持越しLB、通常進行へ反映されない。
- 画像、音、文章が論理キーで交換可能になっている。
