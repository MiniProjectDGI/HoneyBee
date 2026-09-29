import crypto from 'crypto';

/**
 * Create a deterministic canonical JSON string from an object.
 * Keys are sorted to ensure identical output regardless of insertion order.
 */
export function toCanonicalJson(obj: unknown): string {
  return JSON.stringify(sortObjectKeys(obj));
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce((sorted: Record<string, unknown>, key) => {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
        return sorted;
      }, {});
  }
  return obj;
}

/**
 * Compute SHA-256 hash of a string and return hex digest.
 */
export function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Hash a batch event record for blockchain integrity verification.
 */
export function hashBatchEvent(event: {
  batchId: string;
  eventType: string;
  performedBy: string;
  description: string;
  metadata?: unknown;
  eventAt: Date | string;
}): string {
  const canonical = toCanonicalJson({
    batchId: event.batchId,
    eventType: event.eventType,
    performedBy: event.performedBy,
    description: event.description,
    metadata: event.metadata || null,
    eventAt: new Date(event.eventAt).toISOString(),
  });
  return sha256Hex(canonical);
}

/**
 * Hash a batch's core data for blockchain registration.
 */
export function hashBatch(batch: {
  id: string;
  publicBatchId: string;
  beekeeperId: string;
  status: string;
  totalQuantityKg?: number | null;
  floralSource?: string | null;
  variety?: string | null;
  harvestYear?: number | null;
  createdAt: Date | string;
}): string {
  const canonical = toCanonicalJson({
    id: batch.id,
    publicBatchId: batch.publicBatchId,
    beekeeperId: batch.beekeeperId,
    status: batch.status,
    totalQuantityKg: batch.totalQuantityKg ?? null,
    floralSource: batch.floralSource ?? null,
    variety: batch.variety ?? null,
    harvestYear: batch.harvestYear ?? null,
    createdAt: new Date(batch.createdAt).toISOString(),
  });
  return sha256Hex(canonical);
}

/**
 * Generate a unique public batch ID.
 * Format: HC-YYYYMM-XXXXXX
 */
export function generatePublicBatchId(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `HC-${yyyymm}-${random}`;
}

/**
 * Generate a unique beekeeper code.
 */
export function generateBeekeeperCode(): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BK-${random}`;
}

/**
 * Generate a unique hive code.
 */
export function generateHiveCode(beekeeperCode: string): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${beekeeperCode}-H${random}`;
}

/**
 * Generate a device API key (for IoT device authentication).
 * Returns the raw key — should be hashed before storage.
 */
export function generateDeviceApiKey(): { raw: string; hashed: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hashed = sha256Hex(raw);
  return { raw, hashed };
}

/**
 * Verify a device API key against its stored hash.
 */
export function verifyDeviceApiKey(rawKey: string, storedHash: string): boolean {
  const hash = sha256Hex(rawKey);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

/**
 * Build a paginated response object.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean } {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Standard API success response helper.
 */
export function successResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
}

/**
 * Standard API paginated response.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string
) {
  return {
    success: true,
    data,
    pagination: buildPaginationMeta(total, page, limit),
    ...(message ? { message } : {}),
  };
}
