"""
One-time importer: reads the Excel workbook (ExerciseTracker / GoalTracker sheets)
and writes src/data/excel-history.json, which the app offers to load on first run.

If scripts/personal-settings.json exists (git-ignored), its values — body weight,
nutrition goals, name — are bundled in and applied on import.

Usage:  python scripts/import_excel.py "path/to/Fitness.xlsm"
Requires: pip install openpyxl
"""
import json
import pathlib
import sys

import openpyxl

NAME_FIX = {"Pushups": "Push Ups", "Pushup": "Push Ups", "Push ups": "Push Ups"}


def norm(name):
    name = (name or "").strip()
    return NAME_FIX.get(name, name)


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)  # cached values, not formulas

    sets = []
    for _date, t, ex, amt, _ts, _rest, notes in wb["ExerciseTracker"].iter_rows(min_row=2, max_col=7, values_only=True):
        if t is None or amt in (None, ""):
            continue
        # Naive local time (no "Z") so the browser parses it in the user's own timezone.
        sets.append({"performed_at": t.strftime("%Y-%m-%dT%H:%M:%S"), "exercise": norm(ex),
                     "reps": int(amt), "notes": (notes or "").strip()})

    goals = []
    for d, _day, ex, amount, title, notes in wb["GoalTracker"].iter_rows(min_row=2, max_col=6, values_only=True):
        if d is None:
            continue
        goals.append({"goal_date": d.strftime("%Y-%m-%d"), "exercise": norm(ex) or None,
                      "target": int(amount) if isinstance(amount, (int, float)) else None,
                      "title": (title or "").strip(), "notes": (notes or "").strip()})

    here = pathlib.Path(__file__).resolve().parent
    personal = here / "personal-settings.json"
    settings = json.loads(personal.read_text(encoding="utf-8")) if personal.exists() else None

    out = here.parent / "src" / "data" / "excel-history.json"
    out.write_text(json.dumps({"source": pathlib.Path(path).name, "sets": sets, "goals": goals, "settings": settings}, indent=1),
                   encoding="utf-8")
    print(f"Wrote {len(sets)} sets and {len(goals)} goals to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Fitness.xlsm")
