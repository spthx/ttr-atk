# ChatGPT向けアップデート引き継ぎ

## 現在版

「タタルの大繁盛店」買収戦アップデート Ver.3です。
正本の要件は`タタルの大繁盛店_買収戦アップデート指示書_Ver3.1.md`、全ルールとコード案内は`README.md`です。

公開先は非公開Sitesです。

<(削除済み)>

## ユーザーが目指しているもの

- ロマンシング サ・ガ3のトレードを核にした、ギルによるリアルタイム買収戦
- FF14らしいコンテンツ突入演出、都市、企業、かけひき、LIMIT BREAK
- 数字を眺めるだけでなく、風・敵予算・投入タイミングを読む駆け引き
- iPhone Safariでも一画面で資金の押し合いを把握できるUI
- SHORT、FINAL PUSH、勝因・敗因が盤面から理解できる決着

## Ver.3で行ったこと

### SHORTと勝敗

- SHORTは大型ダイアログを廃止
- 盤面を残したまま`DEFENSE CAPITAL / SHORT / 敵追加防衛資金 0%`を表示
- 約1.2秒だけ完全停止し、ボタン待ちせず直前の時間倍率で自動再開
- WIN/LOSEも大型結果カードではなく戦闘テロップ化
- テロップ後は最終盤面で停止
- 画面下の`NEXT →`を押した後にタタルの勝因・敗因分析へ進む

### TACTICAL MODE

- 自社資金: 1.0倍
- 資金源・かけひき: 0.1倍
- ブリーフィング、SHORT、LB、勝敗後、ヘルプ、ログ、リザルト: 0倍
- 所有率、敵AI、COMMAND、クールダウン、継続効果、風へ同じ倍率を適用

### セーブと収益

- `src/utils/saveData.ts`を追加
- `localStorage`、スキーマバージョン3
- 保存: カンパニー名、所持金、物件所有状態・独立危険度、装備スキル、ALLIANCE、保存時刻
- 保存しない: 戦闘途中、風、市場の一時変動、開いているタブ、戦闘内クールダウン
- 400msデバウンスで自動保存
- 有効な保存データは起動時に自動ロードし、名前入力を飛ばす
- ヘッダーの回転矢印から確認後にニューゲーム
- 毎秒収益は`PASSIVE_REVENUE_MULTIPLIER = 2`
- 最大30分のオフライン収益を復帰時に小型通知

### 敵資本とAI

```ts
ENEMY_BALANCE_FACTOR = {
  tutorial: 1.00,
  normal: 1.20,
  cartelHQ: 1.30,
}
```

- 初期投入50%、追加防衛資金50%
- `src/utils/enemyAi.ts`へ判断を分離
- 所有率、風、風の残り時間、残予算、資金差、プレイヤー直前行動を評価
- 意図: 資金温存、追い風待ち、標準防衛、大規模防衛、緊急防衛、大口対抗
- 最後15%の予備資金は、劣勢・LB/全力直後・敵有利風・企業連合本部などの条件がなければ温存
- 大口・全力には準備バーを進めて反応
- LIMIT BREAKには既存の緊急防衛処理を維持

### 資金チップ画像

使用元:

- `src/assets/battle/source/gil-medallion-original.png`（提供時名: `ChatGPT Image 2026年7月25日 15_51_06 (1).png`）：平置きG硬貨
- `src/assets/battle/source/gil-stack-original.png`（提供時名: `ChatGPT Image 2026年7月25日 15_51_06 (2).png`）：透過済みの縦型硬貨束

加工:

- 1枚目のギル硬貨を切り抜き、2枚目の透明背景を維持したまま硬貨束を切り抜き
- 背景を透過
- 1536×1024からUI向け480×294へ縮小
- 自社用は金色とG意匠を維持
- 敵用は同じ陰影を保った暗赤・ローズゴールドへ色調整
- 新規図柄の生成やCSS図形への置換はしていない

出力:

- `src/assets/battle/gil-chip-player.png`
- `src/assets/battle/gil-medallion-player.png`
- `src/assets/battle/defense-chip-enemy.png`
- `src/assets/battle/defense-medallion-enemy.png`

盤面では1枚目を土台、2枚目を縦型の束として、投入額に応じて1～5個を位置、縮尺、角度を変えて重ねます。大量投入は束数を増やし続けず、`MAX STACK`表示で表現します。自社と敵は向きと色を変えています。

### モバイル

- 資金束は639px、390pxで段階的に縮小
- 金額、残り資金%、所有率ゲージ、COMMANDを画像で隠さない寸法
- `NEXT →`はsafe areaを含む下部フッター内
- SHORT/WIN/LOSEは盤面を覆うカードではなく、透過度の低い戦況テロップ

## 主な変更ファイル

| ファイル | 役割 |
| --- | --- |
| `src/App.tsx` | 自動ロード・保存、オフライン収益、毎秒収益2倍、ニューゲーム |
| `src/components/Header.tsx` | ニューゲーム導線 |
| `src/components/BattleModal.tsx` | SHORT/WIN/NEXT、0.1倍、判断型AI、画像資金束 |
| `src/utils/saveData.ts` | セーブスキーマ、復元、オフライン収益 |
| `src/utils/enemyAi.ts` | 敵意図と投入判断 |
| `src/battle-update-v3.css` | 資金束、戦況テロップ、NEXT、モバイル |
| `src/assets/battle/` | 加工済み資金チップ |
| `src/data/helpText.ts` | SHORTと収益説明 |
| `README.md` | 現行仕様とコード案内 |

## 検査と実機確認

実施済み:

- `pnpm run lint`：成功
- `pnpm run build:game`：成功
- `pnpm run build`：成功
- `git diff --check`：成功
- セーブ、最大30分収益、風待ち、最後15%温存、全力への緊急防衛のスモークテスト：成功
- ローカル本番HTTP応答：`200`
- 生成JS/CSSへVer.3識別子と4つの資金PNGが含まれることを確認

Codexのブラウザ接続は、権限付与後もWindowsの`apply deny-read ACLs`で起動前に停止しました。ビルド成功を実機確認済みとは扱わず、公開後に次を優先確認してください。

1. 保存なしでは通常の起動演出が出る
2. リロード後に所持金、物件、装備スキル、ALLIANCEが残る
3. オフライン収益が小さな通知で出る
4. ニューゲーム確認後に初期状態へ戻る
5. 資金源・かけひき中が0.1倍
6. SHORTが約1.2秒で自動復帰
7. WIN/LOSE後に最終盤面とNEXTが見える
8. 敵が優勢時に最後の予算を無駄遣いしない
9. 大口・全力・LBへ敵が反応する
10. 390px前後で画像と主要ボタンが重ならない

## 次の担当への注意

- Ver.2の段階式LIMIT BREAK、OVERKILL、ブリーフィング、SYNERGY、ALLIANCEを壊さない
- `public/game/`と`dist/`は生成物なので直接編集しない
- 保存スキーマを変える場合はバージョンと移行を考える
- 敵AI調整はまず`enemyAi.ts`と`ENEMY_BALANCE_FACTOR`の定数・条件から行う
- 資金チップを別画像へ勝手に置き換えない
- 新しいSitesプロジェクトやURLを作らず、既存`project_id`を再利用する

---

## Ver.4 引き継ぎ（GitHub公開版）

- 戦闘中の可処分資金に「商流回復」を追加。通常は対象相場0.3%/秒、資金源・かけひき・LB選択中は10%速度、1戦15%上限。永久所持金には直接加算せず撤退稼ぎを防止。
- 風倍率を強化。自社追い風1.35、向かい風0.72、競合追い風1.35、乱旋風は双方1.12・速度1.45。即時ゲージ衝撃にも風補正を適用。
- LIMIT BREAK倍率を1.20/1.50/1.85へ強化し、基準額を各社相場28%へ変更。風補正付き所有率衝撃、専用フラッシュ、コイン雨、画面振動、効果音を追加。
- 敵AIを都市段階制へ変更。小口の囮を見切り、優勢時に無駄な投資を避け、追い風待ち・大口反応・予備資金温存を行う。ゴールドソーサーは序盤最高のAI LEVEL 4・予算倍率1.72。
- 新規タイトル背景 `public/title-hero-v1.png` を起動画面とOGPへ適用。
- ゲーム内とREADMEへ、非公式ファンサイトである旨、公式ファンキットと利用条件へのリンク、指定の権利表記「© SQUARE ENIX」を追加。
- GitHub公開先は `spthx/ttr-atk`、Pages予定URLは https://spthx.github.io/ttr-atk/ 。GitHub ActionsはpnpmでViteゲームを静的ビルドし、ファンキット素材をPages成果物へコピーする。