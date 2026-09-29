import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { validate, createQualityTestSchema } from '../validators/index';
import { UserRole } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';
import { auditLog } from '../services/auditService';

const router = Router();
router.use(authenticate);

// GET /api/quality — list quality tests
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);
    const batchId = req.query.batchId as string | undefined;
    const status = req.query.status as string | undefined;

    const where = {
      ...(batchId ? { batchId } : {}),
      ...(status ? { status: status as 'PENDING' | 'PASS' | 'FAIL' | 'CONDITIONAL_PASS' } : {}),
    };

    const [tests, total] = await Promise.all([
      prisma.qualityTest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { testDate: 'desc' },
        include: {
          batch: { select: { publicBatchId: true, status: true } },
        },
      }),
      prisma.qualityTest.count({ where }),
    ]);

    res.json(paginatedResponse(tests, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// POST /api/quality — add quality test result
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.QUALITY_LAB),
  validate(createQualityTestSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const batch = await prisma.honeyBatch.findUnique({
        where: { id: req.body.batchId, deletedAt: null },
      });
      if (!batch) throw ApiError.notFound('Batch not found');

      if (!['COLLECTED', 'PROCESSING', 'QUALITY_TESTING'].includes(batch.status)) {
        throw ApiError.unprocessable(
          `Quality tests can be added when batch status is COLLECTED, PROCESSING, or QUALITY_TESTING. Current status: ${batch.status}`
        );
      }

      const test = await prisma.qualityTest.create({
        data: {
          ...req.body,
          testDate: new Date(req.body.testDate),
          testedBy: req.user!.id,
        },
      });

      await auditLog({
        userId: req.user!.id,
        action: 'QUALITY_TEST_ADDED',
        entityType: 'QualityTest',
        entityId: test.id,
        description: `Quality test added for batch ${batch.publicBatchId}`,
        metadata: { batchId: batch.id, status: test.status },
      });

      res.status(201).json(successResponse(test, 'Quality test recorded'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/quality/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const test = await prisma.qualityTest.findUnique({
      where: { id: req.params.id },
      include: { batch: { select: { publicBatchId: true, status: true } } },
    });
    if (!test) throw ApiError.notFound('Quality test not found');
    res.json(successResponse(test));
  } catch (err) {
    next(err);
  }
});

export default router;
