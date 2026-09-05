from __future__ import annotations

import sys
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"required audit source fragment missing in {path}: {old[:80]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def prepare_save() -> None:
    path = Path("scripts/audit-save-load.ts")
    replace_once(
        path,
        "persistPendingBattleSession('normal', INITIAL_PROPERTIES[0], now);",
        "persistPendingBattleSession('normal', INITIAL_PROPERTIES[0], Date.now());",
    )


def prepare_economy() -> None:
    path = Path("scripts/audit-economy-progression.ts")
    replace_once(
        path,
        """  const brokerageFee = Math.round(args.target.marketPrice * 0.03);\n  if (args.funds >= brokerageFee) {\n    return { possible: true, funds: args.funds, waitSeconds: 0 };\n  }""",
        """  const brokerageFee = Math.round(args.target.marketPrice * 0.03);\n  const requiredFunds =\n    brokerageFee + Math.round(args.target.marketPrice * 0.8);\n  if (args.funds >= requiredFunds) {\n    return { possible: true, funds: args.funds, waitSeconds: 0 };\n  }""",
    )
    replace_once(
        path,
        "const waitSeconds = Math.ceil((brokerageFee - args.funds) / passiveRevenue);",
        "const waitSeconds = Math.ceil((requiredFunds - args.funds) / passiveRevenue);",
    )
    replace_once(
        path,
        "'画面操作待ちと演出時間は除外し、戦闘ロジック上の秒数と仲介手数料不足を埋めるオンライン待機時間を集計します。',",
        "'画面操作待ちと演出時間は除外し、各戦闘前に仲介手数料と市場価格80%の持込現金を確保するオンライン待機時間を集計します。',",
    )


def main() -> None:
    tasks = set(sys.argv[1:])
    if not tasks:
        raise SystemExit("usage: prepare-tataru-audits.py save|economy [save|economy]")
    if "save" in tasks:
        prepare_save()
    if "economy" in tasks:
        prepare_economy()
    unknown = tasks - {"save", "economy"}
    if unknown:
        raise SystemExit(f"unknown task(s): {', '.join(sorted(unknown))}")


if __name__ == "__main__":
    main()
