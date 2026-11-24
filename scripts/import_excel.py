"""
Reads the Excel workbook (ExerciseTracker / GoalTracker sheets) and writes either:

  * src/data/excel-history.json — offered by local builds on first run, or
  * a backup file (--backup OUT.json) — load it in any copy of the app, including the
    live site, with Settings → Import CSV / JSON.

If scripts/personal-settings.json exists (git-ignored), its values — body weight,
nutrition goals, name — are bundled in and applied on import.

Usage:  python scripts/import_excel.py "path/to/Fitness.xlsm"
        python scripts/import_excel.py "path/to/Fitness.xlsm" --backup exports/loveyourtemple-import.json
Requires: pip install openpyxl
"""
import argparse
import datetime as dt
import json
import pathlib

import openpyxl

NAME_FIX = {"Pushups": "Push Ups", "Pushup": "Push Ups", "Push ups": "Push Ups"}
HERE = pathlib.Path(__file__).resolve().parent
NUTRITION_DEFAULTS = {"kcal": None, "proteinMin": 150, "carbsMax": None, "sugarMax": 50, "addedSugarMax": 25}


def norm(name):
    name = (name or "").strip()
    return NAME_FIX.get(name, name)


def read_workbook(path, with_offset):
    wb = openpyxl.load_workbook(path, data_only=True)  # cached values, not formulas

    sets = []
    for _date, t, ex, amt, _ts, _rest, notes in wb["ExerciseTracker"].iter_rows(min_row=2, max_col=7, values_only=True):
        if t is None or amt in (None, ""):
            continue
        # Excel times are this PC's local time. The backup carries the UTC offset so the cloud
        # database stores the right instant; the first-run file stays naive for the browser.
        stamp = t.astimezone().isoformat(timespec="seconds") if with_offset else t.strftime("%Y-%m-%dT%H:%M:%S")
        sets.append({"performed_at": stamp, "exercise": norm(ex), "reps": int(amt),
                     "notes": (notes or "").strip(), "workout_id": None})

    goals = []
    for d, _day, ex, amount, title, notes in wb["GoalTracker"].iter_rows(min_row=2, max_col=6, values_only=True):
        if d is None:
            continue
        goals.append({"goal_date": d.strftime("%Y-%m-%d"), "exercise": norm(ex) or None,
                      "target": int(amount) if isinstance(amount, (int, float)) else None,
                      "title": (title or "").strip(), "notes": (notes or "").strip()})
    return sets, goals


def personal_settings():
    p = HERE / "personal-settings.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook", nargs="?", default="Fitness.xlsm")
    ap.add_argument("--backup", help="write an app backup file here instead of src/data/excel-history.json")
    args = ap.parse_args()

    sets, goals = read_workbook(args.workbook, with_offset=bool(args.backup))
    settings = personal_settings()

    if args.backup:
        if settings:
            # The app's restore replaces the nutrition block whole, so send it complete.
            settings = {**settings, "nutrition": {**NUTRITION_DEFAULTS, **settings.get("nutrition", {})}}
        out = pathlib.Path(args.backup)
        body = {"app": "loveyourtemple", "version": 2, "exported_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
                "source": pathlib.Path(args.workbook).name, "sets": sets, "goals": goals,
                "workouts": [], "foods": [], "food_logs": []}
        if settings:
            body["settings"] = settings
    else:
        out = HERE.parent / "src" / "data" / "excel-history.json"
        body = {"source": pathlib.Path(args.workbook).name, "sets": sets, "goals": goals, "settings": settings}

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(body, indent=1), encoding="utf-8")
    print(f"Wrote {len(sets)} sets and {len(goals)} goals to {out}")
    if sets:
        days = sorted(s["performed_at"][:10] for s in sets)
        print(f"Sets span {days[0]} .. {days[-1]} ({len(set(days))} days)")


if __name__ == "__main__":
    main()
