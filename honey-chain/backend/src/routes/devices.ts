import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';
import { successResponse, paginatedResponse, generateDeviceApiKey } from '../utils/helpers';
import { validate, createDeviceSchema, iotTelemetrySchema } from '../validators/index';
import { UserRole } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';
import * as iotService from '../iot/iotService';

const router = Router();

// ─── Device Management Routes (require auth) ──────────────────────────────────

const deviceRouter = Router();
deviceRouter.use(authenticate);

// GET /api/devices
deviceRouter.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);

    let where: Record<string, unknown> = { deletedAt: null };

    if (req.user!.role === UserRole.BEEKEEPER) {
      const bk = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });
      where = { ...where, beekeeperId: bk?.id };
    }

    const [devices, total] = await Promise.all([
      prisma.device.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hive: { select: { hiveCode: true, name: true } },
          _count: { select: { telemetry: true } },
        },
      }),
      prisma.device.count({ where }),
    ]);

    // Don't expose hashed API keys
    const sanitized = devices.map(({ apiKey: _ak, ...d }) => d);
    res.json(paginatedResponse(sanitized, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// POST /api/devices — register a new IoT device
deviceRouter.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER),
  validate(createDeviceSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { raw, hashed } = generateDeviceApiKey();

      const beekeeper = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });

      const existing = await prisma.device.findUnique({ where: { deviceId: req.body.deviceId } });
      if (existing) throw ApiError.conflict('A device with this ID is already registered');

      const device = await prisma.device.create({
        data: {
          deviceId: req.body.deviceId,
          hiveId: req.body.hiveId,
          beekeeperId: beekeeper?.id,
          deviceType: req.body.deviceType,
          firmwareVersion: req.body.firmwareVersion,
          manufacturer: req.body.manufacturer,
          model: req.body.model,
          notes: req.body.notes,
          apiKey: hashed,
        },
      });

      // Return the raw API key ONCE — it will not be shown again
      res.status(201).json(successResponse({
        device: { id: device.id, deviceId: device.deviceId, status: device.status },
        apiKey: raw, // Show raw key once
        warning: 'Store this API key securely. It will not be shown again.',
      }, 'Device registered successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/devices/:id
deviceRouter.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const device = await prisma.device.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        hive: { select: { hiveCode: true, name: true } },
      },
    });
    if (!device) throw ApiError.notFound('Device not found');

    const { apiKey: _ak, ...safeDevice } = device;
    res.json(successResponse(safeDevice));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/devices/:id
deviceRouter.patch('/:id', authorize(UserRole.ADMIN, UserRole.BEEKEEPER), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const device = await prisma.device.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!device) throw ApiError.notFound('Device not found');

    const updated = await prisma.device.update({
      where: { id: req.params.id },
      data: {
        hiveId: req.body.hiveId,
        status: req.body.status,
        firmwareVersion: req.body.firmwareVersion,
        notes: req.body.notes,
      },
    });

    const { apiKey: _ak, ...safeDevice } = updated;
    res.json(successResponse(safeDevice, 'Device updated'));
  } catch (err) {
    next(err);
  }
});

// ─── IoT Telemetry Ingestion (device-auth, not user-auth) ────────────────────

const iotRouter = Router();

/**
 * POST /api/iot/telemetry
 * IoT device telemetry ingestion endpoint.
 * Authenticated via device-specific API key in headers.
 */
iotRouter.post(
  '/telemetry',
  validate(iotTelemetrySchema),
  async (req, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers['x-device-api-key'] as string;
      const deviceId = req.body.deviceId;

      if (!apiKey) throw ApiError.unauthorized('Device API key required (X-Device-API-Key header)');

      // Authenticate the device
      const { device } = await iotService.authenticateDevice(deviceId, apiKey);

      const result = await iotService.ingestTelemetry(device.deviceId, req.body);
      res.status(201).json(successResponse(result, 'Telemetry received'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/iot/telemetry/:deviceId — get device telemetry (requires user auth)
iotRouter.get('/telemetry/:deviceId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId: req.params.deviceId },
      select: { id: true, hiveId: true },
    });
    if (!device) throw ApiError.notFound('Device not found');
    if (!device.hiveId) {
      res.json(successResponse({ readings: [], total: 0, message: 'Device not assigned to a hive' }));
      return;
    }

    const hours = parseInt(req.query.hours as string || '24');
    const { readings, total } = await iotService.getHiveTelemetry(device.hiveId, hours);
    res.json(successResponse({ readings, total }));
  } catch (err) {
    next(err);
  }
});

export { deviceRouter, iotRouter };
