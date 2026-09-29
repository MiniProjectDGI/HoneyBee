import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { AuthenticatedRequest } from '../middleware/auth';
import { successResponse } from '../utils/helpers';
import { prisma } from '../config/database';
import { ApiError } from '../middleware/errorHandler';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json(successResponse(user, 'Account created successfully'));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.loginUser(
      req.body.email,
      req.body.password,
      req.ip,
      req.get('User-Agent')
    );
    res.json(successResponse(result, 'Login successful'));
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logoutUser(refreshToken);
    }
    res.json(successResponse(null, 'Logged out successfully'));
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        beekeeper: {
          select: {
            id: true,
            beekeeperCode: true,
            organizationId: true,
            clusterId: true,
          },
        },
      },
    });

    if (!user) throw ApiError.notFound('User not found');

    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
}
