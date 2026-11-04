// Start/stop GPS tracking for walks and runs.
//
// Browser limitation worth knowing: a web page only gets GPS while it's open on
// screen. If the phone locks or you switch apps, updates stop until you come
// back (the gap is bridged as a straight line). We hold a screen wake lock while
// tracking to keep the screen from sleeping.
import { useCallback, useEffect, useRef, useState } from "react";

export interface TrackState {
  status: "idle" | "running" | "paused";
  /** Active milliseconds accumulated before the current running stretch. */
  activeMs: number;
  runningSince: number | null;
  distance_m: number;
  max_speed_mps: number;
  current_speed_mps: number | null;
  accuracy_m: number | null;
  points: [number, number, number][]; // lat, lng, unix s (accepted fixes only)
  error: string | null;
}

const IDLE: TrackState = {
  status: "idle", activeMs: 0, runningSince: null, distance_m: 0, max_speed_mps: 0,
  current_speed_mps: null, accuracy_m: null, points: [], error: null,
};

const MAX_ACCURACY_M = 35; // ignore fuzzy fixes
const MAX_PLAUSIBLE_MPS = 12; // ~27 mph: faster than any run → a GPS jump
const R = 6371000;

export function haversine(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const activeSeconds = (t: TrackState, now = Date.now()) =>
  (t.activeMs + (t.runningSince ? now - t.runningSince : 0)) / 1000;

/** Tracker state survives a page reload (kept per workout in localStorage). */
export function useGpsTracker(workoutId: string) {
  const storageKey = `replog.track.${workoutId}`;
  const [track, setTrack] = useState<TrackState>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...IDLE, ...JSON.parse(saved) } : IDLE;
    } catch {
      return IDLE;
    }
  });
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<{ release(): Promise<void> } | null>(null);
  const recentSpeeds = useRef<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(track));
    } catch {
      /* tracking still works in memory */
    }
  }, [track, storageKey]);

  const onFix = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed } = pos.coords;
    const t = pos.timestamp / 1000;
    setTrack((s) => {
      if (s.status !== "running") return s;
      const base = { ...s, accuracy_m: accuracy, error: null };
      if (accuracy > MAX_ACCURACY_M) return base;
      const last = s.points[s.points.length - 1];
      if (!last) return { ...base, points: [[latitude, longitude, t]] };
      const d = haversine([last[0], last[1]], [latitude, longitude]);
      const dt = Math.max(1, t - last[2]);
      const segSpeed = d / dt;
      // Standing still: GPS wanders a few meters; don't count it as distance.
      if (d < Math.max(3, accuracy / 3)) return { ...base, current_speed_mps: speed ?? 0 };
      if (segSpeed > MAX_PLAUSIBLE_MPS) return base;
      const v = speed != null && speed >= 0 ? speed : segSpeed;
      // Top speed uses the median of the last 3 readings so one spike doesn't set a record.
      const rs = [...recentSpeeds.current, v].slice(-3);
      recentSpeeds.current = rs;
      const median = [...rs].sort((a, b) => a - b)[Math.floor(rs.length / 2)];
      return {
        ...base,
        points: [...s.points, [latitude, longitude, t]],
        distance_m: s.distance_m + d,
        current_speed_mps: v,
        max_speed_mps: rs.length >= 3 ? Math.max(s.max_speed_mps, median) : s.max_speed_mps,
      };
    });
  }, []);

  const onError = useCallback((e: GeolocationPositionError) => {
    const msg =
      e.code === e.PERMISSION_DENIED
        ? "Location permission is off. Allow location for this site to track distance."
        : e.code === e.TIMEOUT
          ? "Waiting for a GPS signal…"
          : "Location unavailable.";
    setTrack((s) => ({ ...s, error: msg }));
  }, []);

  const watch = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setTrack((s) => ({ ...s, error: "This device has no location support." }));
      return;
    }
    if (watchId.current != null) return;
    watchId.current = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }, [onFix, onError]);

  const unwatch = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  };

  const lockScreen = async () => {
    try {
      wakeLock.current = await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {
      /* not supported or denied; tracking still works while the screen is on */
    }
  };
  const unlockScreen = () => {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  };

  // Resume watching after a reload, and re-take the wake lock when the tab comes back.
  useEffect(() => {
    if (track.status === "running") {
      watch();
      lockScreen();
    }
    const onVis = () => document.visibilityState === "visible" && track.status === "running" && lockScreen();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.status]);

  useEffect(() => () => {
    unwatch();
    unlockScreen();
  }, []);

  return {
    track,
    start() {
      recentSpeeds.current = [];
      setTrack((s) => ({ ...s, status: "running", runningSince: Date.now(), error: null }));
      watch();
      lockScreen();
    },
    pause() {
      unwatch();
      unlockScreen();
      // Next fix after resuming starts a new segment instead of drawing a line across the pause.
      setTrack((s) => ({ ...s, status: "paused", activeMs: s.activeMs + (s.runningSince ? Date.now() - s.runningSince : 0), runningSince: null }));
    },
    /** Stop for good; returns the final numbers. */
    stop(): TrackState {
      unwatch();
      unlockScreen();
      const final = { ...track, status: "idle" as const, activeMs: activeSeconds(track) * 1000, runningSince: null };
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setTrack(IDLE);
      return final;
    },
  };
}

/** Keep every Nth point so a long route stays small in the database. */
export function downsample<T>(points: T[], max = 400): T[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  return Array.from({ length: max }, (_, i) => points[Math.floor(i * step)]).concat([points[points.length - 1]]);
}
