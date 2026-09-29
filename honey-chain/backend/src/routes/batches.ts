import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { validate, createBatchSchema, updateBatchStatusSchema, createCollectionSchema } from '../validators/index';
import * as batchService from '../services/batchService';
import { blockchainService } from '../blockchain/blockchainService';
import { prisma } from '../config/database';
import { successResponse } from '../utils/helpers';
import { UserRole, BatchStatus } from '@prisma/client';
import QRCode from 'qrcode';
import { config } from '../config/env';
import { auditLog } from '../services/auditService';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// All batch routes require authentication
router.use(authenticate);

// GET /api/batches — list batches (filtered by role)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);
    const status = req.query.status as BatchStatus | undefined;

    let beekeeperId: string | undefined;
    let organizationId: string | undefined;

    // Beekeepers only see their own batches unless admin
    if (req.user!.role === UserRole.BEEKEEPER) {
      const bk = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });
      beekeeperId = bk?.id;
    } else if (req.user!.role !== UserRole.ADMIN) {
      // Other roles see org batches — implementation can be extended
    }

    const result = await batchService.getBatches({ beekeeperId, organizationId, status, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/batches — create batch (beekeeper/collection center/admin)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER, UserRole.COLLECTION_CENTER),
  validate(createBatchSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const beekeeper = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });
      if (!beekeeper && req.user!.role !== UserRole.ADMIN) {
        throw ApiError.badRequest('You must have a beekeeper profile to create batches');
      }

      const batch = await batchService.createBatch(
        beekeeper?.id || req.body.beekeeperId,
        req.user!.id,
        req.body
      );
      res.status(201).json(successResponse(batch, 'Batch created successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/batches/:id — get batch details
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const batch = await batchService.getBatchById(req.params.id);
    res.json(successResponse(batch));
  } catch (err) {
    next(err);
  }
});

// GET /api/batches/:id/events — get batch event history
router.get('/:id/events', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const events = await batchService.getBatchEvents(req.params.id);
    res.json(successResponse(events));
  } catch (err) {
    next(err);
  }
});

// GET /api/batches/:id/traceability — full traceability view
router.get('/:id/traceability', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await batchService.getBatchTraceability(req.params.id);
    res.json(successResponse(data));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/batches/:id/status — update batch status
router.patch(
  '/:id/status',
  validate(updateBatchStatusSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const updated = await batchService.updateBatchStatus(
        req.params.id,
        req.user!.id,
        req.body.status as BatchStatus,
        { notes: req.body.notes, location: req.body.location, metadata: req.body.metadata }
      );
      res.json(successResponse(updated, `Batch status updated to ${req.body.status}`));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/batches/:id/collections — add honey collection record
router.post(
  '/:id/collections',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER, UserRole.COLLECTION_CENTER),
  validate(createCollectionSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const beekeeper = await prisma.beekeeper.findUnique({ where: { userId: req.user!.id } });
      if (!beekeeper) throw ApiError.badRequest('Beekeeper profile required');

      const collection = await batchService.addHoneyCollection(
        req.user!.id,
        beekeeper.id,
        { ...req.body, batchId: req.params.id }
      );
      res.status(201).json(successResponse(collection, 'Collection record added'));
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/batches/:id/blockchain/register — register batch on blockchain
router.post(
  '/:id/blockchain/register',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await blockchainService.registerBatch(req.params.id);

      await auditLog({
        userId: req.user!.id,
        action: 'BLOCKCHAIN_REGISTERED',
        entityType: 'HoneyBatch',
        entityId: req.params.id,
        description: result.success
          ? `Batch registered on blockchain. TX: ${result.txHash}`
          : `Blockchain registration failed: ${result.error}`,
        metadata: result,
      });

      if (!result.success) {
        res.status(422).json({
          success: false,
          error: { code: 'BLOCKCHAIN_ERROR', message: result.error },
        });
        return;
      }

      res.json(successResponse(result, 'Batch registered on blockchain'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/batches/:id/blockchain/verify — verify batch blockchain integrity
router.get('/:id/blockchain/verify', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await blockchainService.verifyBatch(req.params.id);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// POST /api/batches/:id/qr/generate — generate QR code for batch
router.post(
  '/:id/qr/generate',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const batch = await batchService.getBatchById(req.params.id);

      if (!['PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAILER', 'SOLD'].includes(batch.status)) {
        throw ApiError.unprocessable(
          'QR code can only be generated for batches in PACKAGED or later status'
        );
      }

      const verificationUrl = `${config.app.frontendUrl}/verify/${batch.publicBatchId}`;

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'H',
        width: 400,
        margin: 2,
      });

      // Save or update QR record
      const qrRecord = await prisma.qRCode.upsert({
        where: { batchId: batch.id },
        create: {
          batchId: batch.id,
          publicBatchId: batch.publicBatchId,
          verificationUrl,
          generatedBy: req.user!.id,
        },
        update: {
          verificationUrl,
        },
      });

      await auditLog({
        userId: req.user!.id,
        action: 'QR_GENERATED',
        entityType: 'HoneyBatch',
        entityId: batch.id,
        description: `QR code generated for batch ${batch.publicBatchId}`,
      });

      res.json(successResponse({
        qrRecord,
        qrDataUrl,
        verificationUrl,
      }, 'QR code generated successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/batches/:id/qr — get QR info
router.get('/:id/qr', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const batch = await batchService.getBatchById(req.params.id);
    const qrCode = await prisma.qRCode.findUnique({ where: { batchId: batch.id } });

    if (!qrCode) {
      throw ApiError.notFound('QR code has not been generated for this batch yet');
    }

    res.json(successResponse(qrCode));
  } catch (err) {
    next(err);
  }
});

export default router;
