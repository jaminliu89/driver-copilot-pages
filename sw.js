const CACHE = "driver-copilot-shell-6637e15e551e";
const ROOT = new URL("./", self.location.href);
const SHELL = ["./","./index.html","./styles.css","./app.mjs","./engine.mjs","./income.mjs","./store.mjs","./ocr.mjs","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("driver-copilot-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
function saveShare(blob) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("driver-copilot-v1", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("snapshots", { keyPath: "contentKey" });
      r.result.createObjectStore("settings");
      r.result.createObjectStore("shared");
    };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result,
        tx = db.transaction("shared", "readwrite");
      tx.objectStore("shared").put(blob, "pending");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === "POST" &&
    url.href === new URL("share-target", ROOT).href
  ) {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData(),
            file = form.get("screenshots");
          if (
            !file ||
            !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
            file.size > 12 * 1024 * 1024
          )
            return new Response("请选择12MB以内的JPEG、PNG或WebP截图", {
              status: 400,
            });
          await saveShare(file);
          return Response.redirect(new URL("./#income", ROOT), 303);
        } catch {
          return new Response("分享接收失败，请打开收入页选择截图", {
            status: 500,
          });
        }
      })(),
    );
    return;
  }
  if (
    event.request.method !== "GET" ||
    url.origin !== ROOT.origin ||
    !url.pathname.startsWith(ROOT.pathname)
  )
    return;
  const rel = url.pathname.slice(ROOT.pathname.length);
  if (
    !SHELL.some((s) => new URL(s, ROOT).pathname === url.pathname) &&
    !rel.startsWith("vendor/")
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      try {
        const r = await fetch(event.request);
        if (r.ok) await cache.put(event.request, r.clone());
        return r;
      } catch {
        return new Response("当前资源尚未缓存，请联网后重试", { status: 503 });
      }
    })(),
  );
});
