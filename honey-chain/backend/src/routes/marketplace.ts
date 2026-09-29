import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { validate, createListingSchema } from '../validators/index';
import { UserRole, ListingStatus, OrderStatus } from '@prisma/client';
import { ApiError } from '../middleware/errorHandler';
import { auditLog } from '../services/auditService';

const router = Router();

// ─── Listings ─────────────────────────────────────────────────────────────────

// GET /api/marketplace/listings — public listing view (auth optional)
router.get('/listings', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);
    const variety = req.query.variety as string | undefined;

    const where = {
      status: ListingStatus.ACTIVE,
      deletedAt: null,
      ...(variety ? { variety: { contains: variety, mode: 'insensitive' as const } } : {}),
    };

    const [listings, total] = await Promise.all([
      prisma.marketListing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          batch: {
            select: {
              publicBatchId: true,
              floralSource: true,
              variety: true,
              qualityTests: {
                where: { status: 'PASS' },
                select: { status: true, overallGrade: true },
                take: 1,
                orderBy: { testDate: 'desc' },
              },
              blockchainRecord: { select: { status: true } },
            },
          },
        },
      }),
      prisma.marketListing.count({ where }),
    ]);

    res.json(paginatedResponse(listings, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// POST /api/marketplace/listings — create listing
router.post(
  '/listings',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.BEEKEEPER, UserRole.COLLECTION_CENTER, UserRole.DISTRIBUTOR),
  validate(createListingSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const batch = await prisma.honeyBatch.findUnique({
        where: { id: req.body.batchId, deletedAt: null },
        include: { blockchainRecord: true, qualityTests: { where: { status: 'PASS' } } },
      });
      if (!batch) throw ApiError.notFound('Batch not found');

      if (!['PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAILER'].includes(batch.status)) {
        throw ApiError.unprocessable('Listings can only be created for PACKAGED, IN_DISTRIBUTION, or AT_RETAILER batches');
      }

      const listing = await prisma.marketListing.create({
        data: {
          batchId: req.body.batchId,
          sellerId: req.user!.id,
          title: req.body.title,
          description: req.body.description,
          pricePerKg: req.body.pricePerKg,
          availableQuantityKg: req.body.availableQuantityKg,
          minimumOrderKg: req.body.minimumOrderKg,
          maximumOrderKg: req.body.maximumOrderKg,
          harvestSeason: req.body.harvestSeason,
          variety: req.body.variety,
          qualityCertified: batch.qualityTests.length > 0,
          blockchainVerified: batch.blockchainRecord?.status === 'CONFIRMED',
          deliveryOptions: req.body.deliveryOptions,
          tags: req.body.tags || [],
          expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
          status: ListingStatus.ACTIVE,
        },
      });

      res.status(201).json(successResponse(listing, 'Listing created'));
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/marketplace/listings/:id
router.get('/listings/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketListing.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        batch: {
          select: {
            publicBatchId: true,
            floralSource: true,
            variety: true,
            harvestYear: true,
            qualityTests: {
              select: { status: true, overallGrade: true, testDate: true },
              orderBy: { testDate: 'desc' },
              take: 1,
            },
            blockchainRecord: { select: { status: true, registrationTxHash: true } },
          },
        },
      },
    });

    if (!listing) throw ApiError.notFound('Listing not found');
    res.json(successResponse(listing));
  } catch (err) {
    next(err);
  }
});

// ─── Orders ───────────────────────────────────────────────────────────────────

// POST /api/marketplace/orders
router.post('/orders', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketListing.findFirst({
      where: { id: req.body.listingId, status: ListingStatus.ACTIVE, deletedAt: null },
    });
    if (!listing) throw ApiError.notFound('Listing not found or no longer available');

    const qty: number = req.body.quantityKg;
    if (listing.minimumOrderKg && qty < listing.minimumOrderKg) {
      throw ApiError.badRequest(`Minimum order is ${listing.minimumOrderKg} kg`);
    }
    if (listing.maximumOrderKg && qty > listing.maximumOrderKg) {
      throw ApiError.badRequest(`Maximum order is ${listing.maximumOrderKg} kg`);
    }
    if (qty > listing.availableQuantityKg) {
      throw ApiError.unprocessable(`Only ${listing.availableQuantityKg} kg available`);
    }

    const order = await prisma.order.create({
      data: {
        listingId: req.body.listingId,
        buyerId: req.user!.id,
        quantityKg: qty,
        unitPrice: listing.pricePerKg,
        totalAmount: qty * listing.pricePerKg,
        shippingAddress: req.body.shippingAddress,
        notes: req.body.notes,
        status: OrderStatus.PENDING,
      },
    });

    await auditLog({
      userId: req.user!.id,
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: order.id,
      description: `Order for ${qty} kg at ₹${listing.pricePerKg}/kg`,
    });

    res.status(201).json(successResponse(order, 'Order placed successfully'));
  } catch (err) {
    next(err);
  }
});

// GET /api/marketplace/orders
router.get('/orders', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = Math.min(parseInt(req.query.limit as string || '20'), 100);

    const where = {
      buyerId: req.user!.id,
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: { select: { title: true, pricePerKg: true } },
          shipments: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json(paginatedResponse(orders, total, page, limit));
  } catch (err) {
    next(err);
  }
});

export default router;
