# Coin overflow and stack-sound design QA

- Source visual truth: `D:\Desktop\trade.png` and the observed coin sequences in `xdusHCc07dY` / `t062klBNc4k`.
- Implementation screenshots:
  - `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-402-tier1.png`
  - `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-final-descent.png`
  - `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-430-tier3.png`
- Combined comparison: `C:\Users\yutto\.codex\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-refine-comparison.png`
- Viewports: 402 × 874 and 430 × 932 phone shells, each with the production-height 414px capital field.
- States: settled first overflow, overflow descent with incoming bundles, maximum bounded overflow, and a 2.8-second audio stream.

## Full-view comparison evidence

The tall-phone layout now leaves a deliberate centre aisle between the two treasuries while keeping the reviewed coin size and dense four-row construction. Tier one leaves the pedestal visibly inside the field; tier two approaches the lower mask; tier three sends the footing below the viewport while retaining the complete visible wall. The completed pedestal, glow, columns and loose coins descend together instead of splitting across two floor positions.

## Focused comparison evidence

The transition capture shows separate completed-pile and incoming-bundle layers: short three-to-five-coin packets keep falling while the finished mountain accelerates down. The source/implementation comparison confirms broad shoulders, a non-pointed top, individual metallic rims and a centre gap close to the original trade screen. Focused audio analysis measured roughly 60–75ms between metallic pulses; the implementation reuses the approved recorded tick in a 1,056ms cached loop with subtle, non-alternating pitch and volume variation.

## Required fidelity surfaces

- Fonts and typography: unchanged; the Canvas adds no text and the QA overlay only marks the existing readout safe zone.
- Spacing and layout rhythm: each side occupies 44% of the field with a 3% outer inset, a 41.36% pedestal and at least 8% centre pile gap at both 402px and 430px widths.
- Colors and visual tokens: existing player-gold, enemy-red, cyan/red pressure colors and casino background are preserved.
- Image quality and asset fidelity: the existing high-quality coin renderer and raster battlefield backdrops are preserved; no placeholder asset was introduced.
- Copy and content: unchanged.

## Findings

- P3: The maximum wall is flatter than the stepped `trade.png` example. This remains acceptable because the referenced extreme-capital video also resolves to a near-flat wall and the requested pass prioritizes descent, portrait balance and sound rather than changing the approved coin appearance.

## Interaction and runtime checks

- Base, descent, first-tier and maximum-tier controls were exercised at both portrait widths.
- The 2.8-second stack loop started and stopped through a user gesture with no console error or warning.
- The sound path uses one looping `AudioBufferSource` per active side instead of creating roughly fifteen sources per second.
- Static checks cover 402/430 width, pedestal and pile gaps, portrait/landscape stops, pile/hoard/glow cohesion, short bundles, cached audio cadence and renderer cleanup.

## Comparison history

1. The prior pass restored descent, but the glow and overflow coins stayed on the old floor and made the mountain appear visually split.
2. The portrait trays still occupied 47.6% per side, leaving almost no centre aisle; tier one moved farther down than its eight new layers grew upward.
3. The completed visual group now shares `baseY`; portrait trays use 44% side areas, tier stops are 10/18/27%, and incoming bundles begin below the readout.
4. The repeated 66ms tick scheduler was replaced by one cached loop voice with measured 60–75ms micro-cadence and a short stop fade. No P0/P1/P2 findings remain.

final result: passed
