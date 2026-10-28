import { NextRequest } from 'next/server';
import { verifyAccessToken } from './jwt';
import { prisma } from './prisma';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  paymentQrUrl?: string | null;
}

export async function getAuthUser(req: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAccessToken(token);

  if (!payload) {
    throw new Error('Unauthorized: Invalid or expired access token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      paymentQrUrl: true,
      isEmailVerified: true,
    },
  });

  if (!user) {
    throw new Error('Unauthorized: User no longer exists');
  }

  return user;
}
