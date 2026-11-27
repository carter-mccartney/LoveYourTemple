// Verse text. Public-domain versions ship with the app (public/bible/<version>/<book>.json,
// loaded one book at a time). ESV and NLT come from their free APIs with your own keys,
// saved on this device only. NKJV, NIV and The Message have no free API — paste the text.
import { book, fmtRef, type Ref } from "./canon";

export interface VersionInfo {
  id: string;
  name: string;
  source: "bundled" | "api" | "paste";
}

export const VERSIONS: VersionInfo[] = [
  { id: "KJV", name: "King James Version", source: "bundled" },
  { id: "ASV", name: "American Standard Version (1901)", source: "bundled" },
  { id: "YLT", name: "Young's Literal Translation", source: "bundled" },
  { id: "BBE", name: "Bible in Basic English", source: "bundled" },
  { id: "ESV", name: "English Standard Version", source: "api" },
  { id: "NLT", name: "New Living Translation", source: "api" },
  { id: "NKJV", name: "New King James Version", source: "paste" },
  { id: "NIV", name: "New International Version", source: "paste" },
  { id: "MSG", name: "The Message", source: "paste" },
];
export const BUNDLED = VERSIONS.filter((v) => v.source === "bundled").map((v) => v.id);
export const versionInfo = (id: string) => VERSIONS.find((v) => v.id === id) ?? VERSIONS[0];

const cache = new Map<string, Promise<string[][]>>();

/** One book of a bundled version: chapters → verses. */
export function loadBook(version: string, n: number): Promise<string[][]> {
  const v = BUNDLED.includes(version) ? version : "KJV";
  const k = `${v}/${n}`;
  if (!cache.has(k)) {
    const url = `${import.meta.env.BASE_URL}bible/${v.toLowerCase()}/${String(n).padStart(2, "0")}.json`;
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${book(n).name} (${v})`);
      return r.json() as Promise<string[][]>;
    });
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return cache.get(k)!;
}

/** The verses of a reference, as [verse number, text] per chapter. */
export async function passage(version: string, ref: Ref): Promise<{ chapter: number; verses: [number, string][] }[]> {
  const chapters = await loadBook(version, ref.book);
  const out = [];
  for (let c = ref.chapter; c <= ref.endChapter; c++) {
    const vs = chapters[c - 1] ?? [];
    const v1 = c === ref.chapter ? (ref.verse ?? 1) : 1;
    const v2 = c === ref.endChapter ? (ref.endVerse ?? vs.length) : vs.length;
    out.push({ chapter: c, verses: vs.slice(v1 - 1, v2).map((t, i) => [v1 + i, t] as [number, string]) });
  }
  return out;
}

/** Plain text of a short passage, for memorizing. */
export async function passageText(version: string, ref: Ref): Promise<string> {
  const info = versionInfo(version);
  if (info.source === "bundled") {
    return (await passage(version, ref))
      .flatMap((c) => c.verses.map(([, t]) => t))
      .join(" ")
      .trim();
  }
  if (version === "ESV") return fetchEsv(ref);
  if (version === "NLT") return fetchNlt(ref);
  throw new Error(`${version} can't be looked up — paste the text from your Bible app.`);
}

// ---------- API keys (this device only, never synced) ----------

const keyName = (v: string) => `lyt.key.${v}`;
export const getVersionKey = (v: string) => {
  try {
    return localStorage.getItem(keyName(v)) ?? "";
  } catch {
    return "";
  }
};
export const setVersionKey = (v: string, key: string) => {
  try {
    if (key) localStorage.setItem(keyName(v), key);
    else localStorage.removeItem(keyName(v));
  } catch {
    /* ignore */
  }
};

async function fetchEsv(ref: Ref): Promise<string> {
  const key = getVersionKey("ESV");
  if (!key) throw new Error("Add your free ESV key first (Memorize → Versions).");
  const q = new URLSearchParams({
    q: fmtRef(ref),
    "include-passage-references": "false",
    "include-verse-numbers": "false",
    "include-first-verse-numbers": "false",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-selahs": "false",
    "indent-poetry": "false",
    "indent-paragraphs": "0",
  });
  const res = await fetch(`https://api.esv.org/v3/passage/text/?${q}`, { headers: { Authorization: `Token ${key}` } }).catch(() => null);
  if (!res) throw new Error("Couldn't reach the ESV API. Paste the text instead.");
  if (res.status === 401 || res.status === 403) throw new Error("The ESV API didn't accept your key.");
  if (!res.ok) throw new Error(`ESV API error ${res.status}.`);
  const j = (await res.json()) as { passages?: string[] };
  const text = (j.passages?.[0] ?? "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error("The ESV API returned no text for that reference.");
  return text;
}

async function fetchNlt(ref: Ref): Promise<string> {
  const key = getVersionKey("NLT");
  if (!key) throw new Error("Add your free NLT key first (Memorize → Versions).");
  const b = book(ref.book);
  const r = `${b.name.replace(/\s/g, "")}.${ref.chapter}${ref.verse ? `:${ref.verse}` : ""}${ref.endVerse && ref.endVerse !== ref.verse ? `-${ref.endVerse}` : ""}`;
  const res = await fetch(`https://api.nlt.to/api/passages?${new URLSearchParams({ ref: r, version: "NLT", key })}`).catch(() => null);
  if (!res) throw new Error("Couldn't reach the NLT API. Paste the text instead.");
  if (!res.ok) throw new Error(`NLT API error ${res.status}.`);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  doc.querySelectorAll("h2, h3, h4, .vn, .tn, .a-tn, .subhead, .bk_ch_vs_header, sup, .cw_end").forEach((el) => el.remove());
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error("The NLT API returned no text for that reference.");
  return text;
}
