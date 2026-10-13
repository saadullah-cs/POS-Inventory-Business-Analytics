// Service Worker for Biocure Healthcare Invoice Manager
// Provides offline functionality and caching

const CACHE_NAME = 'biocure-invoices-v1.0.0';
const STATIC_CACHE_NAME = 'biocure-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'biocure-dynamic-v1.0.0';

// Resources to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/login',
  '/logout',
  '/admin-logs',
  '/invoices',
  '/clients',
  '/reports',
  '/settings',
  '/help',
  '/offline.html',
  '/manifest.json',
  '/images/biocure-health-care-logo.jpg',
  // Add your CSS and JS files here when they're built
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip on localhost or cross-origin requests
  if (url.origin !== location.origin || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Handle API requests (if any)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle other requests (CSS, JS, images, etc.)
  event.respondWith(handleResourceRequest(request));
});

// Handle navigation requests (HTML pages)
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    // If successful, cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for navigation, serving from cache');
    
    // Try to serve the exact route from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to cached root (SPA shell) if available
    const rootCached = await caches.match('/');
    if (rootCached) {
      return rootCached;
    }
    
    // If not in cache, serve offline page
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Fallback response if offline.html is not cached
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Offline - Biocure Healthcare</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background: linear-gradient(135deg, #1e3a8a, #1e40af);
            color: white;
            min-height: 100vh;
            margin: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .offline-container {
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
            max-width: 500px;
            margin: 0 auto;
          }
          h1 { color: #fbbf24; margin-bottom: 1rem; }
          p { margin: 1rem 0; line-height: 1.6; }
          .retry-btn {
            background: #10b981;
            color: white;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
            margin-top: 1rem;
            transition: background 0.3s;
          }
          .retry-btn:hover { background: #059669; }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <h1>📱 You're Offline</h1>
          <p>Don't worry! Biocure Healthcare Invoice Manager works offline.</p>
          <p>You can still create and manage invoices. Your data will sync when you're back online.</p>
          <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
        </div>
        <script>
          // Auto-reload when back online
          window.addEventListener('online', () => {
            window.location.reload();
          });
        </script>
      </body>
      </html>`,
      { 
        headers: { 'Content-Type': 'text/html' },
        status: 200,
        statusText: 'OK'
      }
    );
  }
}

// Handle resource requests (CSS, JS, images, etc.)
async function handleResourceRequest(request) {
  try {
    // Try cache first for resources
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Resource request failed:', request.url);
    
    // Return a fallback response for images
    if (request.destination === 'image') {
      return new Response(
        '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#e5e7eb"/><text x="100" y="100" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">Image Unavailable</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    // For other resources, throw the error
    throw error;
  }
}

// Handle API requests
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] API request failed, returning offline response');
    
    // Return offline indicator for API requests
    return new Response(
      JSON.stringify({
        offline: true,
        message: 'This request will be processed when you\'re back online',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
}

// Background sync (for future implementation)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-invoices') {
    event.waitUntil(syncInvoices());
  }
});

// Sync invoices when back online
async function syncInvoices() {
  console.log('[SW] Syncing invoices...');
  
  try {
    // Get pending invoices from IndexedDB
    const pendingInvoices = await getPendingInvoices();
    
    for (const invoice of pendingInvoices) {
      try {
        // Sync each invoice
        await syncSingleInvoice(invoice);
        console.log('[SW] Synced invoice:', invoice.id);
      } catch (error) {
        console.error('[SW] Failed to sync invoice:', invoice.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Helper functions for IndexedDB operations
async function getPendingInvoices() {
  // This will be implemented with IndexedDB
  return [];
}

async function syncSingleInvoice(invoice) {
  // This will be implemented with IndexedDB
  console.log('Syncing invoice:', invoice);
}

// Push notification event (for future implementation)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  const options = {
    body: 'You have new invoice updates!',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/invoices'
    },
    actions: [
      {
        action: 'view',
        title: 'View Invoices',
        icon: '/images/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Biocure Healthcare', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Message event for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION',
      version: CACHE_NAME
    });
  }
});

console.log('[SW] Service Worker script loaded');
