/*
 * Service worker da Área do Líder (offline — opção B).
 *
 * PROPÓSITO ÚNICO: fazer /lider ABRIR sem internet. Os DADOS e os DOCUMENTOS ficam
 * no IndexedDB (tratados pelo app), não aqui. Este SW só cacheia a "casca":
 *   - a navegação para /lider (HTML) → network-first, cai no cache se offline;
 *   - os assets estáticos do Next (/_next/static, hash imutável) → cache-first.
 *
 * É TRANSPARENTE para todo o resto: só chama respondWith nesses casos; qualquer
 * outra requisição segue o fluxo normal do navegador (não afeta operacional/amigo).
 */
const SHELL = "lider-shell-v1";
const STATIC = "lider-static-v1";
const VIVOS = [SHELL, STATIC];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const chaves = await caches.keys();
      await Promise.all(
        chaves.filter((k) => k.startsWith("lider-") && !VIVOS.includes(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Assets estáticos (nomes com hash = imutáveis): cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/")
  ) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }

  // Só a navegação para a própria /lider: network-first com fallback no cache.
  if (req.mode === "navigate" && url.pathname === "/lider") {
    event.respondWith(networkFirst(req, SHELL));
    return;
  }
  // Qualquer outra coisa: passthrough (não intercepta).
});
