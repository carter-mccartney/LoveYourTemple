// Offline support (network-first, falling back to cache) and crew push notifications.
const CACHE = "replog-v2";

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
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./"))),
  );
});

// Sent by the notify-crew Edge Function: { title, body, url: "#/crew/<id>" }
self.addEventListener("push", (e) => {
  let msg = { title: "LoveYourTemple", body: "", url: "#/crew" };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    /* plain text or empty push */
  }
  e.waitUntil(self.registration.showNotification(msg.title, { body: msg.body, icon: "icon.svg", badge: "icon.svg", tag: msg.tag, data: { url: msg.url } }));
});

// Tapping a notification focuses the app (or opens it) on the friend's day.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hash = e.notification.data?.url || "#/crew";
  const target = new URL(self.registration.scope).href + hash;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope)) {
          c.postMessage({ type: "navigate", url: hash });
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
