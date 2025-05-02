// public/service-worker.js

// Durante l’install, salta la waiting phase
self.addEventListener('install', event => {
    self.skipWaiting();
  });
  
  // Quando attivato, prendi subito il controllo dei client
  self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
  });
  
  // Intercetta tutte le fetch, ma non facciamo caching qui
  self.addEventListener('fetch', event => {
    // puoi loggare o lasciare vuoto
  });
  