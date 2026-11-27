// Offline support (network-first, falling back to cache), push notifications, and
// the rest-timer notification's "Log" / "Snooze" buttons.
const CACHE = "replog-v3";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Pages: always ask the server (skipping the 10-minute browser cache), so a new version shows on reload.
  e.respondWith(
    fetch(req, req.mode === "navigate" ? { cache: "no-cache" } : undefined)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./"))),
  );
});

// Sent by the Edge Functions:
//   notify-crew:    { title, body, url: "#/crew/<id>" }
//   send-reminders: { title, body, url: "#/pushups", tag: "lyt-timer", timer: true, repeat: 0, reps: 40 }
self.addEventListener("push", (e) => {
  let msg = { title: "LoveYourTemple", body: "", url: "#/crew" };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    /* plain text or empty push */
  }
  const opts = { body: msg.body, icon: "icon.svg", badge: "icon.svg", tag: msg.tag, data: { url: msg.url } };
  if (!msg.timer) {
    e.waitUntil(self.registration.showNotification(msg.title, opts));
    return;
  }
  e.waitUntil(
    self.registration.getNotifications({ tag: "lyt-timer" }).then((open) => {
      Object.assign(opts, {
        requireInteraction: true,
        vibrate: [300, 150, 300, 150, 600],
        actions: [
          { action: "log", title: msg.reps ? `Log ${msg.reps}` : "Log set" },
          { action: "snooze", title: "Snooze 5 min" },
        ],
        // The open app already alerted for this one: replace it quietly. Repeats always alert again.
        renotify: !(open.length && !msg.repeat),
      });
      return self.registration.showNotification(msg.title, opts);
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hash = e.notification.data?.url || "#/crew";
  const action = e.action; // "log" | "snooze" | "" (the notification itself)
  const scope = new URL(self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (action === "log" || action === "snooze") {
        // App open somewhere: it logs/snoozes in place. Otherwise open it to do so.
        if (open) return open.postMessage({ type: "timer-action", action });
        return self.clients.openWindow(scope + "#/pushups/do-" + action);
      }
      if (open) {
        open.postMessage({ type: "navigate", url: hash });
        return open.focus();
      }
      return self.clients.openWindow(scope + hash);
    }),
  );
});
