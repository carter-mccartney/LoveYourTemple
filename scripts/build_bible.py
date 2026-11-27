"""
Builds the app's Bible files from public-domain JSON texts
(github.com/scrollmapper/bible_databases, folder formats/json: KJV.json, ASV.json, YLT.json, BBE.json).

Writes:
  public/bible/<version>/<01..66>.json   one book: [[verse text, ...] per chapter]
  src/lib/bible/verse-counts.json         [[verses per chapter] per book]  (from the KJV)

Usage:  python scripts/build_bible.py path/to/folder/with/the/json/files
"""
import json
import pathlib
import sys

VERSIONS = ["KJV", "ASV", "YLT", "BBE"]


def clean(version, text):
    text = " ".join(text.split())
    if version == "YLT":
        text = text.replace("`", "’")  # YLT uses backticks as apostrophes
    return text


def main(src):
    src = pathlib.Path(src)
    root = pathlib.Path(__file__).resolve().parent.parent
    counts = None
    for v in VERSIONS:
        books = json.loads((src / f"{v}.json").read_text(encoding="utf-8"))["books"]
        assert len(books) == 66, (v, len(books))
        shape = [[len(c["verses"]) for c in b["chapters"]] for b in books]
        if counts is None:
            counts = shape
            assert sum(map(len, shape)) == 1189 and sum(map(sum, shape)) == 31102
        assert shape == counts, f"{v} versification differs from KJV"
        out = root / "public" / "bible" / v.lower()
        out.mkdir(parents=True, exist_ok=True)
        for i, b in enumerate(books, 1):
            chapters = []
            for c in b["chapters"]:
                verses = sorted(c["verses"], key=lambda x: x["verse"])
                assert [x["verse"] for x in verses] == list(range(1, len(verses) + 1)), (v, b["name"], c["chapter"])
                chapters.append([clean(v, x["text"]) for x in verses])
            (out / f"{i:02d}.json").write_text(json.dumps(chapters, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{v}: 66 books written to {out}")
    dest = root / "src" / "lib" / "bible" / "verse-counts.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(counts, separators=(",", ":")), encoding="utf-8")
    print(f"Verse counts: {dest}")


if __name__ == "__main__":
    main(sys.argv[1])
