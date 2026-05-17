import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

async function refreshToken(): Promise<string | null> {
  const rt = await SecureStore.getItemAsync('refreshToken');
  if (!rt) return null;
  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: rt });
    await SecureStore.setItemAsync('accessToken', data.data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
}

export async function connectSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();

  const token = await SecureStore.getItemAsync('accessToken');
  if (!token) return null;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
  });

  socket.on('connect_error', async (err: Error) => {
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
