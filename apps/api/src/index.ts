import http from 'http';
import { env } from './config/env';
import prisma from './config/database';
import app from './app';
import { setupCronJobs } from './services/cronJobs';
import { setupSocketServer } from './services/socketServer';

// Create HTTP server so we can attach Socket.io on the same port
const httpServer = http.createServer(app);
setupSocketServer(httpServer);

httpServer.listen(env.PORT, env.HOST, () => {
  console.log(`[OmniKinetix API] Server started on http://${env.HOST}:${env.PORT}`);
  console.log(`[OmniKinetix API] Mediu: ${env.NODE_ENV}`);
  setupCronJobs();
});

// Graceful shutdown: stop accepting connections, then release the DB pool.
function shutdown(signal: string) {
  console.log(`[OmniKinetix API] ${signal} primit, oprire controlata...`);
  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

