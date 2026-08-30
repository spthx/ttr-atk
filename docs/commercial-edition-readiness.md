# オリジナル商用版への準備仕様・出荷判定

確認日: **2026-08-30（Asia/Tokyo）**

対象: `D:/CodexHome/worktrees/7100/trade`

調査時HEAD: `cac20d0b9064d9c978eeb7acefd49cb9c2dc2b2a`
状態: **商用版の準備は未完了。現行fan版の販売可否を肯定する文書ではない。**

本書は、現在の「タタルの大繁盛商店」を基に、将来、独自の名称・世界観・表現と適切な権利を備えた別製品を作るための調査・仕様案である。画像の差し替え、動作改善、非公式表記、ストア審査通過のいずれも、第三者の権利許諾を代替しない。現行fan版の無償公開についても、本調査だけで適法・許諾済みとは認定しない。

「確認済み」は公開一次資料または今回読んだコードで確認した事実、「提案」は将来の製品方針、「未確認」は証拠不足を表す。提案した予算・性能値は実測値ではない。権利の個別判断は権利者・必要に応じて専門家に確認する。本書は法的助言や発売許可書ではない。

調査中も別担当がrenderer関連を更新しているため、コードの記述は読み取り時点のスナップショットであり、並行変更後の完成状態を保証しない。本担当の変更は本ファイルだけ。実装、既存仕様、生成物、commit、push、公開、他タスクの作成・操作は対象外とする。

## 1. 準備完了、権利確認、発売判断を分ける

| 判定 | 必要な証拠 | それだけでは成立しないこと |
| --- | --- | --- |
| 技術・内容の準備完了 | 確定した製品仕様、P0試験、配布候補のhash、欠陥一覧 | 素材・名称・音声等の商用利用許諾 |
| 権利確認完了 | 対象物ごとの制作経緯・契約・利用範囲・表示義務の確認 | ストア掲載承認、製品品質の保証 |
| ストア側の承認 | 対象App・提出build・ページ・申告についての承認記録 | 権利者からの許諾、将来の変更への包括承認 |
| 発売実行の判断 | 上記の証拠と運営準備を確認した販売責任者の判断 | 本書の作成やテスト成功による自動的な発売 |

完全に独立した製品として制作する場合まで、Square Enixの個別許可を必須とする趣旨ではない。残す第三者要素について必要な権利が説明できない場合は交換または適切な許諾取得が必要であり、「オリジナル化したつもり」で判断を省略しない。

## 2. 公開一次情報から分かる条件

### 2.1 Square Enix / FFXIV

日本語の著作物利用条件はFFXIVコミュニティ形成を目的とする利用を対象とし、fan kitも対象物に含む。商用・営利利用を禁止し、対価だけでなく宣伝・広告も含める。動画投稿サービスの一定の収益化等には例外があるが、ゲーム販売への一般的許諾とは読めない。権利表記、過度の加工禁止、利用中止要求への対応、日本国内という利用範囲もある。[S1: 著作物利用条件](https://support.jp.square-enix.com/rule.php?id=5381&la=0&tag=authc)

同条件には音楽データの用途制限とJASRACに関する規定もある。今回確認したSEは公式ページではスマートフォン用着信音として配布され、同条件を読むよう案内されている。着信音の配布を別ゲームへの商用組み込み許可とは扱わず、SEと楽曲の適用関係を推測で同一視しない。[S1](https://support.jp.square-enix.com/rule.php?id=5381&la=0&tag=authc)、[S2: 公式着信音配布](https://jp.finalfantasyxiv.com/lodestone/special/fankit/smartphone_ringtone/)

本製品計画では、fan kit画像・音声を商用版へ持ち込まない方針を提案する。改名、色替え、トレース、再録音、AIによる描き直しだけを権利解決の証拠にしない。無料体験版、寄付、広告、宣伝用画像へ置き換えれば問題がなくなるとも判断しない。日本語条件だけで海外配信・販売の権利範囲を確定しない。

また、FFXIVの条件から、別作品である『ロマンシング サ・ガ3』の画像・録画・抽出音等の利用許諾を導かない。既存の原作研究資料と製品へ入れる表現を分け、商用版の美術・音響は独立して来歴を確認する。

### 2.2 Steamworks: 第三者権利と公開準備

Onboardingは、所有していない、または十分な権利を持たないコンテンツを禁止対象にしている。契約・本人確認・銀行税務情報等の手続きが必要で、初期タイトルについてapp fee支払後30日の待機、Coming Soonの少なくとも2週間の公開を案内している。実際の適用状態は販売責任者のSteamworks画面で確認する。[S3: Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding)

ストアページと製品buildはそれぞれ審査対象。掲載機能と実装の一致、対応OSでの起動、ゲームプレイのスクリーンショット等が確認される。審査は通常3〜5営業日、修正を見込んで少なくとも7営業日の余裕を持つよう案内されており、発売日を保証する期間ではない。[S4: Review Process](https://partner.steamgames.com/doc/store/review_process)

ページの審査申請をbuildの審査申請より先に行い、発売までに両方の承認をそろえる。承認後も自動発売ではなく、権限を持つ担当者による発売操作が別途必要となる。[S5: Release Process](https://partner.steamgames.com/doc/store/releasing)

### 2.3 Steamworks: Content Survey / AI

審査申請前にGeneral Content、Mature Content、Generative AIの申告を行う。成人向け内容はbuild内にある未公開・到達不能のものも申告対象。AI欄は、制作効率化ツール一般より、プレイヤーに届く画像・音・物語・翻訳等の生成物に着目する。制作時の生成物と実行時の生成を分け、後者には違法な生成を防ぐ対策の説明も必要となる。申告しても禁止内容が許されるわけではなく、承認後の一部回答変更にはサポートへの連絡が必要になる。[S6: Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)

本作への適用は未確定。生成画像らしいファイル名やREADMEの記述だけで回答を決めず、実際に出荷する素材ごとに制作履歴を集める。AIによるコード補助と、出荷する画像・台詞・翻訳・音の生成を区別して記録する。AI申告は権利確認の代替ではない。

### 2.4 itch.ioを選ぶ場合

itch.ioのPublisher Contentでも、投稿者が公開・複製・配布等に必要な権利を有することを表明する。サービスでの表示・宣伝等に必要な権利付与も含まれる。したがって販売先をitch.ioへ変更しても、第三者素材の確認は省略できない。採用時は同サービスの最新の公開・価格・決済・コンテンツ規則を追加確認する。[S7: itch.io Terms of Service, §§3–4](https://itch.io/docs/legal/terms)

## 3. 現行コード・素材の棚卸し

`rg`によるファイル列挙・文字列検索と対象ファイルの読み取りで確認した。バイナリ画像の来歴・音源の同一性、契約書、購入証明、配布済みサイト、Steamworksアカウントは監査していない。以下は交換・審査対象の位置を示すもので、個々の名称がすべて商標登録されているという判定ではない。

| 対象 | 確認した所在・依存 | 商用版で必要な対応 |
| --- | --- | --- |
| 公式画像 | `src/data/fankitAssets.ts`、`public/ff14-fankit/`。タタル2種、ジョブ画像、職能アイコン、背景、サボテンダー訓練画像等 | 独自人物・職能・背景へ交換。廃止導線の素材も配布物から除外する |
| 広い画像参照 | `App.tsx`、`LaunchIntro`、`TatarAdvisor`、`EndingModal`、各View。論理キーにも`tataru`等が残る | 通常・高難度・解放・全エンディング・旧セーブ復帰を含めて検査。パス差し替えだけで完了にしない |
| 公式SE | `FANKIT_AUDIO`と`src/utils/audio.ts`。開始・解放・LB・勝利・敗北の5本。`public/ff14-fankit/audio/README.md`に取得元の記録 | 5イベントを独自音へ交換。元MP3、コピー、キャッシュ、予備ファイルも製品から除外 |
| 独自扱いのSE | `public/game-audio/capital-rapid-fire.mp3`、`GAME_AUDIO`。`design-qa.md`には原作抽出音と実装音の比較記録がある | 比較記録は実装音が原作から抽出された証拠でも、独自制作の証明でもない。録音・合成・購入元と利用範囲を確認できなければ新規制作 |
| 合成音 | `audio.ts`にWeb Audioのoscillator、noise、AudioBuffer、公式音取得失敗時のfallback | 波形生成コードだけで権利確認を終えず、特徴的旋律・サンプル・模倣元の有無も確認。fallbackを含め音を聴いて審査 |
| BGM・声 | 今回列挙した配布用音声ファイルはMP3計6本。他形式の独立BGM・声ファイルは検索範囲で検出せず | 埋め込み・動画内音声・依存物まで未検査。「音楽なし」を最終認定しない。追加時は作曲・原盤・実演・音声生成条件を台帳化 |
| 自作・生成・提供画像 | `public/title-hero-v1.{png,webp}`、`src/assets/battle/`、同`source/`。READMEに生成物・ユーザー提供物という記述、引継書に`ChatGPT Image`名の記録 | 作者、元画像、生成手段、編集履歴、契約を追跡。`original`というファイル名や提供者の保有だけで商用権利を認定しない |
| コイン・台座・背景 | 現rendererは`capital-coin-sfc.png`、`capital-pedestal-sfc.png`をimport。旧gil系画像・casino背景も存在 | 使用中・未使用を分け、全候補の来歴と意匠を審査。原作映像の再現資料をそのまま製品素材にしない |
| タイトル・人物・世界 | `src/data/worldData.ts`にタタルと10都市。`initialData.ts`に公式名称を使う取引先やチョコボ等、`allianceData.ts`に双蛇党・黒渦団・不滅隊 | タイトル、人物設定、地理、組織、職能、物件、通貨、物語を一体で独自設定へ。新名称の商標・混同可能性も確認 |
| 技・文章・口調 | `initialData.ts`、`battleEncounterData.ts`、`helpText.ts`、`utils/savage.ts`等、`App.tsx`、`BattleModal.tsx`、`TatarAdvisor.tsx`、`EndingModal.tsx` | リミットブレイク等の名称、予兆文、解説、実績相当の称号、助言の「でっす」口調も編集審査。一般語まで機械的に権利侵害と決めつけない |
| 通貨・内部識別子 | `formatter.ts`は「ギル」を出力。`types.ts`にFFXIV都市名のunionと`dofor` / `abyss`のowner種別 | 表示文字列と意味を持つIDを分離。原作を想起させる表現・識別子は用途別に整理し、単純な置換でロジックを壊さない |
| セーブ | `saveData.ts`: schema 3、`tataru-world-trade-save-v3`、`tataru-company-name`。`companyName`、`ownerName`、都市名を使う`conqueredCommunityIds`を保存 | 「表示名は保存していない」とは言えない。版別保存領域、名前とIDの移行、旧データ混入、ユーザー入力の扱いを設計する |
| ロゴ・起動・販促面 | `index.html`、`app/layout.tsx`、`app/page.tsx`、`metadata.json`、`public/manifest.webmanifest`、`public/ff14-fankit/app-icons/`、`public/og*.png`、README | favicon、PWA名・アイコン、OG/Twitter、alt、検索説明、スクリーンショット、動画、capsule・library素材まで新製品で統一 |
| 権利表記 | `App.tsx`等にFFXIVリンク、`© SQUARE ENIX`、FINAL FANTASYの商標説明。READMEに非公式・非営利表記 | 表記を消すだけでは交換完了にならない。現fan版の必要表記は維持し、別製品では実際の権利関係に即したcreditを作る |
| フォント | CSSに`system-ui`、`ui-sans-serif`、`ui-monospace`、Consolas、SFMono-Regular、Georgia、Times New Roman等。対象ソースで`@font-face`や外部font取得、通常の資産列挙でwoff/ttf/otfを検出せず | OSフォント指定とフォントファイルの同梱を分ける。新規フォントのゲーム組込・Web配信・改変・ロゴ利用条件を確認。依存物内のフォントは別途検査 |
| コード・アイコン依存 | `package.json`、`package-lock.json`、`pnpm-lock.yaml`。React、Next、Lucide、canvas-confetti、Vite、vinext等 | 実際の製品bundle/runtimeを確定し、間接依存・同梱native library・アイコンを含むSBOMと第三者表記を作る |
| 生成物・配信 | `public/game/`は既存生成物。`.github/workflows/deploy-pages.yml`は`public/ff14-fankit`を丸ごと`dist/ff14-fankit`へコピー | importを消しても配信され得る。商用版の許可リストに基づき梱包し、配布候補そのものを再走査する |
| AI実行の有無 | `metadata.json`にGemini能力の宣言、`.env.example`にキーの例示。今回の`src`・`app`・`worker`の検索では実行時生成API呼出を特定せず | 宣言だけでLive-Generatedあり／なしを確定しない。採用runtime・通信・生成履歴を確認し、出荷内容と申告を合わせる |

### 3.1 依存ライセンスの確認範囲

次は`package-lock.json`の宣言であり、ライセンス本文・実際の同梱範囲の検査結果ではない。

| 直接依存 | lock上のversion | lock上のlicense |
| --- | --- | --- |
| react / react-dom | 19.2.6 / 19.2.6 | MIT / MIT |
| next | 16.2.12 | MIT |
| lucide-react | 0.546.0 | ISC |
| canvas-confetti | 1.9.4 | ISC |

lock全体にはMIT/ISC以外にApache-2.0、BSD系、MPL-2.0、LGPL-3.0-or-later、CC-BY-4.0、複合条件等も存在する。例として`@img/sharp-libvips-*`にLGPL、`@img/sharp-win32-*`等に複合条件、`@resvg/resvg-wasm`・`@vercel/og`にMPLの宣言がある。これを「全てゲームに同梱される」「製品全体を公開しなければならない」「商用不可」とは解釈しない。

Webのみ、デスクトップruntime同梱、サーバー配備では確認対象が異なる。採用versionのLICENSE/NOTICE、再配布・改変・ソース提供等の条件を実物と対応させる。Lucide等の同梱素材に別由来の条件がないかも確認する。今回のrepository検索では統合した権利台帳・SBOM・第三者NOTICEを確認できず、著作者や共同制作者からのコード利用権も未確認である。

## 4. 将来の製品仕様案

### 2026-08-30 追加確認: 依存脆弱性（販売前の未達項目）

メイン担当がclean `npm ci`後に`npm audit --omit=dev --json`を実行。production依存グラフではhigh 4件（nanoid、next、postcss、sharp）、全依存では15件（high 14、low 1）の警告が出た。これらは今回の描画変更で追加した依存ではない。実際の配布bundleからの到達性・悪用可能性はまだ認証していないため、「開発ツールだけなので安全」とは断定しない。

公式監査レコード: [nanoid](https://github.com/advisories/GHSA-2v37-7h3g-55p8)、[PostCSS](https://github.com/advisories/GHSA-r28c-9q8g-f849)、[sharp/libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)。npmはnext 16.3.3等への更新を候補として提示したが、この文書で互換性・修正完了を保証しない。販売前に依存更新、双方のlockの整合、実行経路の確認、clean build、表示・保存・公開の再検証を完了する。今回`npm audit fix --force`は実行せず、現行ファン版の描画変更と切り分けた。

商用出荷のP0-04／P0-09には「適用される既知のhigh/critical脆弱性が未対処・未評価で残らないこと」を追加する。現行版の技術改善やストア審査がこのgateを代替することはない。

以下は販売準備のための提案であり、価格、製品名、対応機種、販売時期、実装方針の決定ではない。現fan版の仕様を変更する指示ではない。

### 4.1 製品の核と範囲

独自世界の商会を運営し、収益・人脈・協力要請・離反リスク・市況を使って資金競争に勝つ、一人用の2D交易戦略ゲームを目指す。小規模取引から地域進出、難敵との交渉、結果分析、再挑戦へ進む。資金が積み上がる視覚的な手応えと、敗因を理解して改善できる体験を価値にする。

| 項目 | 初版の提案 | 確定・検証が必要なこと |
| --- | --- | --- |
| 世界観 | 独自人物、都市、商会、職能、通貨、取引史。古い2D作品への親しみは独自表現で実現 | 設定・用語・美術・音の統一、他作品との類似性の確認 |
| 内容 | 学習導線、通常キャンペーン、区切りのある結末、必要な分だけの再挑戦・高難度 | 出荷する都市数・物件数・技能数・所要時間を確定。現fan版の全高難度を無条件には引き継がない |
| 販売形態 | 買い切りを第一候補。初版は広告・外部課金・実行時AI・常時接続を前提にしない | 価格、地域、サポート費、販売条件。将来機能を発売時の実装として広告しない |
| 対応先 | Steam向けWindowsデスクトップ版を第一候補、Web/itch.io体験版は別候補 | 実行runtimeと梱包方式、OS・最低機・起動終了・更新・オフライン。現Web/PWAはSteam用buildの完成証拠ではない |
| 入力 | マウス＋キーボードで全導線を操作。タッチはWeb版を出す場合に保証 | ゲームパッド、Steam Deck、macOS/Linuxは検証するまで対応を約束しない |
| 保存 | 中断再開、世代付き保存、破損警告と回復、更新時の互換確認 | 商用版独自の保存領域。クラウド保存は採用するまで保証しない |
| 可読性・音 | 文字拡大、色だけに依存しない戦況、音量・mute、省モーション | 縦横画面、文字切れ、重要な予兆の文字化、音声が再生できない場合の完走 |
| 言語 | 日本語を起点に全文をキー化。翻訳追加が可能な構造 | 英語等をストアで標榜する場合は全画面・説明・画像内文字・欠落fallbackまでQA |

### 4.2 オリジナル版content packと境界

`rules / content / presentation / renderer / platform`の責務を分ける案を採る。ここでの名称は概念であり、今回はディレクトリやAPIを追加しない。

| 境界 | 扱うもの | 完了条件 |
| --- | --- | --- |
| rules | 資金、勝敗、敵判断、解放、精算、乱数seed | DOM・画像寸法・fps・音声再生から独立した入力と結果 |
| content | 中立ID、数値設定、世界設定、台詞、翻訳 | 表示名で分岐しない。schema検査と参照切れ検査を通る |
| presentation | rulesの結果を時系列eventとsceneへ変換 | 表示を省略しても勝敗・精算が同じ。音と絵の同期IDを共有 |
| renderer | scene、skin、viewport、時刻を描画へ変換 | 世界・権利元の固有名を持たず、ゲーム状態へ書き戻さない |
| platform | 保存、ファイル取得、入力、音、終了・復帰、任意のストア機能 | Web/desktopの差を隔離し、不要なネット接続や外部サービスを要求しない |

content packには`packId`、version、互換schema、locale、論理asset ID、相対パス、寸法・pivot/crop、音のevent ID、font設定、credit、権利台帳への参照を持たせる。画像・音・文章・ロゴ・fontを同一packの審査範囲とする。台帳には作者・入手元URL・取得日・原本hash・契約証拠・商用/改変/再配布/宣伝/地域/期間・生成履歴・表示義務・確認者を記録し、個人情報や契約秘密そのものは製品へ入れない。

製品側は承認済みoriginal packだけを含める。fan packを無効化したまま同梱したり、隠し切替・DLC・demoに残したりしない。来歴不明・キー欠落時にfan素材へfallbackしない。独自の仮素材での開発継続と、販売に使える承認済み素材を区別する。

既存の都市名は`CommunityType`と保存値に入り込んでいるため、中立IDへの変換表が必要。商用版は別保存領域を初期値とし、fan版からの取込を採用する場合だけ明示的な移行を設計する。元セーブを上書きせず、未知のID・旧名称・途中商戦・ユーザー入力・schema不一致を検査する。現在の保存データや現fan版を本書に基づいて削除しない。

## 5. 持続可能な2Dレンダラ仕様

### 5.1 確認済みの足場と未確認の点

読み取り時の`BattleCapitalCanvas.tsx`はCanvas2Dを使用し、scene型、描画metrics、画像sprite、完成山用の別canvas cache、requestAnimationFrame、ResizeObserver、省モーション処理を持つ。`battleCanvasQuality.ts`は30fps時DPR上限1.5、60fps時2を設定する。`battlePresentation.ts`には片側18列・論理列高上限512、`battleCapitalCanvasLayout.ts`には`[4,5,5,4]`の列配置と最低8層の表示設定がある。

これは構造と定数の確認であり、最低機のfps・発熱・memory・描画の正しさを今回実測した結果ではない。既存`docs/romasaga3-trade-*.md`等の原作比較・18アンカー・165ms×最大9waveは現fan版の回帰基準である。将来の独自版では読みやすさ・資金量の理解を目的に視覚仕様を別に決める。原作とのピクセル一致・音の酷似を商用版の合格条件にはしない。本書は既存基準や並行実装を上書きしない。

### 5.2 提案する設計契約

| 項目 | 将来版の要件案 |
| --- | --- |
| 描画backend | Canvas2Dを基準候補にする。WebGL2等への変更は同じscene・試験条件の実測比較で判断。Unity化やGPU化そのものを販売準備の条件にしない |
| scene入力 | 両陣営の確定量、進行中packet、蓄積分、所有率、風・圧力、演出serial、seed、時刻を値として渡す。表示倍率はrulesを変えない |
| skin入力 | コイン・台座・人物・背景のsprite、pivot、crop、palette、音event、fontをデータ化。現行の画像直接import・特定素材のcrop値は交換境界へ移す |
| 資金表現の上限 | 大きな金額は単位・集約・段階で表現し、金額に比例したDOM、canvas、粒子、音源nodeを生成しない。列数、同時packet、cache、queueに明示的上限を持つ |
| 描画順 | 背景、台座と完成山、移動中資金、人物、前壁・前線、情報UIの遮蔽規則を固定。表示額とrulesの額を対応付け、集約しても勝敗の根拠を誤表示しない |
| clock | 単一の描画loopを使い、fpsとゲーム進行を分離。省モーション・低fps・非表示からの復帰で重複投入や二重精算を起こさない。遅延eventの表示集約でも最終状態は失わない |
| 静止・cache | 静止時はdirty更新のみ。重い完成山cacheは列構成・skin・layout・DPRの変更で無効化し、軽い所有率変更だけで作り直さない |
| lifecycle | resize、向き変更、画面再表示に対応。unmountでRAF・observer・音声・cacheの参照を解放。背景化で装飾描画を止め、復帰時は確定sceneへ同期 |
| 可読性 | 背景canvasの密度と、文字・ボタンの可読性を分ける。操作UIは意味のあるDOM等で保持し、色、形、ラベルを併用。絵だけの重要情報には同等の説明を設ける |
| pixel表現 | 意図するspriteはアスペクト比とsampling規則を保持。任意DPRで隙間・位置ずれ・ぼけが出る条件を試験。新skinの接地・遮蔽も検査 |
| 音 | 演出eventから一度だけ発音し、同時発音数・gain・buffer数を制限。mute、取得失敗、中断後の再開でも操作や進行を止めない |
| 障害 | Canvas2D初期化・素材読込に失敗したら説明と回復導線を提示し、少なくとも残高・戦況を確認できるUIを保つ。WebGL2採用時はcontext喪失とCanvas2Dへの一度の切替も設計 |
| 保守 | scene fixture、seed付きevent log、performance計測をbackend共通にする。素材交換のたびに戦闘本体を改修する構造を避ける |

### 5.3 性能・品質予算案（未測定）

最低対応機・runtime・解像度が未確定の間は性能gateを閉じない。次の数値は出荷候補を比較するための初期案であり、実測して販売責任者と技術担当が確定する。

| 対象 | 暫定予算・試験案 |
| --- | --- |
| frame | 標準60fps、低負荷30fpsの2profile。CPU側の描画処理時間p95は各6ms / 10ms以下を候補とし、別途frame間隔・miss率・GPU待ちを測る。平均fpsだけで合格にしない |
| 解像度 | 現行のDPR上限1.5/2を比較の初期値とする。viewportとmemory予算でさらに制限し、入力座標はCSS座標と正しく変換 |
| memory | 可視canvasとcacheの総backing pixelsを800万pixel以下とする案。RGBAだけなら約32MBという概算であり、GPU複製・texture・デコード画像等は別に実測する |
| 応答 | 入力受付を100ms以内に視覚応答する案。演出終了まで待つ操作は待ち状態を説明し、長押し・連打でqueueを無制限に積まない |
| 長時間 | warm-up後の最大負荷5分、30分連続play、商戦開閉100回で計測。GC後の保持memory、canvas数、音源数が反復に伴って増え続けないこと |
| 同一性 | 同じseedとcommand列で30/60fps、省モーション、向き変更、中断復帰の結果・精算・進行が一致すること |
| 表示 | 少額、最大額、連続投入、両陣営同時、蓄積移送、勝敗停止を比較。文字拡大、DPR1/1.5/2/3、1280×720・1920×1080、Web提供時390×844・844×390を候補にする |
| 証拠 | OS、CPU/GPU、RAM、runtime、build hash、scene、設定、計測区間、p50/p95/max、画像・動画を記録。エミュレーションだけで実機保証しない |

WebGL2を検討する場合も、この入力契約と試験を再利用し、canvas/texture/bufferの破棄、固定pool、context復元、fallback時の音・event二重実行を確認する。新backendが速いという推測をもって現rendererを交換済み・商用品質と記録しない。

## 6. P0出荷gate

ここでP0は本プロジェクトが提案する発売停止条件であり、Steamが定義した品質規格ではない。各gateは担当、証拠、判定日、配布候補hashを持つ。未確認も未達として扱う。条件付き承認で残すリスクは明記し、権利不明の素材を例外として出荷しない。

| ID | gate / 担当案 | 合格証拠 | 2026-08-30時点 |
| --- | --- | --- | --- |
| P0-01 | 権利台帳 / 制作・販売責任者 | 全出荷素材・文章・コード・販促物の来歴と必要権利、第三者要素の処理、確認者。疑義があるものは権利者・専門家確認 | 未達。公式素材が残り、独自扱い素材の来歴も未確認 |
| P0-02 | 世界・名称・表現 / 編集・美術・音 | 独自設定集、名称審査、全台詞・画像・SE・ロゴの交換一覧と目視・試聴。旧作品への依存表現が製品へ漏れない | 未達。コード・UI・データ・宣伝面に広く残存 |
| P0-03 | 配布物の分離 / build担当 | 許可リスト、全ファイルmanifestとhash、バイナリを含む検査。旧fan kit・不要な資料・隠し素材・元音源が含まれない | 未達。現Pages workflowはfan kitを全量コピー |
| P0-04 | font・依存条件 / 技術・権利担当 | 出荷runtimeのSBOM、versionごとのlicense本文、必要NOTICE/credit、font使用範囲。source提供等が必要なら対応記録 | 未確認。lock宣言の棚卸しのみ |
| P0-05 | 保存と移行 / platform担当 | 新旧保存領域の分離、破損・容量不足・途中終了・更新・必要なら取込試験。元セーブを失わず、旧名称を無意識に再表示しない | 未達。都市名等が保存・型に結合 |
| P0-06 | 完走と数値整合 / gameplay・QA | 新規開始から出荷範囲の結末まで実操作で完走。敗北・再挑戦・精算・解放・資金上限・二重操作を検証。難易度目標と欠陥一覧 | 未確認。現fan版の既存検査は商用版の完走証拠ではない |
| P0-07 | 描画と安定性 / renderer・QA | 確定最低機で§5の性能・memory・表示・復帰試験、backend変更後の同一性。進行不能・黒画面・破損ゼロ | 未確認。並行作業中、本担当は実行計測していない |
| P0-08 | 入力・可読性・音 / UI・QA | 対応入力で全操作、focus復帰、文字拡大、色以外の予兆、mute、省モーション、音再生失敗時の完走 | 未確認。既存部分QAだけで全対応を宣言しない |
| P0-09 | 配布候補の再現 / build担当 | 固定lockとclean環境から再現build、実際のpackageで起動・終了・更新・offline・素材解決、secret・不要APIなし、戻せる配布履歴 | 未達。商用desktop package/runtime・更新方法が未確定 |
| P0-10 | Content Survey / 販売責任者 | 実build・宣伝と一致した全項目、AI生成履歴、申告の控え、変更時の再確認。対象地域の年齢表示等も確認 | 未確認。申告・アカウントにはアクセスしていない |
| P0-11 | ストアと販促 / 販売・広報 | 独自版から撮った画像・動画、権利済みcapsule/logo、実装済み機能・言語・OSのみの説明、価格・連絡先、必要なページ/build承認 | 未達。新製品用素材・申請証拠なし |
| P0-12 | 運営と発売判断 / 販売責任者 | 対象地域の販売条件・税務等の確認、契約と必要な待機期間、問い合わせ・不具合・返金窓口、更新・撤回手順、最終承認 | 未確認。仕様文書だけで承認済みとしない |

P0-01〜09の合格は主に内部の準備完了、P0-10〜12には外部手続きと販売責任者の判断を含む。全ての記録がそろっても、後から第三者の権利問題が生じないことを保証するものではない。Steam側の「Ready for release」と、本書の「準備完了」、権利者からの許諾を同じ欄にまとめない。

## 7. 現在の未達事項と次の確認順

1. **まず権利と製品の範囲を確定する。** 現fan版には公式画像・SE・固有名詞・設定が残る。新作の設定・販売先・対応機・収録範囲を決め、独自扱い素材とコードの来歴を含む台帳を作る。生成画像の利用条件、元資料、第三者への類似性は別々に確認する。
2. **差し替え境界を設計する。** `fankitAssets.ts`の集約は足場になるが、world/text/metadata/saveまでの完全なpack分離は確認できない。`CommunityType`と保存値の名称結合を先に解く計画が必要。formatter、alt、debug文字列、旧セーブ、未使用素材を忘れない。
3. **配布方法とruntimeを決める。** 現在はWeb向けで、Steam用desktopの完成package・depot・起動設定の証拠はない。既存の`npm run build`は`build:game`＋vinext buildであり、商用desktopの完成とは別。`build:pages`ではfan kitの後段コピーに注意する。
4. **依存・fontを実物で確認する。** npm/pnpmのlockが両方あるため採用する再現経路を一本定め、その解決結果と配布物を照合する。全依存がMIT/ISCとは言わない。OSフォント、画像内の文字、ストア用ロゴ、runtime内蔵fontも対象にする。
5. **独自素材で製品試験を行う。** `package.json`に`lint`、`check:balance`、`check:progression`、`check:readiness`、`check:simulations`、`check:visuals`、`check:capital-contact`が存在する。ただし今回実行していない。既存画像・音に依存する基準を整理し、商用版のfixture、全編play、実機性能を追加する。
6. **申告・審査・運営を仕上げる。** 今回Steamworks上の契約・fee・待機・survey・承認状態は未確認。新buildと販促物を確定して申告を行い、審査と修正期間を見込む。発売操作は別途、販売責任者が判断する。

既存`design-qa.md`には序盤の実操作、代表的な後半画面、自動simulation等の記録がある一方、全編実操作・実機GPU・音・完全なアクセシビリティの証明ではない旨も記載されている。その記録を無効扱いにはしないが、新商用版の合格証へ読み替えない。文書間で旧仕様と新仕様が混在する箇所はrenderer担当の成果確定後に照合する。

本担当はbuildや検査scriptを実行していない。生成物を書き換えたり並行作業へ干渉したりせず、文書と証拠の整理に限定した。以下は今回の調査と同種の**読み取り専用**検索例である。検索一致ゼロだけで権利処理の完了とはしない。

```powershell
rg --files src app public docs scripts .github
rg -n -i 'ffxiv|ff14|final.?fantasy|square.?enix|fankit|タタル|エオルゼア|ギル|romasaga|ロマンシング|copyright|license' src app index.html metadata.json public/manifest.webmanifest README.md docs
rg -n 'font-family|@font-face|fonts\.|createOscillator|AudioBuffer|FANKIT_AUDIO|GAME_AUDIO' src app
rg --files --hidden -g '*LICENSE*' -g '*NOTICE*' -g '*.woff*' -g '*.ttf' -g '*.otf' -g '*.mp3' -g '*.ogg' -g '*.wav' -g '!node_modules' -g '!.git'
```

## 8. 出典と確認日

全て**2026-08-30**に公開ページの本文を確認。確認日は文書の改訂日を意味しない。引用は要旨であり、申請・契約・発売前にはその時点の全文とアカウント内の適用条件を再確認する。非公開のSteam Distribution Agreement本文や個別許諾契約を読んだとは主張しない。

| ID | 公式一次資料 | 本書で確認した点 | 確認日 |
| --- | --- | --- | --- |
| S1 | [Square Enix: ファイナルファンタジーXIV 著作物利用条件](https://support.jp.square-enix.com/rule.php?id=5381&la=0&tag=authc) | 対象・商用制限・音楽・表記・地域等 | 2026-08-30 |
| S2 | [FFXIV公式ファンキット: スマートフォン用着信音](https://jp.finalfantasyxiv.com/lodestone/special/fankit/smartphone_ringtone/) | SEの配布用途と利用条件への案内 | 2026-08-30 |
| S3 | [Steamworks: Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding) | 第三者権利、契約・登録、待機・Coming Soon | 2026-08-30 |
| S4 | [Steamworks: Review Process](https://partner.steamgames.com/doc/store/review_process) | ページ・buildの審査基準と時間の目安 | 2026-08-30 |
| S5 | [Steamworks: Release Process](https://partner.steamgames.com/doc/store/releasing) | 2つのchecklist、申請順序、承認と発売操作の分離 | 2026-08-30 |
| S6 | [Steamworks: Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey) | 一般・成人・生成AI申告、変更時の手続き | 2026-08-30 |
| S7 | [itch.io: Terms of Service](https://itch.io/docs/legal/terms) | Publisher Contentと第三者権利の責任 | 2026-08-30 |

ローカル根拠: `package.json`、`package-lock.json`、`.github/workflows/deploy-pages.yml`、`README.md`、`CHATGPT_UPDATE_HANDOFF.md`、`design-qa.md`、`docs/content-data-map.md`、`docs/romasaga3-trade-reference.md`、`docs/coin-webgl2-fallback-guide.md`、および§3・§5に記したソース。これらの自作・許諾・QAに関する記述は証拠の手掛かりであり、契約原本や商用版の試験結果そのものではない。
