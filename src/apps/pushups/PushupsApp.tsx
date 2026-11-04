import { useState } from "react";
import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import type { WorkoutSet } from "../../lib/types";
import { go } from "../../lib/router";
import { SubTabs } from "../../components/SubTabs";
import { PushupsToday } from "./Today";
import { PushupsStats } from "./Stats";
import { PushupsHistory } from "./History";
import { PushupsGoals } from "./Goals";
import { SetEditor } from "./SetEditor";

const TABS = [
  { id: "today", label: "Today" },
  { id: "stats", label: "Stats" },
  { id: "history", label: "History" },
  { id: "goals", label: "Goals" },
];

export function PushupsApp({ data, sub, toast }: { data: Data; sub?: string; toast: (t: Toast) => void }) {
  const tab = TABS.some((t) => t.id === sub) ? sub! : "today";
  const [editing, setEditing] = useState<WorkoutSet | "new" | null>(null);
  return (
    <>
      <SubTabs tabs={TABS} active={tab} onChange={(id) => go("pushups", id)} />
      {tab === "today" && <PushupsToday data={data} onEdit={setEditing} toast={toast} />}
      {tab === "stats" && <PushupsStats data={data} />}
      {tab === "history" && <PushupsHistory data={data} onEdit={setEditing} />}
      {tab === "goals" && <PushupsGoals data={data} />}
      {editing && <SetEditor set={editing === "new" ? null : editing} data={data} onClose={() => setEditing(null)} />}
    </>
  );
}
