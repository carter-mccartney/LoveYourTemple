// Choices for Bible questions: which versions verses come from, and whether to include
// questions about pastors and authors (outside the Bible). Shown in Settings, the
// Challenge and "Name that verse"; changes save right away.
import type { Data } from "../../lib/useData";
import { BUNDLED, versionInfo } from "../../lib/bible/text";

/** The versions questions draw verses from (at least one). */
export function quizVersions(data: Data): string[] {
  const on = (data.settings.bible.quizVersions ?? []).filter((v) => BUNDLED.includes(v));
  return on.length ? on : ["KJV"];
}

const saveBible = (data: Data, patch: Partial<Data["settings"]["bible"]>) =>
  data.saveSettings({ ...data.settings, bible: { ...data.settings.bible, ...patch } });

export function VersionPicker({ data }: { data: Data }) {
  const on = quizVersions(data);
  const toggle = (id: string) => {
    if (on.includes(id)) {
      if (on.length > 1) saveBible(data, { quizVersions: on.filter((v) => v !== id) });
    } else saveBible(data, { quizVersions: BUNDLED.filter((v) => v === id || on.includes(v)) });
  };
  return (
    <div className="stack tight">
      <div className="chips">
        {BUNDLED.map((v) => {
          const isOn = on.includes(v);
          const last = isOn && on.length === 1;
          return (
            <button
              key={v}
              className={`chip ${isOn ? "on" : ""}`}
              onClick={() => toggle(v)}
              aria-pressed={isOn}
              title={last ? "At least one version has to stay on" : versionInfo(v).name}
            >
              {isOn ? "✓ " : ""}
              {v}
            </button>
          );
        })}
      </div>
      {on.length === 1 ? (
        <p className="hint warn-note">
          Only {on[0]} is on, so Easy “Which version?” questions have just one possible answer. Turn on more versions to make them a real test. We
          suggest keeping at least KJV and ASV on.
        </p>
      ) : !on.includes("KJV") || !on.includes("ASV") ? (
        <p className="hint warn-note">We suggest keeping at least KJV and ASV on. They read alike, so telling them apart makes Easy mode a real test.</p>
      ) : (
        <p className="hint">
          Verse questions use these versions, and Easy “Which version?” asks you to pick among them. Turning versions off makes Easy questions
          easier. With only one on, there's just one possible answer.
        </p>
      )}
    </div>
  );
}

export function OutsideToggle({ data }: { data: Data }) {
  return (
    <label className="check block">
      <input type="checkbox" checked={data.settings.bible.outsideQuestions} onChange={(e) => saveBible(data, { outsideQuestions: e.target.checked })} />{" "}
      Include questions from outside the Bible: the “Pastors & authors” cards on John Bevere, Josh Howerton, Charlie Kirk, C.S. Lewis and others. Turn
      this off to focus only on the Word.
    </label>
  );
}

/** Both settings together, for the Settings page and the Challenge. */
export function QuestionSettings({ data }: { data: Data }) {
  return (
    <div className="stack tight">
      <h3>Versions in questions</h3>
      <VersionPicker data={data} />
      <h3 style={{ marginTop: 8 }}>Outside the Bible</h3>
      <OutsideToggle data={data} />
    </div>
  );
}
