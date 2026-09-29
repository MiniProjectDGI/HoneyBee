import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { UserRole, AlertStatus } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// GET /api/alerts — list alerts for current user's hives
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '30'), 100);
    const status = req.query.status as AlertStatus | undefined;
    const hiveId = req.query.hiveId as string | undefined;

    let hiveIds: string[] | undefined;

    if (req.user!.role === UserRole.BEEKEEPER) {
      const bk = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });
      if (bk) {
        const hives = await prisma.hive.findMany({
          where: { beekeeperId: bk.id, deletedAt: null },
          select: { id: true },
        });
        hiveIds = hives.map((h) => h.id);
      }
    }

    const where = {
      ...(hiveIds ? { hiveId: { in: hiveIds } } : {}),
      ...(hiveId ? { hiveId } : {}),
      ...(status ? { status } : {}),
    };

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: {
          hive: { select: { hiveCode: true, name: true } },
          device: { select: { deviceId: true, deviceType: true } },
        },
      }),
      prisma.alert.count({ where }),
    ]);

    res.json(paginatedResponse(alerts, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/acknowledge
router.patch('/:id/acknowledge', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const alert = await prisma.alert.findUnique({ where: { id: req.params.id } });
    if (!alert) throw ApiError.notFound('Alert not found');
    if (alert.status !== 'OPEN') throw ApiError.unprocessable('Alert is not in OPEN status');

    const updated = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: req.user!.id,
        acknowledgedAt: new Date(),
      },
    });

    res.json(successResponse(updated, 'Alert acknowledged'));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const alert = await prisma.alert.findUnique({ where: { id: req.params.id } });
    if (!alert) throw ApiError.notFound('Alert not found');

    const updated = await prisma.alert.update({
      where: { id: req.params.id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
        resolvedNotes: req.body.notes,
      },
    });

    res.json(successResponse(updated, 'Alert resolved'));
  } catch (err) {
    next(err);
  }
});

export default router;
