import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { UserRole } from '@prisma/client';
import { blockchainService } from '../blockchain/blockchainService';
import { getAuditLogs } from '../services/auditService';

const router = Router();
router.use(authenticate, authorize(UserRole.ADMIN));

// GET /api/admin/stats — database-driven admin statistics (no hardcoded values)
router.get('/stats', async (_req, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      totalBeekeepers,
      activeHives,
      activeDevices,
      totalBatches,
      verifiedBatches,
      pendingQualityTests,
      openAlerts,
      blockchainRegistrations,
      totalOrders,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.beekeeper.count({ where: { isActive: true } }),
      prisma.hive.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.device.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      prisma.honeyBatch.count({ where: { deletedAt: null } }),
      prisma.blockchainRecord.count({ where: { status: 'CONFIRMED' } }),
      prisma.qualityTest.count({ where: { status: 'PENDING' } }),
      prisma.alert.count({ where: { status: 'OPEN' } }),
      prisma.blockchainRecord.count({ where: { status: 'CONFIRMED' } }),
      prisma.order.count(),
    ]);

    // Batch status distribution
    const batchStatusCounts = await prisma.honeyBatch.groupBy({
      by: ['status'],
      _count: true,
      where: { deletedAt: null },
    });

    // Alert severity distribution
    const alertSeverityCounts = await prisma.alert.groupBy({
      by: ['severity'],
      _count: true,
      where: { status: 'OPEN' },
    });

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentBatches = await prisma.honeyBatch.count({
      where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
    });

    const blockchainInfo = await blockchainService.getNetworkInfo();

    res.json(successResponse({
      users: { total: totalUsers },
      beekeepers: { total: totalBeekeepers },
      hives: { active: activeHives },
      devices: { active: activeDevices },
      batches: {
        total: totalBatches,
        blockchainVerified: verifiedBatches,
        pendingQualityTests,
        recentLast30Days: recentBatches,
        byStatus: batchStatusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      },
      alerts: {
        open: openAlerts,
        bySeverity: alertSeverityCounts.reduce((acc, s) => ({ ...acc, [s.severity]: s._count }), {}),
      },
      blockchain: {
        registrations: blockchainRegistrations,
        networkInfo: blockchainInfo,
      },
      orders: { total: totalOrders },
      generatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '50'), 200);
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const entityType = req.query.entityType as string | undefined;

    const { logs, total } = await getAuditLogs({ userId, entityType, action, page, limit });
    res.json(paginatedResponse(logs, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users — list all users
router.get('/users', async (_req, res: Response, next: NextFunction) => {
  try {
    const page = parseInt((_req.query.page as string) || '1');
    const limit = Math.min(parseInt((_req.query.limit as string) || '20'), 100);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);

    res.json(paginatedResponse(users, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role — change user role
router.patch('/users/:id/role', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { role, status } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      },
      select: { id: true, email: true, role: true, status: true },
    });

    res.json(successResponse(updated, 'User updated'));
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/system-health
router.get('/system-health', async (_req, res: Response, next: NextFunction) => {
  try {
    const [dbCheck, blockchainInfo] = await Promise.all([
      prisma.$queryRaw`SELECT 1 AS healthy`.then(() => ({ connected: true })).catch(() => ({ connected: false })),
      blockchainService.getNetworkInfo(),
    ]);

    res.json(successResponse({
      database: dbCheck,
      blockchain: blockchainInfo,
      api: { status: 'healthy', timestamp: new Date().toISOString() },
    }));
  } catch (err) {
    next(err);
  }
});

export default router;
