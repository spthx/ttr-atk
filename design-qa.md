# Product Design QA — SFC序盤スケールと選択導線（2026-08-22）

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
