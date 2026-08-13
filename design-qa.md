# Coin overflow design QA

- Source visual truth: `D:\Desktop\trade.png` and the observed coin sequences in `xdusHCc07dY` / `t062klBNc4k`.
- Implementation screenshots:
  - `D:\CodexHome\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-overflow-matched-base.png`
  - `D:\CodexHome\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-overflow-matched-tier1.png`
  - `D:\CodexHome\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-overflow-tier3-done.png`
- Combined comparison: `D:\CodexHome\visualizations\2026\08\08\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\coin-design-comparison.png`
- Viewport: a 402 × 414 live capital field inside the 402 × 874 mobile shell; the complete game was also checked at the in-app Browser's wide viewport.
- States: pre-overflow, first overflow while bundles are falling, maximum bounded overflow, and the first live campaign battle.

## Full-view comparison evidence

The completed four-row treasury stays broad and dense rather than forming a central peak. On the first real overflow crossing, the completed pile and pedestal move down while the incoming three-to-six-coin bundles remain in flight. At the maximum tier, the footing leaves the viewport and the full-width coin wall remains visible, matching the reference behavior rather than hiding the accumulated coins.

## Focused comparison evidence

The matched pre-overflow/first-overflow captures confirm that the pile moves down by a visible authored step without shrinking its coin width. The mid-transition capture confirms separate completed-pile and incoming-bundle layers. The combined source/implementation image confirms dense horizontal spacing, broad shoulders, metallic rims and a non-pointed top. A separate focused typography comparison was not needed because this change does not alter text or controls.

## Required fidelity surfaces

- Fonts and typography: unchanged; no Canvas text or application copy was added.
- Spacing and layout rhythm: coin pitch remains responsive and dense in portrait and landscape; the overflow shift creates visible upper headroom without changing the field or control footprint.
- Colors and visual tokens: existing player-gold, enemy-red, cyan/red pressure colors and casino background are preserved.
- Image quality and asset fidelity: existing high-quality procedural Canvas coins and raster battlefield backdrops are preserved; no placeholder or substitute asset was introduced.
- Copy and content: unchanged.

## Findings

- P3: At the maximum bounded tier the current wall is flatter than the stepped example in `trade.png`. This is acceptable for this pass because the video reference also shows a near-flat extreme wall, and the user explicitly rejected a pointed central mountain. A later polish pass could retain a one-coin shoulder variation without changing overflow behavior.

## Interaction and runtime checks

- First-tier and third-tier controls were exercised in the local visual harness.
- The real first campaign battle was opened and its opening enemy pile rendered correctly.
- Browser console: zero errors and zero warnings; only Vite connection and React development information messages.
- Static and deterministic checks cover portrait/landscape shift, rack/stack separation, incoming bundle cadence, no pre-lowering, and final footing retention.

## Comparison history

1. Initial implementation showed the pile growing and scrolling from the same depth value, visually cancelling the descent.
2. The renderer was split into completed-pile `rackDepth` and absorbed-overflow `stackDepth`, with a 180ms accelerating descent and concurrent incoming bundles.
3. Post-fix captures show a visible lower tray, continuing falling bundles, and a readable maximum wall. No P0/P1/P2 findings remain.

final result: passed
