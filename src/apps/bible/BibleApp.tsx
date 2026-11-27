import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import { go } from "../../lib/router";
import { SubTabs } from "../../components/SubTabs";
import { BibleToday } from "./Today";
import { BibleProgress } from "./Progress";
import { BibleLog } from "./Log";
import { BibleMemorize } from "./Memorize";
import { BibleQuiz } from "./Quiz";
import { BooksApp } from "./Books";

const TABS = [
  { id: "today", label: "Today" },
  { id: "progress", label: "Progress" },
  { id: "log", label: "Log" },
  { id: "memorize", label: "Memorize" },
  { id: "quiz", label: "Challenge" },
  { id: "books", label: "Books" },
];

export function BibleApp({ data, path, toast }: { data: Data; path: string[]; toast: (t: Toast) => void }) {
  const tab = TABS.some((t) => t.id === path[0]) ? path[0] : "today";
  return (
    <>
      <SubTabs tabs={TABS} active={tab} onChange={(id) => go("bible", id)} />
      {data.missing.length > 0 && (
        <section className="card warn-card">
          <strong>One-time database update needed.</strong> In Supabase → SQL Editor, run the “Bible reading, memory verses, other books” block from{" "}
          <code>supabase/schema.sql</code> (also in SETUP-CHECKLIST.md). Until then, Bible entries can't be saved to your account.
        </section>
      )}
      {tab === "today" && <BibleToday data={data} toast={toast} />}
      {tab === "progress" && <BibleProgress data={data} path={path.slice(1)} />}
      {tab === "log" && <BibleLog data={data} />}
      {tab === "memorize" && <BibleMemorize data={data} toast={toast} />}
      {tab === "quiz" && <BibleQuiz data={data} toast={toast} />}
      {tab === "books" && <BooksApp data={data} toast={toast} />}
    </>
  );
}
