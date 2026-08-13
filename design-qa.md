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
