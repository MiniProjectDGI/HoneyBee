import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { config } from '../config/env';
import { ApiError } from './errorHandler';
import { prisma } from '../config/database';

export interface AuthenticatedRequest<
  P = Record<string, string>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    status: string;
  };
}

// Verify JWT access token
export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No authentication token provided');
    }

    const token = authHeader.substring(7);
    let decoded: { sub: string; email: string; role: UserRole };

    try {
      decoded = jwt.verify(token, config.jwt.secret) as typeof decoded;
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub, deletedAt: null },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw ApiError.unauthorized('User account not found');
    }

    if (user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account has been suspended. Contact support.');
    }

    if (user.status === 'INACTIVE') {
      throw ApiError.forbidden('Your account is inactive');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Optional auth — attaches user if token present, doesn't require it
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      sub: string;
      email: string;
      role: UserRole;
    };
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub, deletedAt: null },
      select: { id: true, email: true, role: true, status: true },
    });
    if (user && user.status === 'ACTIVE') {
      req.user = user;
    }
  } catch {
    // Ignore auth errors in optional auth
  }
  next();
}

// Role-based authorization middleware factory
export function authorize(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
        )
      );
    }
    next();
  };
}
