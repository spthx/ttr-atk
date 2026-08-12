# Coin pile visibility design QA

- Source visual truth: `D:\CodexHome\codex-remote-attachments\019fe2fd-49a1-7ea1-90c6-70bec3ee5db1\DA2B54B1-DB9F-4438-8A8E-79CFA2850E55\1-写真1.jpg`
- Primary implementation capture: `D:\CodexHome\visualizations\2026\08\13\coin-rack-safe-scroll\implementation-clean-live-402x874.png`
- Landscape implementation capture: `D:\CodexHome\visualizations\2026\08\13\coin-rack-safe-scroll\implementation-clean-live-874x402.png`
- Extreme overflow captures: `D:\CodexHome\visualizations\2026\08\13\coin-rack-safe-scroll\implementation-overflow-field-402x874.png`, `D:\CodexHome\visualizations\2026\08\13\coin-rack-safe-scroll\implementation-overflow-field-874x402.png`
- Combined comparison: `D:\CodexHome\visualizations\2026\08\13\coin-rack-safe-scroll\reference-vs-implementation-402x874.png`
- Viewports: 402×874 and 874×402
- State: first normal battle, after one all-in investment; separate deterministic extreme-capital renderer probe

## Full-view comparison evidence

The combined reference/implementation image confirms that both treasuries begin on a visible shared floor and grow upward. The implementation keeps the ownership gauge, invested totals, actors, action controls, and investment button readable while restoring the coins as the visual focus. The browser chrome in the supplied iPhone photo is outside the game viewport and is not treated as an implementation mismatch.

## Focused region evidence

The battle-field region was checked separately at both orientations. At normal capital, the full pedestal and every completed stack remain visible. At extreme capital, the columns form a broad, near-flat wall; the lower footing alone scrolls out after the tallest stack reaches the safe top line. The top remains visible below the portrait and landscape gauge/readout bands. No center-pointed triangular pile remains. A separate crop was unnecessary because the battle field occupies the dominant region in each saved implementation capture.

## Required fidelity surfaces

- Fonts and typography: existing game typography, hierarchy, wrapping, and numeric readouts are unchanged.
- Spacing and layout rhythm: no horizontal overflow at either viewport; dense landscape columns retain only small, even gaps.
- Colors and visual tokens: existing gold/player and red/enemy palettes, ownership colors, and casino backdrop are preserved.
- Image quality and asset fidelity: existing character and backdrop assets remain; Canvas coins retain highlights, rims, seams, and medallion tops without placeholder art.
- Copy and content: no player-facing copy changed; invested totals and the investment-button amount remain visible.

## Findings

No actionable P0, P1, or P2 mismatch remains for the requested coin-growth and overflow behavior.

## Comparison history

1. Earlier finding (P1): a heavy command latched a lowered rack and synthesized an overflow tier before the new coins arrived, so the screenshot appeared to hide coins below the field.
2. Fix: removed command-triggered pre-lowering, derived scrolling from completed visible column height, added only real overflow height, and pinned the tallest top to an orientation-safe line.
3. Post-fix evidence: normal and extreme captures show upward growth first, visible broad stacks, and lower-edge scrolling only after true overflow.

## Interaction and runtime checks

- Opened a normal battle and executed an all-in investment at 402×874.
- Rotated the active battle to 874×402.
- Canvas count: 1; retired `.capital-fixed-column` count: 0.
- Horizontal overflow: 0px at both viewports.
- Console errors/warnings: 0 in a fresh Browser tab.

## Follow-up polish

None required for this correction. Future coin-art changes should preserve the same visibility and safe-line contracts.

final result: passed
