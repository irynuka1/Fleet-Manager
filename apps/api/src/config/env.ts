import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV !== 'development') {
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Variabila de mediu ${key} este obligatorie in modul ${NODE_ENV}`);
    }
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_ACCESS_SECRET: NODE_ENV === 'development'
    ? (process.env.JWT_ACCESS_SECRET || 'dev-access-secret')
    : process.env.JWT_ACCESS_SECRET!,
  JWT_REFRESH_SECRET: NODE_ENV === 'development'
    ? (process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret')
    : process.env.JWT_REFRESH_SECRET!,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV,
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
};
