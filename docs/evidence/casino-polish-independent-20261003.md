# Casino polish 独立検査・最終整理

対象 D:/Desktop/tataru-trade。変更は新規scripts/verify-casino-visuals.mjsと担当tmp/casino-polish-20261003/sol内の検証コード・証跡のみ。親9356は使用せず、独立Edge9360で実施。製品ソース・元PNG・ファンキット・資金・Gitは変更していない。

## 診断後の成立範囲

- 全renderer比較は既に1回完走した4188件を保持。全件最大1階調差、色差20超0。GPU内着地/波境界1992件は厳密0。resize24件は厳密0。同期下降12件は最大1階調差・色差20超0。
- 親のキャッシュ修正後に背景部分だけ再実行。ready更新24件＋同一Imageのsrc差替え24件=48/48合格。fresh比較は22件厳密0、残26件は最大4画素・1階調。親による8bit合成丸め許容(maxDelta<=1、changed.over20Pixels>0)を適用し、raw差分を保持。
- 独立2×2 dataURLの青→赤を同じImage・optionsのbackgroundImage overrideへ渡す1試験も成功。scene72は不変。Canvas/GPU双方で背景probeが(12,46,135,255)→(132,24,37,255)へ変化し、色差20超の変化画素率は約81.26%。
- 最小8枚4DPRを短く再実行し4/4厳密0。7枚参照とは全件で色差20超あり。8枚判定を1階調許容へ緩めていない。
- stamp部分だけ再実行。8/8サイズで全体・参照輪郭RMSEが低下、alpha128 bbox端差0。これは親アシスタントが設計した「大きな階段状誤差を重く評価する」受入条件であり、人間ユーザーが数値閾値を指定したという記述ではない。

限定再検査のsourceChanged=[]。最新修正のためにfull全件は再走していない。着地/波/resizeの厳密0条件はハーネスで維持した。

## 平滑化の数値

元RGBAから各出力画素へ8×8点の近似面積平均alpha参照を独立生成。評価はFloat64の参照に対して行い、全体と参照だけから定義した輪郭帯を比較する。

| 指標 | nearest | smooth |
| --- | ---: | ---: |
| 全体RMSE | 23.621 | 11.503 |
| 輪郭RMSE | 33.361 | 16.242 |
| 全体MAE | 6.798 | 5.184 |
| 輪郭MAE | 13.505 | 10.155 |

MAEも7/8サイズでは改善したが、55×13は全体4.428→5.908、輪郭8.320→10.993へ増加。55×13でもRMSEは全体18.416→13.060、輪郭25.328→17.957、最大alpha誤差161.438→52に減少した。全指標が改善したとは主張しない。

個数所見も保持: 透明画素に直接隣接するedge partialは960→960、共通2px帯partialは1905→2463、中間alpha16..239は45→1039。元画像にはほぼ不透明な微小alpha差が広く存在するため、個数だけを品質の合否にしていない。

## 元の73 checks / 15 fails

| 元の失敗 | 件数 | 診断・修正 | 最終扱い |
| --- | ---: | --- | --- |
| 背景ready後対freshの厳密RGBA差 | 12 | 最大5画素・1階調。背景自体は更新済み。親による8bit合成丸め許容を背景だけに適用 | 生の厳密差を保持し、限定再検査48件成功 |
| DPR1.25の最小8枚参照との差 | 3 | 検証参照が接地面より下へ1px出ていた。最大差230で、1階調合成丸めではない | 参照だけを接地面でclip。4DPR再検査で8枚厳密一致・7枚不一致 |

元のfull生ログを合格へ書き換えていない。初回smokeのedge個数同数と、追加MAE判定で55×13だけ失敗したログも保持する。後者は数値の改変で消さず、親のRMSE+bbox受入設計とMAE例外の併記で整理した。

記述中の「User-specified / ユーザー指定」という誤った帰属は「親による8bit合成丸め許容」へ訂正。過去のoverride結果ではこの説明メタデータだけを訂正し、測定値は変更していない。

## 実装と証跡

- scripts/verify-casino-visuals.mjs: --smoke / --full / --stamps / --backgrounds / --override-src。出力はこのsol内の時刻付きrunへ限定。
- full生ログ: 2026-10-03T07-07-56-112Z-full/results.json。
- 最新背景48件: 2026-10-03T07-26-45-184Z-backgrounds/results.json。
- 最新stamp8サイズ: 2026-10-03T07-27-17-192Z-stamps/results.json。
- 青→赤override: 2026-10-03T07-23-44-239Z-override-src/results.json。
- 最新8枚4DPR: minimum-contact-followup.json。以前の成功結果はminimum-contact-2026-10-03T07-11-57-576Z.jsonへ保存。
- 元failの再判定: background-spec-reassessment.json、詳細数値: STAMP-ALPHA-ASSESSMENT.md。
- 生のPNG証跡は各run内。元ソース画像を書き換えていない。

fullでの最大GPUdraw23、textureBytes13978880、bufferBytes16384、上限違反0。製品版の勝利→復帰、回転、CSS固定光流、最終見た目の選定、ビルドは親担当。こちらのfixture結果にそれらの完了を混ぜていない。
