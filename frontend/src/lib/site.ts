export const siteUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
export const publicIndexing = process.env.NEXT_PUBLIC_INDEXABLE === 'true';

if (publicIndexing && siteUrl.protocol !== 'https:') {
  throw new Error('Public indexing requires an HTTPS NEXT_PUBLIC_APP_URL.');
}
if (siteUrl.protocol === 'https:') {
  const api = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1', siteUrl);
  const socketValue = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
  const socket = new URL(socketValue, siteUrl);
  const secureSocket = socket.protocol === 'wss:' || (socketValue.startsWith('/') && socket.protocol === 'https:');
  if (api.protocol !== 'https:' || !api.pathname.replace(/\/$/, '').endsWith('/api/v1') || !secureSocket) {
    throw new Error('Public builds require an HTTPS API URL ending in /api/v1 and a WSS URL.');
  }
}
