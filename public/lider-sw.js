/*
 * Service worker da Área do Líder (offline — opção B).
 *
 * PROPÓSITO ÚNICO: fazer /lider ABRIR sem internet. Dados e documentos ficam no
 * IndexedDB (tratados pelo app); aqui só a "casca": HTML de /lider (network-first,
 * cai no cache offline) e os assets do Next (/_next/static, hash imutável, cache-first).
 *
 * É TRANSPARENTE pro resto (só chama respondWith nesses casos). A PÁGINA também
 * popula estes caches na 1ª abertura online (pré-cache), porque no iOS o SW ainda
 * não controla a página no primeiro load e os chunks não entrariam sozinhos.
 */
const SHELL = "lider-shell-v2";
const STATIC = "lider-static-v2";
const VIVOS = [SHELL, STATIC];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL);
        await cache.add("/lider"); // garante o HTML da casca já no cache
      } catch {
        /* offline durante o install — a página pré-cacheia depois */
      }
      await self.skipWaiting();
    })(),
  );
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

// A página manda a lista de assets que carregou pra garantir o cache (iOS).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "precache" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC);
      await Promise.all(
        data.urls.map((u) => fetch(u).then((r) => (r && r.ok ? cache.put(u, r.clone()) : null)).catch(() => {})),
      );
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

async function navFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(request)) || (await cache.match("/lider"));
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

  // Navegação para a /lider (start_url do atalho): network-first, cai no cache.
  if (req.mode === "navigate" && (url.pathname === "/lider" || url.pathname.startsWith("/lider/"))) {
    event.respondWith(navFirst(req, SHELL));
    return;
  }
  // Qualquer outra coisa: passthrough (não intercepta).
});
