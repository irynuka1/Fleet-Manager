import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';

// Compared against when the email is unknown so response time doesn't reveal
// which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);

export class AuthService {
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { agency: true },
    });

    const isPasswordValid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user) {
      throw new AppError('Email sau parola invalida', 401);
    }

    if (!isPasswordValid) {
      throw new AppError('Email sau parola invalida', 401);
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        agencyId: user.agencyId,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      env.JWT_REFRESH_SECRET,
      // jti makes every token unique, even when two are issued within the same second.
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any, jwtid: randomUUID() }
    );

    const decoded = jwt.decode(refreshToken) as { exp: number };

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  static async refresh(refreshToken: string) {
    try {
      jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Refresh token invalid', 401);
    }

    const storedToken = await prisma.refreshToken.findFirst({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      throw new AppError('Refresh token invalid', 401);
    }

    if (new Date() > storedToken.expiresAt) {
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new AppError('Refresh token expirat', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user) {
      throw new AppError('Utilizatorul nu a fost gasit', 404);
    }

    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        agencyId: user.agencyId,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id },
      env.JWT_REFRESH_SECRET,
      // jti makes every token unique, even when two are issued within the same second.
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any, jwtid: randomUUID() }
    );

    const decoded = jwt.decode(newRefreshToken) as { exp: number };

    // Rotate atomically; deleteMany makes a concurrent replay of the same token fail.
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.deleteMany({ where: { id: storedToken.id } });
      if (count === 0) throw new AppError('Refresh token invalid', 401);

      await tx.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt: new Date(decoded.exp * 1000),
        },
      });
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        agencyId: true,
        agency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('Utilizatorul nu a fost gasit', 404);
    }

    return user;
  }
}
