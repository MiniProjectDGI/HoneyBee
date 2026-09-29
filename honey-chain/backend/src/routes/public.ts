import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { optionalAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { successResponse } from '../utils/helpers';
import * as batchService from '../services/batchService';

const router = Router();

/**
 * GET /api/public/verify/:batchId
 * Public consumer verification — no authentication required.
 * Returns only public-safe traceability information.
 */
router.get(
  '/verify/:batchId',
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await batchService.publicVerifyBatch(
        req.params.batchId as string,
        req.ip,
        req.user?.id
      );

      // Always return 200 — the verificationResult field indicates the status
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/public/health
 * Public API health check.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
  });
});

export default router;
