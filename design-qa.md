# Product Design QA — 軽量化・音声・残留落下（2026-08-23 継続監査）

- final result: passed; static, numerical and production build gates completed
- source sequence: `tmp/rs3-analysis/01-stack-sequence.jpg`
- audio source: `tmp/rs3-analysis/sfc-coin-event.wav`
- implementation audio: `public/game-audio/capital-rapid-fire.mp3`

## Current evidence and decisions

1. SFC別録画では主要な厚い束の後、300.9〜301.4秒／303.5〜303.6秒に薄い楕円状の残留落下物が1〜2個見える。ただし安定後には残らない。
2. ユーザー実機では孤立した薄い形状が「一枚だけ空中に浮く」退行として見えたため、現製品はairborneも最低束の厚みを維持する。原作観測と製品判断を混同しない。
3. 165msは1ページ1.40〜1.534秒÷9波の範囲内。99ms microtickと396ms強拍は原作認証値ではなく、現行素材を密に聞かせる演出契約としてのみ維持する。
4. 原作抽出と実装素材のスペクトル重心は1.47kHz／1.58kHzだが、帯域構成と波形相関は一致しない。「連続した金属的積載音」以上の酷似は未認証。
5. 所有率変化が完成山キャッシュを無効化していた。矢印帯を直接描画し、透明な完成山だけをキャッシュすることで、10Hz更新時の長柱再描画を除去した。
6. 左右の列幾何を完成山・incoming・台座前壁ごとに作り直さず、1 paintにつき各陣営1回へ統合した。台座14スライスも定数化した。

## Current priority gate

- P0: ownership-only update rebuilding settled coin seams — fixed
- P1: repeated geometry and pedestal-slice allocation — fixed
- P1: active-column before/after pile cache — pending real-device GPU trace
- release gate: lint、visual/capital-contact、balance、readiness、progression、500戦simulation、exact `npm run build`、diff-check — passed
- evidence limit: current Browser/Edge performance trace is unavailable in this task; visual geometry is intentionally unchanged

---

# Product Design QA — SFCピクセル投影・着地同一性（2026-08-22 継続監査）

- final result: passed; browser comparison and full release gate completed
- source + implementation, same comparison input: `artifacts/capital-pixel-audit-2026-08-22/14-source-vs-implementation-pixel-study.jpg`
- source state: SFC第一部 02:28.091前後、18アンカー着地後
- implementation state: `capital-contact-audit.html?units=18`、同じ18アンカー1巡
- minimum bundle: `docs/evidence/capital-pixel-minimum-v2.png`
- wide pyramid: `docs/evidence/capital-pixel-pyramid-wide.png`
- portrait mirror: `docs/evidence/capital-pixel-pyramid-portrait-dpr2.png`
- large landing: `docs/evidence/capital-pixel-large-landing-v2.png`
- real beginner battle: `docs/evidence/capital-pixel-game-beginner-ready.png`
- real first investment: `docs/evidence/capital-pixel-game-beginner-first-invest.png`

## Current evidence and fixes

1. SFCの18束は低い直方体ではなく、奥から`[4,5,5,4]`が大きな縦段差を持つ疑似立体ピラミッド。旧row base`[0.34,0.44,0.54,0.64]`を`[-0.62,-0.20,0.22,0.64]`へ改めた。
2. 金貨PNGのα=128 bboxは`135,167,1837,397`。透明余白を含むcropを廃止し、見える輪郭で幅高比、段間隔、接地を計算する。
3. 最低8枚束の束高/束幅を原作測定0.78〜0.95へ合わせ、実装0.82〜0.90に固定した。
4. 台座幅を旧7.45束から原作中央値6.5束へ戻し、横pitchを1.05束へ固定した。
5. active列を静止キャッシュから除外。落下中はbefore+incoming、進捗1ではsettledと同じafter山を一度だけ描き、最終フレームの二重αと次フレームの輪郭ジャンプを解消した。
6. 30fps・165msで空中3姿勢＋着地が各1フレーム以上露出することを数値検査した。
7. 1280×720のfixture、390×844・DPR2鏡像、巨額72+198→270、実ゲームのグリダニア初心者戦を新規撮影。背景隙間、薄い単独コイン、台からの浮遊、左右崩れは見つからない。
8. 都市マップ→グリダニア→初心者向け物件→準備→開幕→初回700ギル投入を実操作。次行動、手数料、勝利後報酬が先に見え、詳細フィルタと戦力式は折りたたまれている。

## Current priority gate

- P0: 実αcrop、前壁接地、着地最終フレームの二重描画 — fixed
- P1: 18アンカー奥行き、束高、台座比率、横pitch、縦持ち鏡像 — fixed
- P2: 第2部、音声限界、ピクセル測定の文書共有 — fixed
- static gate: lint、visual/capital-contact、balance、readiness、progression、500戦simulation — passed
- production gate: exact outer `npm run build` and `git diff --check` — passed
- evidence limit: 公開動画は640×360再圧縮。ROM内ドット、OAM、無加工60Hz、原音周期は未認証として分離

---

# Prior QA — SFC台座・最小束・縦横実戦（2026-08-22 最終）

- final result: passed
- source + implementation, same input comparison: `artifacts/capital-contact-audit/final/17-sfc-vs-implementation-v5.jpg`
- original source state: SFC第一部初戦、低資本の片側山＋片側空台
- implementation state: 通常キャンペーン初戦、片側158ギル＋片側空台
- desktop evidence: `docs/evidence/capital-battle-wide.jpg`
- minimum-bundle evidence: `docs/evidence/capital-contact-minimum-wide.jpg`
- portrait evidence: `docs/evidence/capital-battle-portrait.jpg`
- low-landscape result evidence: `docs/evidence/capital-result-landscape.jpg`
- DPR 2 mirror evidence: `docs/evidence/capital-mirror-portrait-dpr2.png`
- large landing/settled top match: `docs/evidence/capital-large-landing-match.png`

## Final evidence and fixes

1. 原作動画と現実装を同じ低資本状態で横並び比較した。左右曲面を変形せず中央64pxだけを12回反復する台座は、一枚の厚い基壇として見え、旧案の二枚皿の継ぎ目はない。
2. 1論理unitは前中央の8枚束となり、前壁が根元を隠す。背景の水平隙間、単独薄板、空中停止はない。
3. 台座占有率は1280×720で27.64%、844×390で22.98%。独立監査のwide 24〜32%、低背20%以上を満たす。
4. 390×844ではプレイヤー人物を68×88pxで外縁へ置き、自社700ギルの前中央山を隠さない。敵人物も山の外縁に留まる。
5. 844×390の結果確定CTAはy=313.375〜357.375、dialog bottom=366.975で全高がスクロール枠内に入る。
6. 独立した前面ブラウザ2回で初戦開始から操作受付まで5.746秒／6.103秒。開始告知と9×165msのSFC積載を含み、20秒超停止は再現しない。357ms差はpage cadenceではなくブラウザ側の開始告知・描画予約の揺れ。
7. 背景を焼き込んだImageGen台座2案と、二枚皿に見えた初期スライス案は採用前に破棄した。
8. 独立監査で、相場2倍以上の巨額入力は落下束より着地後の柱が高くなるP1を発見。各列の実追加層を落下束へ反映し、72＋198 logical unitの着地時と270 unitのsettled山頂をブラウザで一致確認した。
9. 1〜18unitの全中間段階、後方束の手前支持、左右全18アンカーの鏡像、DPR 1／1.25／1.5／2の丸め後接地を基準JSON直結の自動検査へ追加した。

## Release gate

- P0: 最小束接地、完成山保持、意味のない消失なし — fixed
- P1: wide／portrait／low-landscape台座、人物遮蔽、結果CTA、巨額incoming→settled山頂ジャンプ — fixed
- P2: 台座継ぎ目、コメント・README・回帰基準の旧24列／99ms記述 — fixed
- static gate: `npm run check:capital-contact` passed
- browser gate: source + implementation comparison and three responsive viewports passed

---

# Prior QA record — SFC序盤スケールと選択導線（2026-08-22）

> 以下の99ms・旧描画器に関する記録は当時の履歴であり、現行契約ではない。現在の正本は冒頭の最終QAと `docs/romasaga3-trade-reference.md`（18アンカー、最低8枚束、165ms）とする。

- final result: passed after independent fan-panel review findings were addressed
- desktop viewport/state: 1440 × 900、通常キャンペーン開始時の都市マップとグリダニア対象一覧
- mobile viewport/state: 390 × 844、同じセーブ・同じ対象一覧／企業連合未攻略
- SFC reference: `tmp/rs3-analysis/01-stack-sequence.jpg`
- baseline captures: `tmp/design-qa/01-market-selection-top-desktop.png`, `02-market-selection-mobile.png`, `03-alliance-before-desktop.png`, `04-alliance-before-mobile.png`
- prototype captures: `tmp/design-qa/05-market-after-desktop.png`, `07-alliance-after-desktop.png`, `08-alliance-after-mobile.png`, `09-targets-after-desktop.png`, `10-targets-after-mobile.png`
- combined comparisons: `tmp/design-qa/11-market-mobile-before-after.jpg`, `12-alliance-mobile-before-after.jpg`
- final SFC battle captures: `tmp/design-qa/13-sfc-early-9-wave-wide.png`, `14-sfc-early-mobile-390x844.png`, `15-sfc-early-landscape-844x390.png`
- final SFC reference comparison: `tmp/design-qa/16-sfc-reference-vs-current.jpg`

## Full-view comparison evidence

- The original target screen spent most of a 390 × 844 viewport on an expanded tutorial, tooltip and three filters before the first action. The revised screen fits the next recommendation, qualitative readiness, reward, brokerage fee and both opening targets in the same viewport.
- The original alliance screen spent the first viewport repeating the same benefit across four single-column candidates. The revised two-column chooser keeps the four identities visible while bringing the rival objective and first primary action above the fold.
- At desktop width the city map now uses one highlighted `ここから開始` marker and locked-city progression. Target cards keep only the decision layer visible; formulas, synergies, exact revenue and setting copy remain in disclosures.

## Focused SFC and performance evidence

- A 35% opening investment at a 2,000-gil asking price resolves to 18 persistent columns at four-to-five layers; the same ratio at a one-billion-gil asking price reaches at least seventeen layers. The 700-gil opening now uses nine partial-column waves at 99ms each (891ms pour, 1,089ms including preload/settle), preserving the early-game build-up without spending late-game height on chapter one.
- Canvas2D remains the renderer because the scene is a fixed flat 18-column tray. Three.js would add a scene graph and WebGL bootstrap; Unity WebGL would add a runtime and much larger startup cost without reducing the present draw count.
- Off-screen column bodies, seams and top ellipses are culled. Completed towers and their thousands of seam lines are cached once per authored wave; animation frames composite that cache and paint only falling rolls plus the two tray fronts. The terminal sample of each 99ms wave cannot repaint twice. The hidden casino backdrop references were removed, eliminating two generated WebP assets totaling 161,550 bytes.
- 30fps remains the default with DPR capped at 1.5; 60fps retains a DPR 2 cap. The canvas is non-interactive, idle RAF stops, and production output still lazy-loads the battle chunk.

## Iteration history

1. Baseline screenshots exposed tutorial/filter dominance and the vertical alliance candidate wall.
2. The campaign was changed to enter through the existing city map, with one start marker and collapsed guidance.
3. Target cards were reduced to recommendation/readiness/reward/fee; detailed financial data moved into the existing disclosure pattern.
4. Alliance candidates became a compact two-column chooser; each cartel now exposes one next action plus a collapsed full route.
5. Combined before/after images were inspected at matched mobile state. No clipping, horizontal overflow, broken border radius or obscured CTA remained.
6. An SFC-purist pass asked for a slower opening, larger rolls/trays and clearer late-game contrast. The opening became nine beats and the tray/coin geometry grew by roughly 15–20% while retaining four-to-five early layers.
7. An accessibility pass found competing `aria-modal` surfaces and a focus escape. Only the active nested surface is now modal; closed disclosure descendants are excluded, summaries are keyboard reachable and focus cycles without returning to `BODY`.
8. An FFXIV-lore pass found semantic job/action mismatches. Dark Knight and Black Mage now use visually verified matching assets; the enemy acceleration uses Black Mage `黒魔紋`, whose official effect shortens cast/recast time, while the player `疾風怒濤` remains the Romancing SaGa trade-technique homage without a false FFXIV job attribution.
9. A performance pass identified late towers as the remaining low-end risk. The settled-field cache removes per-animation repaint of the completed seam wall; 390×844 and 844×390 still have no horizontal overflow.

## Interaction, accessibility and console checks

- City map → Gridania target list, filter disclosure, target detail disclosure and cartel full-route disclosure were exercised through the in-app browser.
- Fresh page loads reported no current `error` or `warning` console entries. The temporary Vite HMR warning recorded while replacing a source file did not recur after a clean reload.
- Primary controls retain at least 44px touch height; qualitative states are expressed with text as well as color. Locked cities remain disabled and labelled with their prerequisite.
- The final preparation dialog exposes exactly one `aria-modal="true"`; keyboard focus starts on the strategy disclosure and cycles inside the dialog without reaching the document body.
- Independent review was deliberately harsh: an RS3-purist, an FFXIV-lore fan, an AAA UX/accessibility reviewer and a low-end performance reviewer each returned public-release objections. Every P0/P1 code finding was fixed before the final gate; their P2 notes remain documented for future expansion rather than blocking this release.
- `lint`, visual, balance, readiness, progression, 500-battle simulation, exact npm production build and `git diff --check` are rerun at the final release gate.

---

# Product Design QA — コイン投入の質量感とカジノ背景

- final result: passed
- viewport: 402 × 874
- state: プレイヤー既存資本 1.43B ギルへ 2.625B ギルを追加、競合資本 8.39B ギル
- source capture: `C:/Users/yutto/.codex/visualizations/2026/08/08/019fe2fd-49a1-7ea1-90c6-70bec3ee5db1/coin-mass-audit-03-current-fall.png`
- prototype capture: `C:/Users/yutto/.codex/visualizations/2026/08/08/019fe2fd-49a1-7ea1-90c6-70bec3ee5db1/coin-mass-audit-08-patched-matched-wave.png`
- combined comparison: `C:/Users/yutto/.codex/visualizations/2026/08/08/019fe2fd-49a1-7ea1-90c6-70bec3ee5db1/coin-mass-audit-09-matched-comparison.png`
- reference video captures: `coin-mass-audit-ref-a.png`, `coin-mass-audit-ref-b.png` in the same evidence directory

## Findings and resolution

- P1 — The old renderer showed one 3–5 layer bundle per active column, so a large repeated commitment read as only a few dozen coins. Resolved by deriving one to three bounded bundle copies from the current commitment ratio, independent of the square-root-compressed existing pile.
- P1 — Active player coins used the battlefield cyan edge colour for their shadow and top rim. Resolved by separating active coin metal edges into warm gold for the player and warm red metal for the opponent.
- P1 — The approved casino table was obscured by strong territory washes plus a synthetic horizon, veil, and perspective grid. Resolved by restoring restrained territory opacity and removing those synthetic overlays while retaining the ownership frontline and directional pressure chevrons.
- P2 — Extra bundles could merge visually into one another during the fall. Resolved with a compact three-row wave that converges into the same settled column before landing; no bounce, rotation, or amount-proportional particle system was introduced.

## Interaction and implementation checks

- The replay control was exercised and the falling state was captured at the same viewport and capital state as the source.
- One Canvas remains mounted; the renderer stays non-interactive and bounded to at most three copies per active column.
- Final column heights, overflow depth, ownership, cash, AI, battle clocks, and settlement logic remain unchanged.
- Static contracts cover 2% / 5% / 10% / 20% / 35% commitments as 1 / 1 / 2 / 2 / 3 bundle copies and verify that the same commitment keeps the same incoming mass on an established pile.
- Console inspection found no new current-page warnings or errors attributable to the production renderer. The temporary QA route was removed before commit.

---

# Prior QA record — coin overflow and stack sound

- Source visual truth: `D:\Desktop\trade.png` and the observed coin sequences in `xdusHCc07dY` / `t062klBNc4k`.
- Implementation screenshots:
  - `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-402-tier1.png`
  - `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-final-descent.png`
  - `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-430-tier3.png`
- Combined comparison: `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-comparison.png`
- Viewports: 402 × 874 and 430 × 932 phone shells, each with the production-height 414px capital field.
- States: settled first overflow, overflow descent with incoming bundles, maximum bounded overflow, and a 2.8-second audio stream.

## Full-view comparison evidence

The tall-phone layout leaves a deliberate centre aisle between the two treasuries while keeping the reviewed coin size and dense four-row construction. Tier one leaves the pedestal visibly inside the field; tier two approaches the lower mask; tier three sends the footing below the viewport while retaining the complete visible wall. The completed pedestal, glow, columns and loose coins descend together instead of splitting across two floor positions.

## Focused comparison evidence

The transition capture shows separate completed-pile and incoming-bundle layers: short three-to-five-coin packets keep falling while the finished mountain accelerates down. The source/implementation comparison confirms broad shoulders, a non-pointed top, individual metallic rims and a centre gap close to the original trade screen. Focused audio analysis measured roughly 60–75ms between metallic pulses; the implementation reuses the approved recorded tick in a 1,056ms cached loop with subtle, non-alternating pitch and volume variation.

## Required fidelity surfaces

- Fonts and typography: unchanged; the Canvas adds no text and the QA overlay only marks the existing readout safe zone.
- Spacing and layout rhythm: each side occupies 44% of the field with a 3% outer inset, a 41.36% pedestal and at least 8% centre pile gap at both 402px and 430px widths.
- Colors and visual tokens: existing player-gold, enemy-red, cyan/red pressure colors and casino background are preserved.
- Image quality and asset fidelity: the existing high-quality coin renderer and raster battlefield backdrops are preserved; no placeholder asset was introduced.
- Copy and content: unchanged.

## Prior findings

- P3: The maximum wall is flatter than the stepped `trade.png` example. This remains acceptable because the referenced extreme-capital video also resolves to a near-flat wall and the requested pass prioritizes descent, portrait balance and sound rather than changing the approved coin appearance.

## Prior interaction and runtime checks

- Base, descent, first-tier and maximum-tier controls were exercised at both portrait widths.
- The 2.8-second stack loop started and stopped through a user gesture with no console error or warning.
- The sound path uses one looping `AudioBufferSource` per active side instead of creating roughly fifteen sources per second.
- Static checks cover 402/430 width, pedestal and pile gaps, portrait/landscape stops, pile/hoard/glow cohesion, short bundles, cached audio cadence and renderer cleanup.

## Comparison history

1. The prior pass restored descent, but the glow and overflow coins stayed on the old floor and made the mountain appear visually split.
2. The portrait trays still occupied 47.6% per side, leaving almost no centre aisle; tier one moved farther down than its eight new layers grew upward.
3. The completed visual group now shares `baseY`; portrait trays use 44% side areas, tier stops are 10/18/27%, and incoming bundles begin below the readout.
4. The repeated 66ms tick scheduler was replaced by one cached loop voice with measured 60–75ms micro-cadence and a short stop fade. No P0/P1/P2 findings remained in that pass.

final result: passed
