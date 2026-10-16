import { Request, Response, NextFunction, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';

export const REFRESH_COOKIE = 'omnikinetix_rt';

// The refresh token never reaches JavaScript: it lives in an httpOnly cookie,
// scoped to the auth routes and sent only on same-site requests (CSRF defence).
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/auth',
  };
}

function setRefreshCookie(res: Response, token: string) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { exp: number };
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), expires: new Date(payload.exp * 1000) });
}

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { refreshToken, ...result } = await AuthService.login(email, password);
      setRefreshCookie(res, refreshToken);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const current = req.cookies?.[REFRESH_COOKIE];
      if (!current) throw new AppError('Refresh token lipsa', 401);

      const { refreshToken, ...result } = await AuthService.refresh(current);
      setRefreshCookie(res, refreshToken);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const current = req.cookies?.[REFRESH_COOKIE];
      if (current) await AuthService.logout(current);
      res.clearCookie(REFRESH_COOKIE, cookieOptions());

      res.status(200).json({ success: true, data: { message: 'Deconectare reusita' } });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getMe(req.user!.userId);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}
