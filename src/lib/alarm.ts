// The rest-timer alarm sound.
//
// Background tabs throttle JavaScript timers (a setTimeout can fire up to a minute late), but
// the audio clock keeps exact time. So when a timer starts, the whole alarm is scheduled ahead
// on the audio clock: a silent oscillator whose volume switches on at the due time and beeps
// in an alarm-clock pattern. It rings on time in a background tab or minimized window.
//
// Browsers only allow sound after you've clicked or tapped the page once, so the audio is
// "unlocked" on the first click (primeAudio). Phones suspend hidden pages entirely, so on a
// phone the push notification (and optionally the Clock app timer) does the alerting.

let ctx: AudioContext | null = null;

interface Scheduled {
  osc: OscillatorNode;
  dueMs: number;
  seconds: number;
  /** Audio-clock times the beeping starts and ends. */
  start: number;
  end: number;
}
let current: Scheduled | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    // A context created before any click starts out suspended and its clock stands still.
    // Once it starts running, re-plan the pending alarm against the real clock.
    ctx.onstatechange = () => {
      if (ctx?.state === "running" && current && !isRinging()) scheduleAlarm(current.dueMs, current.seconds);
    };
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Call on any click/tap so later alarms are allowed to make sound. */
export const primeAudio = () => void audio();

/** One oscillator, silent until `start`, then beep-beep-beep-beep, pause, until `end` (audio-clock times). */
function beeps(c: AudioContext, start: number, end: number) {
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1050;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  for (let t = start; t < end; t += 1.4) {
    for (let i = 0; i < 4; i++) {
      const on = t + i * 0.2;
      gain.gain.setValueAtTime(0.09, on);
      gain.gain.setValueAtTime(0, on + 0.11);
    }
  }
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(end + 0.2);
  return osc;
}

/** Play a few seconds of the alarm now, without touching a planned one. */
export function testAlarm() {
  const c = audio();
  if (c) beeps(c, c.currentTime + 0.05, c.currentTime + 2.8);
}

/** Beep-beep-beep-beep, pause — repeated for `seconds`, starting at `dueMs` (epoch ms). */
export function scheduleAlarm(dueMs: number, seconds: number) {
  cancelAlarm();
  const c = audio();
  if (!c || seconds <= 0) return;
  const start = c.currentTime + Math.max(0, (dueMs - Date.now()) / 1000);
  const end = start + seconds;
  const osc = beeps(c, start, end);
  current = { osc, dueMs, seconds, start, end };
  plannedDue = dueMs;
  osc.onended = () => {
    if (current?.osc === osc) current = null;
  };
}

function stopOsc() {
  if (!current) return;
  try {
    current.osc.stop();
    current.osc.disconnect();
  } catch {
    /* already stopped */
  }
  current = null;
}

/** The timer changed (snooze, restart, stop): drop the planned alarm. */
export function cancelAlarm() {
  stopOsc();
  plannedDue = null;
}

/** True while the alarm is audibly ringing right now. */
export function isRinging() {
  return !!(current && ctx && ctx.state === "running" && ctx.currentTime >= current.start - 0.05 && ctx.currentTime < current.end);
}

/** Due time the alarm was planned for — kept after it rings or is silenced, so it doesn't ring twice. */
let plannedDue: number | null = null;

/** True if the alarm for this due time was planned on a running audio clock (so it rang or will ring). */
export function alarmPlannedFor(dueMs: number) {
  return plannedDue === dueMs && ctx?.state === "running";
}

/** Silence a ringing alarm (a click anywhere does this). Leaves a not-yet-due alarm alone. */
export function stopRinging() {
  if (isRinging()) stopOsc();
}

/** A short two-tone chime, for when the long alarm is turned off. */
export function chime() {
  const c = audio();
  if (!c) return;
  [880, 1175].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * 0.22;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.45);
  });
}
