# Dependency maintenance — 2026-09-05

## 結果と適用範囲

本番依存の npm / pnpm audit 検出は 0 件。開発依存を含む監査は image-size 由来の high 2 件が残る。audit が検出しなかった Miniflare 配下の libheif critical 問題は、Miniflare に限定した sharp 0.35.4 override を npm / pnpm 双方へ適用して対処し、隔離画像 QA で修正版のロードを確認した。

変更対象は `package.json`、`package-lock.json`、`pnpm-lock.yaml`、追加承認された `pnpm-workspace.yaml`、この記録の 5 ファイルのみ。作業ルートの `node_modules`、アプリコード、generated/public、ビルド成果物、既存サーバー、Git は変更していない。全ビルド・アプリ QA・公開は主担当が実施する。

## 採用した更新

| 直接依存 | 変更前 | 変更後 | 理由 |
| --- | --- | --- | --- |
| next | 16.2.12 | 16.3.4 | 同一 major の安定版。8 月のセキュリティ修正と修正済み PostCSS / sharp を取り込む |
| react | 19.2.6 | 19.2.8 | React DOM / RSC の peer 要件と版を統一 |
| react-dom | 19.2.6 | 19.2.8 | 同上 |
| react-server-dom-webpack | 19.2.6 | 19.2.8 | Server Functions の DoS 修正 |
| vite | 8.0.13 | 8.0.16 | Windows の fs.deny 回避などを修正する同一 minor の patch |
| @cloudflare/vite-plugin | 1.37.1 | 1.51.1 | 修正済み undici / ws / esbuild を含む公式の依存組み合わせ |
| wrangler | 4.92.0 | 4.120.0 | 上記 plugin の依存・peer 要件に合わせる |

主要な間接依存は次のとおり。

| 依存 | 変更前 | 変更後 |
| --- | --- | --- |
| next 配下の postcss | 8.4.31 | 8.5.23（ルートへ統合） |
| next 配下の sharp | 0.34.5 | 0.35.4 |
| nanoid | 3.3.16 | 3.3.18（3.x の修正版） |
| fast-uri | 3.1.4 | 3.1.7（3.x の修正版） |
| undici | 7.24.8 | 7.29.0 |
| ws | 8.18.0 | 8.21.0 |
| wrangler 配下の esbuild | 0.27.3 | 0.28.1（既存の版へ統合） |
| miniflare | 4.20260515.0 | 5.20260801.1-alpha |
| miniflare 配下の sharp | 0.34.5 | 0.35.4（上流固定 0.35.2 に対する親限定 override） |

直接依存の major 移行、`npm audit fix --force`、audit の除外設定は導入していない。override は Miniflare 配下の sharp だけに限定した。vinext は 0.0.50 を維持。TypeScript、Tailwind、各型定義、ゲーム関連ライブラリの直接指定も維持した。

## 実測 audit

2026-09-05 に npm registry の監査 API へ問い合わせた結果。npm は lockfile を明示して監査した。

| コマンド / 時点 | critical | high | moderate | low | 終了コード |
| --- | ---: | ---: | ---: | ---: | ---: |
| 更新前 `npm audit --omit=dev --package-lock-only --json` | 0 | 4 | 0 | 0 | 1 |
| 更新前 `npm audit --package-lock-only --json` | 0 | 14 | 0 | 1 | 1 |
| 更新後 `npm audit --omit=dev --package-lock-only --json` | 0 | 0 | 0 | 0 | 0 |
| 更新後 `npm audit --package-lock-only --json` | 0 | 2 | 0 | 0 | 1 |
| override 後 pnpm 11.19.0 `pnpm audit --prod --json` | 0 | 0 | 0 | 0 | 0 |
| override 後 pnpm 11.19.0 `pnpm audit --json` | 0 | 2 | 0 | 0 | 1 |
| override 後 pnpm 10.34.5 `pnpm audit --prod --json` | 0 | 0 | 0 | 0 | 0 |
| override 後 pnpm 10.34.5 `pnpm audit --json` | 0 | 2 | 0 | 0 | 1 |

npm の残り 2 件は `image-size` と、それを固定依存する `vinext` のパッケージ集計。pnpm の残り 2 件は `image-size@2.0.2` の以下の 2 advisories。両管理系の数え方は異なる。

- [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr): ICNS 解析で無限ループ。
- [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq): JXL / HEIF 解析で無限ループ。

registry の `image-size` latest は 2.0.2。pnpm の監査データは patched range を `>=2.0.3` と表示するが、実際の `https://registry.npmjs.org/image-size/2.0.3` は 404。公開されていない版を指定していない。npm が提案する vinext 1.0.0-beta.9 は major / beta 移行なので、本タスクでは適用しない。確認した vinext 0.0.55 / 0.2.1 も image-size 2.0.2 を固定している。

vinext は devDependencies に分類されているが、実際には既存 `build` / `start` コマンドで使用する。`--omit=dev` の 0 件だけで本番成果物に当該コードが含まれないとは判断できない。以下は公開済み vinext 0.0.50 の実装と現在のアプリを読んだ到達性調査であり、最終成果物の解析とは区別する。

## image-size の build / runtime 到達性

| 経路 | 実装上の到達性 | 現在のプロジェクトで確認したこと |
| --- | --- | --- |
| `build:game` / `build:pages` | `vite.game.config.ts` は React / Tailwind plugin を使用し、vinext の画像解析 plugin を登録しない | ゲームの PNG import は `src/components/BattleCapitalCanvas.tsx` / `src/capitalContactAudit.ts` にあり、このゲーム単体ビルド経路で処理される。CI の `deploy-pages.yml` は `build:pages` を実行する |
| Sites の外側 `npm run build` と `vinext dev` | `vinext()` の `vinext:image-imports` plugin が画像 import を変換し、`?vinext-meta` の load 時にローカルファイルを `imageSize(fs.readFileSync(...))` へ渡す | `app/page.tsx` はゲームを iframe で表示し、現在の `app/` に対象の静的画像 import はない。将来画像 import を追加すると到達する |
| vinext の App Router manifest 生成 | `entries/app-rsc-manifest.js` → `createMetadataRouteEntriesSource` → `createMetadataRouteEntryData` → `readStaticMetadataImageDimensions` → `imageSize(buffer)`。静的な icon / favicon / OG 等の画像ファイルをビルド・開発時に解析する | 現在の `app/` は page.tsx / layout.tsx / globals.css のみ。layout の icons / OG / Twitter 画像は public の URL 文字列であり、ファイルベースの metadata 画像ルートではない |
| Cloudflare Worker の `/_vinext/image` | `worker/index.ts` → `vinext/server/image-optimization` → `ASSETS.fetch` → `IMAGES.input(...).transform(...).output(...)`。この経路に image-size 呼び出しはない | 本番は Cloudflare の IMAGES binding、ローカルエミュレーションでは Miniflare / sharp を使う。今回の override は後者を修正する |
| `vinext start` の `/_vinext/image` | `server/prod-server.js` の App / Pages 両分岐はパラメータ・Content-Type を検証し、静的ファイルを返す。この分岐に image-size 呼び出しはない | 任意のリモート画像 URL を image-size へ渡す経路は、確認した handler では見つからなかった |

再確認用の配布コード位置は `vinext@0.0.50/dist/index.js:1297`（imageSize 呼び出し）、`dist/entries/app-rsc-manifest.js:150`（metadata 生成）、`dist/server/metadata-route-build-data.js:31`（画像解析）、`dist/server/prod-server.js:642` / `:818`（実行時画像 endpoint）。配布物は [npm registry の vinext 0.0.50](https://registry.npmjs.org/vinext/0.0.50) で特定できる。

実行リスクの判定: 確認した現在のコードでは、未信頼の HTTP 入力から image-size の parser が実行される経路は見つからなかった。ゲーム単体ビルドにも当該 plugin はなく、Sites の vinext ビルドには parser を呼ぶ機能が存在するが、現在の app に対象の画像 import / metadata 画像ファイルはない。依存の存在だけで実行時に悪用可能とは判定していない。

この判定は上記の現在のソース経路に限定する。image-size はバイト列から形式を判定する（`dist/index.mjs:953` / `:966`）ため、将来対象のローカル画像入力を追加する際は拡張子だけで非到達と判断しない。未リリース修正・beta 移行は適用せず、悪性画像 PoC や範囲外の成果物変更も行っていない。

## audit 外の libheif 問題と限定 override

公式 [libheif GHSA-g89c-p67h-r497](https://github.com/strukturag/libheif/security/advisories/GHSA-g89c-p67h-r497) は libheif 1.22.0–1.23.1 の heap overflow を critical として公表し、修正版を 1.23.2 としている。

初回調査では Next.js 配下の sharp 0.35.4 は libheif 1.23.2 / libvips 8.18.6、Miniflare 配下の sharp 0.35.2 は libheif 1.23.0 / libvips 8.18.3 だった。この Miniflare 側の問題は audit の critical 集計に出なかったため、公式 advisory とロードした native library の両方で確認した。

確認時の最新 `@cloudflare/vite-plugin@1.54.4` / `wrangler@4.129.0` が使う `miniflare@5.20260903.0-alpha` も sharp 0.35.2 を固定しており、直接依存をさらに更新するだけでは解消しない。

承認された追加対応として、以下の同じ親限定ルールを設定した。

```json
"overrides": {
  "miniflare": {
    "sharp": "0.35.4"
  }
}
```

```yaml
overrides:
  'miniflare>sharp': 0.35.4
```

前者は package.json、後者は pnpm-workspace.yaml。既存 allowBuilds と minimumReleaseAgeExclude は変更していない。Next.js 自身の `sharp: ^0.35.4` はそのままで、両親が同じ 0.35.4 を使うため lock の重複が解消された。全 registry 解決版の差分は旧 sharp / native binary 27 組の削除だけで、他の依存版や残した integrity は変えていない。libheif は 3 つの隔離インストールで修正版 1.23.2 を実測した。

pnpm 11 は package.json の `pnpm` フィールドを読まないため workspace へ設定している。[pnpm 11 公式変更点](https://pnpm.io/blog/releases/11.0) npm の親限定指定は [npm overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides)、pnpm 10 の同指定は [pnpm 10 overrides](https://pnpm.io/10.x/settings#overrides) に従う。上流 Miniflare が修正版 sharp を採用した後、再検証して限定 override を撤去できる。

## 互換性と検証

共有 Node.js 24.14.0 / npm 11.9.0、既存 pnpm 11.19.0、および一時ディレクトリだけへ導入した pnpm 10.34.5 を使用。Node.js / npm の別コピーは導入していない。プロジェクトの `engines.node >=22.13.0` と既存 scripts を維持した。主担当から指定された `check:roll-stream = tsx scripts/check-capital-roll-stream.ts` と `check:app-performance = tsx scripts/check-app-performance.ts` を追加し、`check:visuals` の末尾を `&& npm run check:roll-stream && npm run check:app-performance` とした。主担当が更新した CI は `npm run check:visuals` を実行するため App 性能検証も必須となる。依存宣言を変えない scripts の追加でも manifest / lock 整合性を再確認した。Cloudflare plugin / wrangler、Vite、vinext、React / React DOM / RSC の公表 peer 範囲に適合する。

Cloudflare の直接依存は安定版・同一 major だが、その公式組み合わせが Miniflare 5 alpha を内包する。主担当はこの公式依存関係を許容し、production build を確認する。Next 16.2→16.3、sharp 0.34→0.35 とあわせて、主担当の全ビルド・起動 QA に引き継ぐ。

初回の依存更新 staging で実施した検証（以下の個数・警告は override 前の記録）:

- `npm ci --no-fund --no-audit`: 成功。依存の install scripts も実行した。217 パッケージをインストール。
- `npm ls --all --json`: 終了コード 0、missing / invalid peer なし。ただし sharp の WASM fallback 2 版と関連 `@emnapi/runtime` が計 3 件 extraneous と表示された。依存木を完全無警告とは扱わない。
- `pnpm import`: 成功。npm の解決結果から pnpm lock を生成。
- `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline`: 成功。pnpm の実体インストール・install scripts の検証ではなく、lock と設定の整合性検証。
- 直接依存全件の specifier / 解決版、registry パッケージ 342 個の名前・版・integrity が npm / pnpm 間で一致。npm が個別記録する Tailwind WASM 内の bundle 6 エントリは、pnpm では同一 tarball integrity により同梱されるため比較から除外した。
- React のサーバーレンダリング、`--conditions=react-server` での RSC server export、Next が解決する sharp の PNG encode/decode、Vite / esbuild の TypeScript 変換、PostCSS parse、NanoID の size=0、Cloudflare plugin / vinext の import: 成功。
- Vite の `transformWithEsbuild` 検証では API の非推奨警告が出たが処理は成功。アプリコードを変更する理由とはしていない。
- pnpm import / npm ci は既存間接依存 `tsconfck@3.1.6` の unmaintained 警告を表示。vinext の既存依存経路で、今回の audit 残件とは別。
- 追加した `check:roll-stream` のコマンドと `check:visuals` 末尾の接続を機械確認。並行作業中のスクリプト本体の実行は主担当の QA に引き継ぐ。

初回 staging は `C:/Users/yutto/AppData/Local/Temp/trade-dependencies-20260905-c724a4fb57b74813a368d782fe7ac85f`。同所の `baseline/` に変更前の 3 依存ファイルを保存した。

### override 後の画像 QA と pnpm 10 / 11

今回の staging は `C:/Users/yutto/AppData/Local/Temp/trade-sharp-20260905-b20d68d3fbad44eaa67a0cc7dfd01471`。`npm/`、`pnpm10/`、`pnpm11/` を分離し、pnpm store もこのディレクトリ内へ限定した。`baseline/` に追加対応前の 5 ファイル、`image-qa.mjs` に再実行可能な画像 QA を保存した。スクリプトは各インストール先を cwd にして `node ../image-qa.mjs --binding` で実行できる。

| 管理系 | クリーンインストール | Miniflare の実解決 | 画像 QA |
| --- | --- | --- | --- |
| npm 11.9.0 | `npm ci --no-fund --no-audit`: 成功（214 packages） | sharp 0.35.4 / libheif 1.23.2 / libvips 8.18.6 | 全件成功 |
| pnpm 10.34.5 | `install --frozen-lockfile`、空の専用 store: 成功（212 packages） | 同上 | 全件成功 |
| pnpm 11.19.0 | `install --frozen-lockfile`、空の専用 store: 成功（212 packages） | 同上 | 全件成功 |

各環境で PNG / JPEG / WebP / AVIF を生成して decode・32×24→16×12 resize・PNG encode を検証し、PNG の alpha を保持することも確認。画像ではない入力と途中で切れた AVIF は拒否された。さらに実際の `Miniflare.getImagesBinding('IMAGES')` で 4 形式を PNG へ変換し、HTTP status / Content-Type / 出力寸法を検証した。Miniflare は QA 専用の loopback / 自動選択 port で起動し、各検証後に `dispose()` で終了した。既存サーバーへ接続・変更していない。これは修正版での機能・エラー処理 QA で、悪用画像の完全な回帰テストではない。

pnpm の厳密な依存分離に合わせ、QA は Cloudflare plugin の実パスを起点に Miniflare、その Miniflare を起点に sharp を解決する。root に別版があるだけの見かけ上の更新にはなっていない。npm / pnpm 両lockの registry パッケージ **315 組**について名前・版・integrity が一致し、pnpm 10 / 11 の frozen install 後も同じ lock SHA-256 を保持した。Tailwind WASM 内の bundle 6 エントリは前述と同じ扱い。

主担当は CI `.github/workflows/deploy-pages.yml` を **npm ci / Node 24 / npm cache** へ更新し、Sites と package-lock.json の経路を統一した。更新後の workflow を読み、検証・`build:pages` も npm entry であることを確認した。この依存保守タスクは CI ファイルを変更していない。pnpm 10 は CI の必須条件から外れたため、以下は互換性の補足記録となる。

検証時点の npm registry で最新の 10 系は 10.34.5。この版で workspace の `miniflare>sharp=0.35.4` を読み、実インストール・画像 QA まで成功した。`allowBuilds` も内部で `onlyBuiltDependencies=[esbuild, sharp, workerd]` / `ignoredBuiltDependencies=[@google/genai, protobufjs]` に変換され、許可済み esbuild / workerd の postinstall が実行された。`allowBuilds` は pnpm **10.26.0 以降**の機能であり、古い 10.x 全版への保証ではない。[pnpm 10 allowBuilds](https://pnpm.io/10.x/settings#allowbuilds) pnpm 11 との override・画像処理結果の差はなかった。実機検証は Windows x64 / Node 24.14.0 で、Ubuntu CI 全体の実行結果ではない。

override 後の `npm ls --all --json` は終了コード 0、missing / invalid peer はなく、WASM fallback の `@img/sharp-wasm32@0.35.4` と `@emnapi/runtime@1.11.3` の extraneous 表示 2 件が残る。pnpm 10 / 11 の install は既存のビルド許可で完了した。追加 App 性能・roll-stream 検証は scripts の接続まで機械確認し、並行編集された本体の実行は主担当の全 QA に引き継ぐ。

## 主担当の適用・公開前確認

作業ルートの node_modules は更新していない。主担当が隔離 `tmp/release-rs3-20260905` で新しい依存の install / build / 全 QA を行う予定であり、このタスクはその release ディレクトリを変更していない。Sites の production entry は引き続き以下のとおり。

```text
npm run build
  -> npm run build:game && vinext build
```

`npm run build:game` だけでは production entry の検証にはならない。外側の `npm run build`、起動、ゲーム・描画 QA、Next / vinext の画像処理経路を確認する。本記録ではビルド・公開の成功を主張しない。

## 公式の根拠

- [Next.js August 2026 Security Release](https://nextjs.org/blog/august-2026-security-release): 16.3.3 の Windows / AVIF セキュリティ修正。採用版 16.3.4 はこれ以降。
- [npm registry: next 16.3.4](https://registry.npmjs.org/next/16.3.4): postcss 8.5.23 / sharp ^0.35.4、React peer、Node 要件を確認。
- [PostCSS GHSA-fxqj-rqcc-2cmp](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp): 8.5.22 以下の残存 source map 問題を 8.5.23 で修正。
- [sharp GHSA-f88m-g3jw-g9cj](https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj)、[sharp 0.35.4](https://github.com/lovell/sharp/releases/tag/v0.35.4)、[sharp-libvips 1.3.3](https://github.com/lovell/sharp-libvips/releases/tag/v1.3.3): ネイティブ画像依存の修正・出荷版。
- [NanoID 3.3.18](https://github.com/ai/nanoid/releases/tag/3.3.18)、[GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8): 3.x の DoS 修正版。
- [React RSC GHSA-wx67-qw84-cm4g](https://github.com/advisories/GHSA-wx67-qw84-cm4g): 19.2.8 の修正。
- [Vite GHSA-fx2h-pf6j-xcff](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff): Windows fs.deny 回避と修正 8.0.16。
- [Cloudflare Vite plugin 1.51.1](https://github.com/cloudflare/workers-sdk/releases/tag/@cloudflare%2Fvite-plugin@1.51.1)、[Wrangler 4.120.0](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler@4.120.0): 対応する Miniflare / Wrangler の公式組み合わせ。
- [undici GHSA-4cwx-7wf7-3272](https://github.com/nodejs/undici/security/advisories/GHSA-4cwx-7wf7-3272)、[fast-uri GHSA-f65p-4m7j-42xc](https://github.com/fastify/fast-uri/security/advisories/GHSA-f65p-4m7j-42xc): 間接依存の修正根拠。
- [pnpm import](https://pnpm.io/cli/import): package-lock.json からの lock 生成。

registry は `https://registry.npmjs.org/<package>/<version>` の公開メタデータも照合した。GitHub 認証操作や Git 操作は不要であり、実施していない。
