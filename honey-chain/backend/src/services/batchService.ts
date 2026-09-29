import { prisma } from '../config/database';
import { ApiError } from '../middleware/errorHandler';
import {
  generatePublicBatchId,
  hashBatch,
  hashBatchEvent,
  successResponse,
  paginatedResponse,
} from '../utils/helpers';
import { logger } from '../utils/logger';
import { auditLog } from './auditService';
import { BatchStatus } from '@prisma/client';

// Valid batch state transitions
const VALID_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  DRAFT: ['COLLECTED'],
  COLLECTED: ['PROCESSING'],
  PROCESSING: ['QUALITY_TESTING'],
  QUALITY_TESTING: ['APPROVED', 'RECALLED'],
  APPROVED: ['PACKAGED', 'RECALLED'],
  PACKAGED: ['IN_DISTRIBUTION', 'RECALLED'],
  IN_DISTRIBUTION: ['AT_RETAILER', 'RECALLED'],
  AT_RETAILER: ['SOLD', 'RECALLED'],
  SOLD: ['RECALLED'],
  RECALLED: [],
};

// Event types per status transition
const TRANSITION_EVENTS: Partial<Record<BatchStatus, string>> = {
  COLLECTED: 'HONEY_COLLECTED',
  PROCESSING: 'PROCESSING_STARTED',
  QUALITY_TESTING: 'QUALITY_TESTING_STARTED',
  APPROVED: 'QUALITY_APPROVED',
  PACKAGED: 'BATCH_PACKAGED',
  IN_DISTRIBUTION: 'TRANSFERRED_TO_DISTRIBUTOR',
  AT_RETAILER: 'TRANSFERRED_TO_RETAILER',
  SOLD: 'BATCH_SOLD',
  RECALLED: 'BATCH_RECALLED',
};

export async function createBatch(
  beekeeperId: string,
  userId: string,
  data: {
    floralSource?: string;
    variety?: string;
    harvestSeason?: string;
    harvestYear?: number;
    totalQuantityKg?: number;
    unit?: string;
    packagingType?: string;
    storageConditions?: string;
    notes?: string;
  }
) {
  const beekeeper = await prisma.beekeeper.findUnique({ where: { id: beekeeperId } });
  if (!beekeeper) throw ApiError.notFound('Beekeeper profile not found');

  const publicBatchId = generatePublicBatchId();

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.honeyBatch.create({
      data: {
        publicBatchId,
        beekeeperId,
        organizationId: beekeeper.organizationId,
        clusterId: beekeeper.clusterId,
        status: BatchStatus.DRAFT,
        totalQuantityKg: data.totalQuantityKg,
        remainingQuantityKg: data.totalQuantityKg,
        floralSource: data.floralSource,
        variety: data.variety,
        harvestSeason: data.harvestSeason,
        harvestYear: data.harvestYear,
        unit: data.unit || 'kg',
        packagingType: data.packagingType,
        storageConditions: data.storageConditions,
        notes: data.notes,
      },
    });

    // Create initial batch event
    const eventPayload = {
      batchId: created.id,
      eventType: 'BATCH_CREATED',
      performedBy: userId,
      description: 'Honey batch created',
      metadata: { publicBatchId, floralSource: data.floralSource },
      eventAt: new Date(),
    };

    const eventHash = hashBatchEvent(eventPayload);

    await tx.batchEvent.create({
      data: {
        ...eventPayload,
        eventHash,
        metadata: eventPayload.metadata as object,
      },
    });

    return created;
  });

  await auditLog({
    userId,
    action: 'BATCH_CREATED',
    entityType: 'HoneyBatch',
    entityId: batch.id,
    description: `Batch ${publicBatchId} created`,
    metadata: { publicBatchId },
  });

  logger.info('Batch created', { batchId: batch.id, publicBatchId, userId });
  return batch;
}

export async function getBatches(
  filters: {
    beekeeperId?: string;
    organizationId?: string;
    status?: BatchStatus;
    page: number;
    limit: number;
  }
) {
  const where = {
    deletedAt: null,
    ...(filters.beekeeperId ? { beekeeperId: filters.beekeeperId } : {}),
    ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [batches, total] = await Promise.all([
    prisma.honeyBatch.findMany({
      where,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        beekeeper: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { events: true, qualityTests: true } },
        blockchainRecord: { select: { status: true, registrationTxHash: true } },
        qrCode: { select: { isActive: true, publicBatchId: true } },
      },
    }),
    prisma.honeyBatch.count({ where }),
  ]);

  return paginatedResponse(batches, total, filters.page, filters.limit);
}

export async function getBatchById(id: string) {
  const batch = await prisma.honeyBatch.findFirst({
    where: { OR: [{ id }, { publicBatchId: id }], deletedAt: null },
    include: {
      beekeeper: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          organization: { select: { name: true, code: true } },
          cluster: { select: { name: true, code: true } },
        },
      },
      collections: { include: { hive: true } },
      processingRecords: true,
      qualityTests: true,
      blockchainRecord: true,
      qrCode: true,
      documents: { where: { deletedAt: null } },
      _count: { select: { events: true, consumerVerifications: true } },
    },
  });

  if (!batch) throw ApiError.notFound('Batch not found');
  return batch;
}

export async function getBatchTraceability(batchId: string) {
  const batch = await getBatchById(batchId);
  const events = await prisma.batchEvent.findMany({
    where: { batchId: batch.id },
    orderBy: { eventAt: 'asc' },
  });

  return {
    batch,
    events,
    eventCount: events.length,
  };
}

export async function updateBatchStatus(
  batchId: string,
  userId: string,
  newStatus: BatchStatus,
  options?: { notes?: string; location?: string; metadata?: Record<string, unknown> }
) {
  const batch = await prisma.honeyBatch.findFirst({
    where: { id: batchId, deletedAt: null },
  });

  if (!batch) throw ApiError.notFound('Batch not found');

  const allowedNext = VALID_TRANSITIONS[batch.status];
  if (!allowedNext.includes(newStatus)) {
    throw ApiError.unprocessable(
      `Invalid status transition from ${batch.status} to ${newStatus}. Allowed: ${allowedNext.join(', ') || 'none'}`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const eventType = TRANSITION_EVENTS[newStatus] || `STATUS_CHANGED_TO_${newStatus}`;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBatch = await tx.honeyBatch.update({
      where: { id: batchId },
      data: {
        status: newStatus,
        ...(newStatus === 'RECALLED' ? { recalledAt: new Date(), recallReason: options?.notes } : {}),
        ...(newStatus === 'SOLD' || newStatus === 'PACKAGED' ? { finalizedAt: new Date() } : {}),
      },
    });

    const eventPayload = {
      batchId,
      eventType,
      performedBy: userId,
      description: options?.notes || `Batch status changed to ${newStatus}`,
      metadata: {
        fromStatus: batch.status,
        toStatus: newStatus,
        location: options?.location,
        ...(options?.metadata || {}),
      },
      eventAt: new Date(),
    };

    const eventHash = hashBatchEvent(eventPayload);

    await tx.batchEvent.create({
      data: {
        ...eventPayload,
        location: options?.location,
        eventHash,
        metadata: eventPayload.metadata as object,
      },
    });

    return updatedBatch;
  });

  await auditLog({
    userId,
    action: 'BATCH_STATUS_CHANGED',
    entityType: 'HoneyBatch',
    entityId: batchId,
    description: `Batch ${batch.publicBatchId} status: ${batch.status} → ${newStatus}`,
    metadata: { fromStatus: batch.status, toStatus: newStatus },
  });

  return updated;
}

export async function addHoneyCollection(
  userId: string,
  beekeeperId: string,
  data: {
    batchId: string;
    hiveId: string;
    collectionDate: string;
    quantityKg: number;
    temperatureC?: number;
    humidityPercent?: number;
    notes?: string;
  }
) {
  const batch = await prisma.honeyBatch.findFirst({
    where: { id: data.batchId, beekeeperId, deletedAt: null },
  });
  if (!batch) throw ApiError.notFound('Batch not found or access denied');

  const hive = await prisma.hive.findFirst({
    where: { id: data.hiveId, beekeeperId },
  });
  if (!hive) throw ApiError.notFound('Hive not found or access denied');

  const collection = await prisma.$transaction(async (tx) => {
    const col = await tx.honeyCollection.create({
      data: {
        batchId: data.batchId,
        hiveId: data.hiveId,
        beekeeperId,
        collectionDate: new Date(data.collectionDate),
        quantityKg: data.quantityKg,
        temperatureC: data.temperatureC,
        humidityPercent: data.humidityPercent,
        notes: data.notes,
        collectedBy: userId,
      },
    });

    // Update batch quantity
    await tx.honeyBatch.update({
      where: { id: data.batchId },
      data: {
        totalQuantityKg: { increment: data.quantityKg },
        remainingQuantityKg: { increment: data.quantityKg },
      },
    });

    // Append event
    const eventPayload = {
      batchId: data.batchId,
      eventType: 'HONEY_COLLECTED',
      performedBy: userId,
      description: `${data.quantityKg} kg honey collected from hive ${hive.hiveCode}`,
      metadata: { hiveId: data.hiveId, hiveCode: hive.hiveCode, quantityKg: data.quantityKg },
      eventAt: new Date(data.collectionDate),
    };
    await tx.batchEvent.create({
      data: {
        ...eventPayload,
        eventHash: hashBatchEvent(eventPayload),
        metadata: eventPayload.metadata as object,
      },
    });

    return col;
  });

  return collection;
}

export async function getBatchEvents(batchId: string) {
  const events = await prisma.batchEvent.findMany({
    where: { batchId },
    orderBy: { eventAt: 'asc' },
  });
  return events;
}

// Public verification (no auth required)
export async function publicVerifyBatch(publicBatchId: string, ipAddress?: string, userId?: string) {
  const batch = await prisma.honeyBatch.findFirst({
    where: { publicBatchId, deletedAt: null },
    include: {
      beekeeper: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          organization: { select: { name: true } },
          cluster: { select: { name: true, district: true, state: true } },
        },
      },
      collections: {
        include: {
          hive: {
            select: { hiveCode: true, village: true, district: true, state: true },
          },
        },
        orderBy: { collectionDate: 'asc' },
      },
      processingRecords: { orderBy: { processedAt: 'asc' } },
      qualityTests: {
        select: {
          status: true,
          testDate: true,
          overallGrade: true,
          moisturePercent: true,
          testStandard: true,
        },
        orderBy: { testDate: 'asc' },
      },
      blockchainRecord: true,
      events: { orderBy: { eventAt: 'asc' } },
      qrCode: { select: { isActive: true } },
    },
  });

  let verificationResult = 'BATCH_NOT_FOUND';
  let blockchainVerified = false;

  if (!batch) {
    // Record failed verification attempt
    await prisma.consumerVerification.create({
      data: {
        batchId: 'unknown',
        publicBatchId,
        userId,
        ipAddress,
        verificationResult: 'BATCH_NOT_FOUND',
        blockchainVerified: false,
      },
    });
    return { verificationResult: 'BATCH_NOT_FOUND', batch: null };
  }

  // Check blockchain integrity
  if (batch.blockchainRecord && batch.blockchainRecord.status === 'CONFIRMED') {
    const expectedHash = hashBatch(batch);
    blockchainVerified = expectedHash === batch.blockchainRecord.batchHash;
    verificationResult = blockchainVerified ? 'VERIFIED' : 'BLOCKCHAIN_MISMATCH';
  } else {
    verificationResult = 'NOT_BLOCKCHAIN_REGISTERED';
  }

  // Update QR scan count
  if (batch.qrCode) {
    await prisma.qRCode.update({
      where: { batchId: batch.id },
      data: { scanCount: { increment: 1 } },
    });
  }

  // Log verification
  await prisma.consumerVerification.create({
    data: {
      batchId: batch.id,
      publicBatchId,
      userId,
      ipAddress,
      verificationResult,
      blockchainVerified,
    },
  });

  // Return only public-safe information
  return {
    verificationResult,
    blockchainVerified,
    batch: {
      publicBatchId: batch.publicBatchId,
      status: batch.status,
      floralSource: batch.floralSource,
      variety: batch.variety,
      harvestSeason: batch.harvestSeason,
      harvestYear: batch.harvestYear,
      totalQuantityKg: batch.totalQuantityKg,
      packagingType: batch.packagingType,
      finalizedAt: batch.finalizedAt,
      producer: {
        name: `${batch.beekeeper.user.firstName} ${batch.beekeeper.user.lastName.charAt(0)}.`,
        organization: batch.beekeeper.organization?.name,
        cluster: batch.beekeeper.cluster?.name,
        district: batch.beekeeper.district,
        state: batch.beekeeper.state,
      },
      collections: batch.collections.map((c) => ({
        collectionDate: c.collectionDate,
        quantityKg: c.quantityKg,
        hive: c.hive,
      })),
      processingRecords: batch.processingRecords.map((p) => ({
        processedAt: p.processedAt,
        processingType: p.processingType,
      })),
      qualityTests: batch.qualityTests,
      events: batch.events.map((e) => ({
        eventType: e.eventType,
        description: e.description,
        eventAt: e.eventAt,
        eventHash: e.eventHash,
      })),
      blockchainRecord: batch.blockchainRecord
        ? {
            status: batch.blockchainRecord.status,
            registrationTxHash: batch.blockchainRecord.registrationTxHash,
            registrationBlock: batch.blockchainRecord.registrationBlock,
            registrationAt: batch.blockchainRecord.registrationAt,
          }
        : null,
    },
  };
}
