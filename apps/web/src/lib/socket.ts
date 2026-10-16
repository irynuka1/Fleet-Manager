import { io, Socket } from 'socket.io-client';
import { refreshAccessToken } from '@/lib/api';

let socket: Socket | null = null;

// Same origin by default (Vite proxies /socket.io in dev; reverse proxy in prod).
// Override with VITE_SOCKET_URL when the API is hosted on a different origin.
const SOCKET_URL: string | undefined = import.meta.env.VITE_SOCKET_URL || undefined;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();
  socket = io(SOCKET_URL ?? window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
  });

  socket.on('connect_error', async (err) => {
    if (err.message?.toLowerCase().includes('token')) {
      const newToken = await refreshAccessToken().catch(() => null);
      if (newToken && socket) {
        socket.auth = { token: newToken };
        socket.connect();
      }
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
