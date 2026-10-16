import cron from 'node-cron';
import { runAlertCheck } from './alertEngine';
import { sendAlertEmail } from './emailService';
import prisma from '../config/database';

export function setupCronJobs(): void {
  // Run every day at 11:00 AM
  cron.schedule('0 11 * * *', async () => {
    console.log('[CRON] Pornire verificare alerte zilnica...');

    try {
      const created = await runAlertCheck();

      if (created > 0) {
        // Only email notifications created TODAY (not old unread ones)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const agencies = await prisma.agency.findMany({
          where: {
            notifications: {
              some: {
                createdAt: { gte: todayStart },
              },
            },
          },
          include: {
            users: {
              where: {
                role: { in: ['AGENCY_MANAGER', 'COUNTRY_MANAGER', 'SUPER_ADMIN'] },
              },
              select: { email: true, firstName: true, role: true },
            },
            notifications: {
              where: { createdAt: { gte: todayStart } },
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: { type: true, title: true, message: true },
            },
          },
        });

        // Send emails to agency managers
        for (const agency of agencies) {
          if (agency.notifications.length === 0) continue;

          for (const user of agency.users) {
            await sendAlertEmail(
              user.email,
              `OmniKinetix - ${agency.notifications.length} alerte noi pentru ${agency.name}`,
              agency.notifications,
            );
          }
        }

        // Send consolidated email to COUNTRY_MANAGER and SUPER_ADMIN (they have no agencyId)
        const globalManagers = await prisma.user.findMany({
          where: { role: { in: ['COUNTRY_MANAGER', 'SUPER_ADMIN'] } },
          select: { email: true, firstName: true, role: true },
        });

        if (globalManagers.length > 0) {
          const allTodayNotifications = await prisma.notification.findMany({
            where: { createdAt: { gte: todayStart } },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: { type: true, title: true, message: true },
          });

          if (allTodayNotifications.length > 0) {
            for (const manager of globalManagers) {
              await sendAlertEmail(
                manager.email,
                `OmniKinetix - ${allTodayNotifications.length} alerte noi (toate agentiile)`,
                allTodayNotifications,
              );
            }
          }
        }

        console.log(`[CRON] Verificare completa. ${created} notificari create, email-uri trimise pentru ${agencies.length} agentii + ${globalManagers.length} manageri globali.`);
      } else {
        console.log('[CRON] Verificare completa. Nicio notificare noua.');
      }
    } catch (error) {
      console.error('[CRON] Eroare la rularea verificarii de alerte:', error);
    }
  }, { timezone: process.env.CRON_TIMEZONE || 'Europe/Bucharest' });

  console.log('[CRON] Job-uri programate: verificare alerte zilnic la 11:00');
}
