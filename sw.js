/* Cache offline da Agenda.
   Estrategia: rede primeiro (mantem a atualizacao automatica),
   cache como reserva quando estiver sem internet. */
const CACHE = 'agenda-debora-v1';
const SHELL = ['./', './index.html'];
const ASSET_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'html2canvas.hertzen.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca cachear os dados da agenda nem o manifesto de versao (sempre precisam ser atuais).
  if (url.hostname.includes('script.google.com')) return;
  if (url.pathname.endsWith('version.json')) return;

  // Fontes e bibliotecas externas: usa o cache e atualiza em segundo plano.
  if (ASSET_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(req);
        const network = fetch(req)
          .then(res => { if (res && res.status === 200) c.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // A tela do app (mesma origem): tenta a rede, cai no cache se estiver offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
  }
});
