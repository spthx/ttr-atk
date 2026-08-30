# 軽量・リッチな商戦描画と素材交換仕様

2026-08-30。現行fan版の描画を改善する実装記録。将来の独自製品については
[商用版準備仕様](./commercial-edition-readiness.md)を参照する。画像2枚の交換だけでは販売準備完了にならない。

## 採用した構造

- ゲーム計算、コマンド回復、資金、AI、勝敗、165msの波と音声経路は変更しない。
- コインは既存の18アンカーと最低8枚束を維持。物理エンジンや金額比例DOMは追加しない。
- `battleVisualTheme.ts`が画像URL、crop、台座の反復スライス、配色、版を所有する。rendererはテーマを受け取り、decoded画像の境界と固定比率を検査する。
- 柱と落下束は一枚刻みのspriteを最初にラスタライズし、以後bitmapを合成する。LRUは64件かつ30fpsで16MiB／60fpsで32MiB以下。これはcacheのRGBA backing-store予算であり、GPU全体やブラウザ全体のメモリ値ではない。
- 静止中は透明な完成盤面を再利用。動作中も同じ透明合成経路を使い、着地前後のalphaの丸め差を防ぐ。
- 同じ列の`before`と`after`、移動束を後列から前列の順に描く。手前台座マスクは最後に重ねる。
- hidden中は描画RAFを止め、復帰時に時刻を再投影する。unmountでbitmapと盤面cacheを解放する。
- 画像読込・resizeも同じ時刻投影を通す。完了した落下を開始位置へ巻き戻さず、省モーションも維持する。非表示判定は共通repaintにも置く。

反復描画の事前生成と画像再利用は[MDN Canvas最適化](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)にも記載される。ただし本作での採用判断は下記の実測・画像検査による。

## 過積載時の一体下降

`capitalViewportScroll.ts`で、完成山の上端がフィールド上15%の固定積載窓へ達すると、フィールド高24%相当の段階幅で下降位置を更新する。数値は今回の実装判断であり、原作ROMの実測値ではない。

波の進捗に沿って下降を補間し、台座・完成柱・前縁マスクを**1つのtransform**で動かす。新しい束は上段へ補充を続け、山頂が画面上端へ埋没したままにならない。

大きな下降では物理台座は下端の外へ連続して隠れる。台座だけを画面内へ引き戻したり、柱を置き去りにしたりしない。「台座は何があっても常に画面内」という旧文書とは両立しないため、過積載のviewport clipは明示的に許可する。柱の一枚刻みは画面下端まで維持する。

従来DTOの`bankedPileCount`等をゲーム計算へ戻す実装ではない。連続した確定列高から、描画器だけがカメラ位置を投影する。上段の**積載窓**は固定するが、すべての列の根元を同じ画面Yへ固定するという意味ではない。

## 派手さの制御

大きい落下束にだけ短い金属の光線を付ける。最大でも左右各6列×2本で固定し、画面全体のflash、無制限粒子、光のにじみ、架空の追加金貨を使わない。最初の少額束と省モーションでは出さない。主役は束の厚み、上段補充、完成山の連続下降である。

## 検証方法と結果

`capital-contact-audit.html`は製品rendererそのものを呼ぶ開発専用fixture。

```sh
npm run check:visuals
node scripts/capital-browser-audit.mjs 9356 http://127.0.0.1:3130 tmp/capital-upgrade-final
node scripts/verify-capital-browser.mjs 9356
```

ブラウザ検査はこの作業専用のEdge guest/headless profile、拡張・同期なし、ローカルVite上で実施。通常ユーザーのセーブやブラウザprofileは使わない。viewportは390×844／844×390／1440×900、実フィールドは378×366／824×159／1190×276、DPRは1／1.25／1.5／2。

| 測定 | 変更前 | 変更後 |
| --- | --- | --- |
| 大量投入・drawImage呼出の中央値 | 縦1973、横／wide1553 | 全条件129 |
| 同じ入力100frame・CPU描画処理p95 | 約24〜30ms | 約1〜2ms（条件別JSON参照） |
| 着地終了と完成盤面の一致 | この比較試験は未実施 | 12条件×7投入＝84件、差分0px |
| 最初の下降で台・根元を同一deltaだけずらした一致率 | 下降なし | 最低99.75%（AA境界に色差15以内を許容） |
| warm-up後900frameの柱bitmap再生成 | 毎frame描き直し | 0件 |
| 最大列高を含む試験のcache使用量 | 該当cacheなし | 最大9,030,912 bytes |

CPU値は決定論的な描画呼出ループで測ったsubmission時間。GPU完了時間、実機FPS、タッチ遅延、発熱、電池持ちの改善率ではない。ブラウザ全体の処理や最低機の30分playは商用出荷前に別途測る。[web.devのsmoothness解説](https://web.dev/articles/smoothness)のようにRAF平均値だけで表示品質を認証しない。

画像・JSON・動画は`tmp/capital-upgrade-before-clean`、`tmp/capital-upgrade-final`、`tmp/capital-upgrade-verification`。録画は固定投入fixtureの実renderer動画で、ゲーム通しplayや音声同期の記録ではない。

リポジトリ保存分: [下降動画](./evidence/capital-descent-20260830.mp4)、[変更前の計測](./evidence/capital-render-before-20260830.json)、[変更後の計測](./evidence/capital-render-after-20260830.json)、[ピクセル・資源検査](./evidence/capital-pixels-20260830.json)。初戦の新規開始→出資2回→勝利→分析→結果確定も実操作し、縦持ち・横持ち・wideへ切り替えて横overflowなしを確認した。全編実操作や実機音声確認の代替ではない。

## 将来の素材交換

Sites向け梱包は`node scripts/package-site.mjs PROJECT_DIR ARCHIVE.tar`。現行vinextのserver/clientとhosting設定のみを許可し、古いPages用`dist/assets`やソース、node_modules、QA profileを混ぜない。共有npm＋package-lockでclean buildしてから、そのcommitをpushし同じ成果物を保存・deployする。

Tailwindの自動探索は停止し、`src/`とゲームentry HTMLだけを明示する。クリーン環境で資料・一時フォルダ由来の不要CSSが増えたための対策で、販売用buildの再現性と配布サイズを守る。[Tailwind公式のsource指定](https://tailwindcss.com/docs/detecting-classes-in-source-files)

`createBattleVisualTheme({coin,pedestal}, metadata)`で新しいテーマを生成し、`BattleCapitalCanvas`の`theme`へ渡す。id/version/URL/crop/paletteの変更はcacheを無効化する。URLを変えず画像だけ更新するときはversionとHTTP側のcache keyも更新する。

これは商戦フィールドの交換境界の第一段階。人物、全世界データ、台詞、音、UIロゴ、保存ID、font、販促素材、配布許可リストは別途交換が必要。`commercialReady`は現段階で常にfalse。販売先の契約や申請は行っていない。

## 以前の記録の訂正

2026-08-23の文書commitは一体下降の意図を保存しただけで、当時のlive SFC rendererは下降を無効にしたままだった。booleanを読む検査だけでは実装を保証しなかった。今回、live rendererへ下降を接続し、実画像の移動量・着地差分・cache再生成を検査対象へ加えた。
