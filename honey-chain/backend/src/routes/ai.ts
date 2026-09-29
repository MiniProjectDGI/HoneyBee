import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';
import { successResponse } from '../utils/helpers';
import { UserRole, AIAnalysisType } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';
import { aiProvider } from '../ai/aiProvider';
import { auditLog } from '../services/auditService';

const router = Router();
router.use(authenticate);

// POST /api/ai/disease/analyze — submit image for disease detection
router.post(
  '/disease/analyze',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hiveId, imageUrl, notes } = req.body;

      if (!hiveId) throw ApiError.badRequest('hiveId is required');

      const hive = await prisma.hive.findFirst({ where: { id: hiveId, deletedAt: null } });
      if (!hive) throw ApiError.notFound('Hive not found');

      // Create analysis record first
      const analysis = await prisma.aIAnalysis.create({
        data: {
          hiveId,
          analysisType: AIAnalysisType.DISEASE_DETECTION,
          status: 'PREDICTION_PENDING',
          requestedBy: req.user!.id,
          inputDataRef: imageUrl,
        },
      });

      // Create disease detection record
      await prisma.diseaseDetection.create({
        data: {
          analysisId: analysis.id,
          imageUrl,
          disclaimer: 'This is a machine-learning assisted analysis and should not replace professional veterinary or apiculture expert assessment.',
        },
      });

      // Call AI provider
      const result = await aiProvider.detectDisease({
        analysisId: analysis.id,
        imageUrl: imageUrl || '',
        hiveId,
      });

      // Update disease detection with result if available
      if (result.status === 'PREDICTION_AVAILABLE' && result.result) {
        const r = result.result as Record<string, unknown>;
        await prisma.diseaseDetection.update({
          where: { analysisId: analysis.id },
          data: {
            prediction: r.prediction as string,
            confidence: r.confidence as number,
            alternativeDetections: r.alternatives as object,
            recommendation: r.recommendation as string,
          },
        });
      }

      await auditLog({
        userId: req.user!.id,
        action: 'AI_ANALYSIS_CREATED',
        entityType: 'AIAnalysis',
        entityId: analysis.id,
        description: `Disease detection analysis requested for hive ${hive.hiveCode}`,
        metadata: { status: result.status },
      });

      res.status(201).json(successResponse({
        analysisId: analysis.id,
        ...result,
      }, result.status === 'MODEL_UNAVAILABLE'
        ? 'Analysis queued — AI service not currently configured'
        : 'Disease analysis completed'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/disease/:analysisId
router.get('/disease/:analysisId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const analysis = await prisma.aIAnalysis.findUnique({
      where: { id: req.params.analysisId },
      include: { diseaseDetection: true },
    });
    if (!analysis) throw ApiError.notFound('Analysis not found');
    res.json(successResponse(analysis));
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/productivity/predict
router.post(
  '/productivity/predict',
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { hiveId } = req.body;
      if (!hiveId) throw ApiError.badRequest('hiveId is required');

      const hive = await prisma.hive.findFirst({ where: { id: hiveId, deletedAt: null } });
      if (!hive) throw ApiError.notFound('Hive not found');

      const analysis = await prisma.aIAnalysis.create({
        data: {
          hiveId,
          analysisType: AIAnalysisType.PRODUCTIVITY_PREDICTION,
          status: 'PREDICTION_PENDING',
          requestedBy: req.user!.id,
        },
      });

      const result = await aiProvider.predictProductivity(hiveId);

      await prisma.aIAnalysis.update({
        where: { id: analysis.id },
        data: { status: result.status, completedAt: new Date() },
      });

      if (result.status === 'PREDICTION_AVAILABLE' && result.result) {
        const r = result.result as Record<string, unknown>;
        await prisma.productivityPrediction.create({
          data: {
            analysisId: analysis.id,
            hiveId,
            predictionPeriod: r.predictionPeriod as string || 'next 30 days',
            predictedYieldKg: r.predictedYieldKg as number,
            confidenceScore: r.confidence as number,
            lowerBoundKg: r.lowerBound as number,
            upperBoundKg: r.upperBound as number,
            modelVersion: result.modelVersion,
          },
        });
      }

      res.status(201).json(successResponse({ analysisId: analysis.id, ...result }));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/colony/:hiveId/health
router.get('/colony/:hiveId/health', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hive = await prisma.hive.findFirst({ where: { id: req.params.hiveId, deletedAt: null } });
    if (!hive) throw ApiError.notFound('Hive not found');

    const result = await aiProvider.assessColonyHealth(req.params.hiveId);
    res.json(successResponse({ hiveId: req.params.hiveId, hiveCode: hive.hiveCode, ...result }));
  } catch (err) {
    next(err);
  }
});

export default router;
