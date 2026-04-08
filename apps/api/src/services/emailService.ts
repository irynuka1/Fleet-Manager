import nodemailer from 'nodemailer';
import { env } from '../config/env';

interface NotificationItem {
  type: string;
  title: string;
  message: string;
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'ITP_EXPIRING': return '&#128203;'; // clipboard
    case 'RCA_EXPIRING': return '&#128196;'; // page
    case 'REVISION_DUE': return '&#128295;'; // wrench
    case 'DRIVER_LICENSE_EXPIRING': return '&#127919;'; // license
    case 'DRIVER_MEDICAL_EXPIRING': return '&#9764;'; // medical
    default: return '&#128276;'; // bell
  }
}

function buildHtmlEmail(notifications: NotificationItem[]): string {
  const rows = notifications
    .map(
      (n) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; font-size: 20px;">
          ${getTypeIcon(n.type)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #1a1a2e;">
          ${n.title}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; color: #555;">
          ${n.message}
        </td>
      </tr>`,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background: #f4f6f9; font-family: Arial, sans-serif;">
      <div style="max-width: 640px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #fff; font-size: 22px; letter-spacing: 1px;">OmniKinetix - Alerte Flota</h1>
        </div>

        <div style="padding: 24px;">
          <p style="color: #333; margin-bottom: 16px;">Au fost detectate urmatoarele alerte:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: center; width: 40px;"></th>
                <th style="padding: 10px; text-align: left; color: #666; font-size: 13px;">Titlu</th>
                <th style="padding: 10px; text-align: left; color: #666; font-size: 13px;">Detalii</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div style="background: #f8f9fa; padding: 16px; text-align: center; font-size: 12px; color: #999;">
          Generat automat de OmniKinetix la ${new Date().toLocaleString('ro-RO')}
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendAlertEmail(
  to: string,
  subject: string,
  notifications: NotificationItem[],
): Promise<boolean> {
  if (!env.SMTP_HOST) {
    console.warn('[EmailService] SMTP nu este configurat. Email-ul nu a fost trimis.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"OmniKinetix" <${env.SMTP_USER || 'noreply@omnikinetix.ro'}>`,
      to,
      subject,
      html: buildHtmlEmail(notifications),
    });

    console.log(`[EmailService] Email trimis catre ${to}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Eroare la trimiterea email-ului:', error);
    return false;
  }
}
