import type { Toast } from "../../App";
import type { Data } from "../../lib/useData";
import { go } from "../../lib/router";
import { SubTabs } from "../../components/SubTabs";
import { FoodToday } from "./FoodToday";
import { AddFood } from "./AddFood";
import { FoodReport } from "./FoodReport";
import { MyFoods } from "./MyFoods";

const TABS = [
  { id: "today", label: "Today" },
  { id: "report", label: "Report" },
  { id: "mine", label: "My foods" },
];

export function FoodApp({ data, route, toast }: { data: Data; route: string[]; toast: (t: Toast) => void }) {
  const sub = route[1];
  if (sub === "add") return <AddFood data={data} mode={route[2]} toast={toast} />;
  const tab = TABS.some((t) => t.id === sub) ? sub! : "today";
  return (
    <>
      <SubTabs tabs={TABS} active={tab} onChange={(id) => go("food", id)} />
      {tab === "today" && <FoodToday data={data} toast={toast} />}
      {tab === "report" && <FoodReport data={data} />}
      {tab === "mine" && <MyFoods data={data} toast={toast} />}
    </>
  );
}
