/* Roteiros BYD · service worker
   - a página (index.html) vem sempre da internet quando houver sinal; sem sinal, usa a última versão salva;
   - os dados dos roteiros e os embarques NÃO passam por aqui (vão direto ao Apps Script). */
const VERSAO = "rbyd-v2";
const ARQUIVOS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.endsWith("google.com") || url.hostname.endsWith("googleusercontent.com")) return;  // dados: sempre direto
  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    // página: tenta a internet (até 6 s; se não mudou, o GitHub responde só "igual") e guarda a cópia; sem sinal, abre a última salva
    e.respondWith((async () => {
      const cache = await caches.open(VERSAO);
      try {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(req, { signal: ctrl.signal, cache: "no-cache" }); clearTimeout(t);
        if (r.ok) cache.put("index.html", r.clone());
        return r;
      } catch (err) {
        return (await cache.match("index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }
  // ícones, manifesto e fontes: usa o salvo e atualiza em segundo plano
  e.respondWith(caches.open(VERSAO).then(async cache => {
    const hit = await cache.match(req);
    const rede = fetch(req).then(r => { if (r.ok || r.type === "opaque") cache.put(req, r.clone()); return r }).catch(() => hit);
    return hit || rede;
  }));
});
