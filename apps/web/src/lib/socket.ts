import { io, Socket } from 'socket.io-client';
import axios from 'axios';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

async function refreshToken(): Promise<string | null> {
  const rt = localStorage.getItem('refreshToken');
  if (!rt) return null;
  try {
    const { data } = await axios.post('/api/auth/refresh', { refreshToken: rt });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();
  socket = io('http://localhost:3001', {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
  });

  socket.on('connect_error', async (err) => {
    if (err.message?.toLowerCase().includes('token')) {
      const newToken = await refreshToken();
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
