import { z } from 'zod';

// ─── Auth Validators ─────────────────────────────────────────────────────────

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    phone: z.string().optional(),
    role: z
      .enum(['CONSUMER', 'BEEKEEPER', 'COLLECTION_CENTER', 'PROCESSOR', 'QUALITY_LAB', 'DISTRIBUTOR', 'RETAILER'])
      .optional()
      .default('CONSUMER'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// ─── Hive Validators ─────────────────────────────────────────────────────────

export const createHiveSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    hiveCode: z.string().min(1).max(50).optional(),
    hiveType: z.string().optional(),
    species: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    address: z.string().optional(),
    village: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    establishedAt: z.string().datetime().optional(),
    notes: z.string().optional(),
  }),
});

// ─── Batch Validators ────────────────────────────────────────────────────────

export const createBatchSchema = z.object({
  body: z.object({
    floralSource: z.string().optional(),
    variety: z.string().optional(),
    harvestSeason: z.string().optional(),
    harvestYear: z.number().int().min(2000).max(2100).optional(),
    totalQuantityKg: z.number().positive().optional(),
    unit: z.string().optional().default('kg'),
    packagingType: z.string().optional(),
    storageConditions: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateBatchStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'DRAFT', 'COLLECTED', 'PROCESSING', 'QUALITY_TESTING',
      'APPROVED', 'PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAILER', 'SOLD', 'RECALLED'
    ]),
    notes: z.string().optional(),
    location: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

// ─── Honey Collection Validators ─────────────────────────────────────────────

export const createCollectionSchema = z.object({
  body: z.object({
    batchId: z.string().uuid(),
    hiveId: z.string().uuid(),
    collectionDate: z.string().datetime(),
    quantityKg: z.number().positive(),
    temperatureC: z.number().optional(),
    humidityPercent: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  }),
});

// ─── Quality Test Validators ──────────────────────────────────────────────────

export const createQualityTestSchema = z.object({
  body: z.object({
    batchId: z.string().uuid(),
    testDate: z.string().datetime(),
    testStandard: z.string().optional(),
    moisturePercent: z.number().min(0).max(100).optional(),
    hmfMgPerKg: z.number().min(0).optional(),
    diastaseNumber: z.number().min(0).optional(),
    electricalConductivity: z.number().optional(),
    ph: z.number().min(0).max(14).optional(),
    invertSugarPercent: z.number().min(0).max(100).optional(),
    sucrosPercent: z.number().min(0).max(100).optional(),
    fructosePercent: z.number().min(0).max(100).optional(),
    glucosePercent: z.number().min(0).max(100).optional(),
    pollenCount: z.number().int().min(0).optional(),
    pollenTypes: z.string().optional(),
    color: z.string().optional(),
    aroma: z.string().optional(),
    appearance: z.string().optional(),
    syrupAdulteration: z.boolean().optional(),
    antibioticResidues: z.boolean().optional(),
    pesticideResidues: z.boolean().optional(),
    heavyMetals: z.boolean().optional(),
    status: z.enum(['PENDING', 'PASS', 'FAIL', 'CONDITIONAL_PASS']).default('PENDING'),
    overallGrade: z.string().optional(),
    remarks: z.string().optional(),
  }),
});

// ─── IoT Telemetry Validators ─────────────────────────────────────────────────

export const iotTelemetrySchema = z.object({
  body: z.object({
    deviceId: z.string().min(1),
    timestamp: z.string().datetime(),
    temperature: z.number().optional(),
    humidity: z.number().min(0).max(100).optional(),
    weight: z.number().optional(),
    soundLevel: z.number().optional(),
    co2Level: z.number().optional(),
    batteryLevel: z.number().min(0).max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    altitude: z.number().optional(),
    rssi: z.number().optional(),
    rawPayload: z.record(z.string(), z.unknown()).optional(),
  }),
});

// ─── Device Validators ────────────────────────────────────────────────────────

export const createDeviceSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1).max(100),
    hiveId: z.string().uuid().optional(),
    deviceType: z.string().min(1),
    firmwareVersion: z.string().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// ─── Market Listing Validators ────────────────────────────────────────────────

export const createListingSchema = z.object({
  body: z.object({
    batchId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    pricePerKg: z.number().positive(),
    availableQuantityKg: z.number().positive(),
    minimumOrderKg: z.number().positive().optional(),
    maximumOrderKg: z.number().positive().optional(),
    harvestSeason: z.string().optional(),
    variety: z.string().optional(),
    deliveryOptions: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    expiresAt: z.string().datetime().optional(),
  }),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().max(100)).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

// ─── Generic Zod Validator Middleware ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';

export function validate(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as Record<string, unknown>;
      // Replace req fields with parsed (coerced) values
      if ('body' in parsed) req.body = parsed.body;
      if ('query' in parsed) Object.assign(req.query, parsed.query as object);
      if ('params' in parsed) Object.assign(req.params, parsed.params as object);
      next();
    } catch (err) {
      next(err);
    }
  };
}
