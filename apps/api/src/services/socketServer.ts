import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/database';

let io: SocketIOServer | null = null;

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  agencyId: string | null;
}

export function setupSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN,
      credentials: true,
    },
  });

  // JWT auth handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Token lipsa'));
    }
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
      (socket.data as any).user = decoded;
      next();
    } catch {
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', async (socket) => {
    const user = (socket.data as any).user as JwtPayload;
    console.log(`[Socket.io] User conectat: ${user.email} (${user.role})`);

    // Join agency-specific room based on role
    if (user.role === 'AGENCY_MANAGER' && user.agencyId) {
      socket.join(`agency:${user.agencyId}`);
    } else if (user.role === 'SUPER_ADMIN' || user.role === 'COUNTRY_MANAGER') {
      // Auto-join all agency rooms so admins receive every telemetry broadcast
      try {
        const agencies = await prisma.agency.findMany({ select: { id: true } });
        for (const a of agencies) {
          socket.join(`agency:${a.id}`);
        }
      } catch (err) {
        console.error('[Socket.io] Failed to auto-join agencies:', err);
      }

      // Keep manual subscribe handlers for backwards compat / explicit control
      socket.on('subscribe:agency', (agencyId: string) => {
        if (typeof agencyId === 'string') socket.join(`agency:${agencyId}`);
      });
      socket.on('unsubscribe:agency', (agencyId: string) => {
        if (typeof agencyId === 'string') socket.leave(`agency:${agencyId}`);
      });
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.io] User deconectat: ${user.email}`);
    });
  });

  console.log('[Socket.io] Server initialised on the same port as the API');
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
