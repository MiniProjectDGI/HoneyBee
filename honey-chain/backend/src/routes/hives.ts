import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';
import { successResponse, paginatedResponse, generateHiveCode } from '../utils/helpers';
import { validate, createHiveSchema } from '../validators/index';
import { UserRole, HiveStatus } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';
import { getHiveTelemetry, getLatestTelemetry } from '../iot/iotService';
import { auditLog } from '../services/auditService';

const router = Router();
router.use(authenticate);

// GET /api/hives — list hives
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);
    const status = req.query.status as HiveStatus | undefined;

    let beekeeperId: string | undefined;
    if (req.user!.role === UserRole.BEEKEEPER) {
      const bk = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });
      beekeeperId = bk?.id;
    }

    const where = {
      deletedAt: null,
      ...(beekeeperId ? { beekeeperId } : {}),
      ...(status ? { status } : {}),
    };

    const [hives, total] = await Promise.all([
      prisma.hive.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          beekeeper: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          sensors: { where: { isActive: true } },
          _count: { select: { sensors: true, healthRecords: true, honeyCollections: true } },
        },
      }),
      prisma.hive.count({ where }),
    ]);

    res.json(paginatedResponse(hives, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// POST /api/hives — create hive
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER),
  validate(createHiveSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const beekeeper = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });
      if (!beekeeper && req.user!.role !== UserRole.ADMIN) {
        throw ApiError.badRequest('Beekeeper profile required to create a hive');
      }

      const beekeeperId = beekeeper?.id || req.body.beekeeperId;
      if (!beekeeperId) throw ApiError.badRequest('beekeeperId is required');

      const bk = await prisma.beekeeper.findUnique({ where: { id: beekeeperId } });
      if (!bk) throw ApiError.notFound('Beekeeper not found');

      const hiveCode = req.body.hiveCode || generateHiveCode(bk.beekeeperCode);

      // Ensure hive code uniqueness
      const existing = await prisma.hive.findUnique({ where: { hiveCode } });
      if (existing) throw ApiError.conflict(`Hive code ${hiveCode} already exists`);

      const hive = await prisma.hive.create({
        data: {
          beekeeperId,
          hiveCode,
          name: req.body.name,
          hiveType: req.body.hiveType,
          species: req.body.species,
          latitude: req.body.latitude,
          longitude: req.body.longitude,
          address: req.body.address,
          village: req.body.village,
          district: req.body.district,
          state: req.body.state,
          establishedAt: req.body.establishedAt ? new Date(req.body.establishedAt) : undefined,
          notes: req.body.notes,
        },
      });

      await auditLog({
        userId: req.user!.id,
        action: 'HIVE_CREATED',
        entityType: 'Hive',
        entityId: hive.id,
        description: `Hive ${hiveCode} created`,
      });

      res.status(201).json(successResponse(hive, 'Hive created successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/hives/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hive = await prisma.hive.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        beekeeper: { include: { user: { select: { firstName: true, lastName: true } } } },
        sensors: { include: { device: { select: { deviceId: true, status: true, lastSeenAt: true } } } },
        healthRecords: { orderBy: { inspectionDate: 'desc' }, take: 5 },
        _count: { select: { honeyCollections: true, aiAnalyses: true, alerts: true } },
      },
    });

    if (!hive) throw ApiError.notFound('Hive not found');
    res.json(successResponse(hive));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/hives/:id
router.patch('/:id', authorize(UserRole.ADMIN, UserRole.BEEKEEPER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hive = await prisma.hive.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!hive) throw ApiError.notFound('Hive not found');

    const updated = await prisma.hive.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        hiveType: req.body.hiveType,
        species: req.body.species,
        status: req.body.status,
        notes: req.body.notes,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      },
    });

    res.json(successResponse(updated, 'Hive updated'));
  } catch (err) {
    next(err);
  }
});

// GET /api/hives/:id/telemetry — get recent telemetry for hive
router.get('/:id/telemetry', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hours = parseInt(req.query.hours as string || '24');
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '100'), 500);

    const { readings, total } = await getHiveTelemetry(req.params.id, hours, page, limit);
    const latest = await getLatestTelemetry(req.params.id);

    res.json(successResponse({ readings, total, latest, hiveId: req.params.id, hours }));
  } catch (err) {
    next(err);
  }
});

// GET /api/hives/:id/alerts
router.get('/:id/alerts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const alerts = await prisma.alert.findMany({
      where: {
        hiveId: req.params.id,
        ...(status ? { status: status as 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(successResponse(alerts));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/hives/:id — soft delete
router.delete('/:id', authorize(UserRole.ADMIN, UserRole.BEEKEEPER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.hive.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json(successResponse(null, 'Hive deleted'));
  } catch (err) {
    next(err);
  }
});

export default router;
