import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { ApiError } from '../middleware/errorHandler';
import { logger, sanitizeForLog } from '../utils/logger';
import { UserRole, AccountStatus } from '@prisma/client';

// ─── Password Hashing ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// ─── JWT Token Generation ─────────────────────────────────────────────────────

export function generateAccessToken(user: {
  id: string;
  email: string;
  role: UserRole;
}): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export function generateRefreshToken(): string {
  return uuidv4() + '-' + uuidv4();
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
}) {
  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: data.role || UserRole.CONSUMER,
      status: AccountStatus.ACTIVE, // In production: PENDING_VERIFICATION with email flow
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  logger.info('User registered', sanitizeForLog({ userId: user.id, email: user.email, role: user.role }));
  return user;
}

export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
) {
  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    // Timing-safe: still verify to prevent user enumeration
    await hashPassword('dummy_password_to_prevent_timing_attack');
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status === 'SUSPENDED') {
    throw ApiError.forbidden('Your account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  if (user.status === 'INACTIVE') {
    throw ApiError.forbidden('Your account is inactive', 'ACCOUNT_INACTIVE');
  }

  // Generate tokens
  const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken();

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshExpiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
  });

  logger.info('User logged in', { userId: user.id, email: user.email, ip: ipAddress });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
    },
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: { select: { id: true, email: true, role: true, status: true, deletedAt: true } } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (stored.user.deletedAt || stored.user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Account is not active');
  }

  const accessToken = generateAccessToken({
    id: stored.user.id,
    email: stored.user.email,
    role: stored.user.role,
  });

  return { accessToken };
}

export async function logoutUser(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { revokedAt: new Date() },
  });
}
