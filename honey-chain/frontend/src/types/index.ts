// All TypeScript types for the Honey Chain frontend

export type UserRole =
  | 'ADMIN'
  | 'BEEKEEPER'
  | 'COLLECTION_CENTER'
  | 'PROCESSOR'
  | 'QUALITY_LAB'
  | 'DISTRIBUTOR'
  | 'RETAILER'
  | 'CONSUMER';

export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export type BatchStatus =
  | 'DRAFT'
  | 'COLLECTED'
  | 'PROCESSING'
  | 'QUALITY_TESTING'
  | 'APPROVED'
  | 'PACKAGED'
  | 'IN_DISTRIBUTION'
  | 'AT_RETAILER'
  | 'SOLD'
  | 'RECALLED';

export type HiveStatus = 'ACTIVE' | 'INACTIVE' | 'ABANDONED' | 'MIGRATED';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'DECOMMISSIONED';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export type AIModelStatus =
  | 'MODEL_AVAILABLE'
  | 'MODEL_UNAVAILABLE'
  | 'PREDICTION_PENDING'
  | 'PREDICTION_AVAILABLE'
  | 'PREDICTION_FAILED'
  | 'INSUFFICIENT_DATA';

export type QualityStatus = 'PENDING' | 'PASS' | 'FAIL' | 'CONDITIONAL_PASS';

export type BlockchainRecordStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNVERIFIED';

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl?: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  beekeeper?: {
    id: string;
    beekeeperCode: string;
    organizationId?: string;
    clusterId?: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'status'>;
}

// ─── Hive Types ───────────────────────────────────────────────────────────────

export interface Hive {
  id: string;
  beekeeperId: string;
  hiveCode: string;
  name: string;
  hiveType?: string;
  species?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  village?: string;
  district?: string;
  state?: string;
  status: HiveStatus;
  establishedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  beekeeper?: {
    user: { firstName: string; lastName: string };
  };
  _count?: {
    sensors: number;
    healthRecords: number;
    honeyCollections: number;
  };
}

// ─── Batch Types ──────────────────────────────────────────────────────────────

export interface HoneyBatch {
  id: string;
  publicBatchId: string;
  beekeeperId: string;
  status: BatchStatus;
  floralSource?: string;
  variety?: string;
  harvestSeason?: string;
  harvestYear?: number;
  totalQuantityKg?: number;
  remainingQuantityKg?: number;
  unit: string;
  packagingType?: string;
  storageConditions?: string;
  notes?: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
  beekeeper?: {
    user: { firstName: string; lastName: string };
    organization?: { name: string };
    cluster?: { name: string };
  };
  blockchainRecord?: {
    status: BlockchainRecordStatus;
    registrationTxHash?: string;
    merkleRoot?: string;
    dataHash?: string;
    registeredAt?: string;
  };
  qrCode?: {
    isActive: boolean;
    publicBatchId: string;
    qrImageUrl?: string;
  };
  collections?: Array<{
    id: string;
    collectionDate: string;
    quantityKg: number;
    hive?: { hiveCode: string; name: string };
  }>;
  processingRecords?: Array<{
    id: string;
    processType: string;
    startDate: string;
    endDate?: string;
    facilityName?: string;
    status: string;
  }>;
  qualityTests?: QualityTest[];
  documents?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    documentType: string;
  }>;
  _count?: {
    events: number;
    qualityTests: number;
    consumerVerifications?: number;
  };
}

export interface BatchEvent {
  id: string;
  batchId: string;
  eventType: string;
  performedBy: string;
  description: string;
  metadata?: Record<string, unknown>;
  location?: string;
  eventHash?: string;
  blockchainTxHash?: string;
  eventAt: string;
  createdAt: string;
}

// ─── IoT Types ────────────────────────────────────────────────────────────────

export interface TelemetryReading {
  id: string;
  temperature?: number;
  humidity?: number;
  weight?: number;
  soundLevel?: number;
  batteryLevel?: number;
  recordedAt: string;
  anomalyDetected: boolean;
}

export interface Device {
  id: string;
  deviceId: string;
  hiveId?: string;
  deviceType: string;
  firmwareVersion?: string;
  manufacturer?: string;
  model?: string;
  status: DeviceStatus;
  lastSeenAt?: string;
  batteryLevel?: number;
  hive?: { hiveCode: string; name: string };
}

// ─── Alert Types ──────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  hiveId?: string;
  deviceId?: string;
  alertType: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  acknowledgedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  hive?: { hiveCode: string; name: string };
  device?: { deviceId: string; deviceType: string };
}

// ─── Quality Test Types ───────────────────────────────────────────────────────

export interface QualityTest {
  id: string;
  batchId: string;
  testDate: string;
  testStandard?: string;
  moisturePercent?: number;
  hmfMgPerKg?: number;
  ph?: number;
  status: QualityStatus;
  overallGrade?: string;
  remarks?: string;
  batch?: { publicBatchId: string; status: BatchStatus };
}

// ─── Public Verification Types ────────────────────────────────────────────────

export type VerificationResult =
  | 'VERIFIED'
  | 'BLOCKCHAIN_MISMATCH'
  | 'NOT_BLOCKCHAIN_REGISTERED'
  | 'BATCH_NOT_FOUND'
  | 'NOT_REGISTERED';

export interface PublicVerificationData {
  verificationResult: VerificationResult;
  blockchainVerified: boolean;
  batch: {
    publicBatchId: string;
    status: BatchStatus;
    floralSource?: string;
    variety?: string;
    harvestSeason?: string;
    harvestYear?: number;
    totalQuantityKg?: number;
    packagingType?: string;
    finalizedAt?: string;
    producer: {
      name: string;
      organization?: string;
      cluster?: string;
      district?: string;
      state?: string;
    };
    collections: Array<{
      collectionDate: string;
      quantityKg: number;
      hive: { hiveCode: string; village?: string; district?: string; state?: string };
    }>;
    processingRecords: Array<{ processedAt: string; processingType: string }>;
    qualityTests: Array<{ status: QualityStatus; testDate: string; overallGrade?: string; testStandard?: string }>;
    events: Array<{ eventType: string; description: string; eventAt: string; eventHash?: string }>;
    blockchainRecord?: {
      status: BlockchainRecordStatus;
      registrationTxHash?: string;
      registrationBlock?: number;
      registrationAt?: string;
    };
  } | null;
}

// ─── Market Types ────────────────────────────────────────────────────────────

export interface MarketListing {
  id: string;
  batchId: string;
  title: string;
  description?: string;
  pricePerKg: number;
  currency: string;
  availableQuantityKg: number;
  variety?: string;
  qualityCertified: boolean;
  blockchainVerified: boolean;
  status: string;
  createdAt: string;
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export interface AdminStats {
  users: { total: number };
  beekeepers: { total: number };
  hives: { active: number };
  devices: { active: number };
  batches: {
    total: number;
    blockchainVerified: number;
    pendingQualityTests: number;
    recentLast30Days: number;
    byStatus: Record<BatchStatus, number>;
  };
  alerts: {
    open: number;
    bySeverity: Record<AlertSeverity, number>;
  };
  blockchain: {
    registrations: number;
    networkInfo: {
      connected: boolean;
      network?: { chainId: number; name: string };
      blockNumber?: number;
    };
  };
  orders: { total: number };
  generatedAt: string;
}
