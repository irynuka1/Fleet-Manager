import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

// Both the declared MIME type and the extension must be on the allow-list, so a
// file such as "x.html" cannot be smuggled in with an image/png content type.
const DOCUMENT_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const IMAGE_TYPES = Object.fromEntries(
  Object.entries(DOCUMENT_TYPES).filter(([mime]) => mime.startsWith('image/')),
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

function createUploader(allowed: Record<string, string[]>, message: string) {
  return multer({
    storage,
    limits: { fileSize: env.MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed[file.mimetype]?.includes(ext)) {
        cb(null, true);
      } else {
        cb(new AppError(message, 400));
      }
    },
  });
}

/** PDF + images (driver / vehicle documents). */
export const documentUpload = createUploader(
  DOCUMENT_TYPES,
  'Tip de fisier nepermis. Sunt acceptate doar: PDF, JPEG, PNG, WebP, GIF',
);

/** Images only (driver profile photos). */
export const imageUpload = createUploader(
  IMAGE_TYPES,
  'Tip de fisier nepermis. Sunt acceptate doar imagini: JPEG, PNG, WebP, GIF',
);
