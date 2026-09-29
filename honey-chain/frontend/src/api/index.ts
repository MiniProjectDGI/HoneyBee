import api from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  AuthTokens,
  User,
  Hive,
  HoneyBatch,
  BatchEvent,
  TelemetryReading,
  Device,
  Alert,
  QualityTest,
  PublicVerificationData,
  MarketListing,
  AdminStats,
} from '../types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string; role?: string }) =>
    api.post<ApiResponse<User>>('/auth/register', data),

  login: (email: string, password: string) =>
    api.post<ApiResponse<AuthTokens>>('/auth/login', { email, password }),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh', { refreshToken }),

  getMe: () =>
    api.get<ApiResponse<User>>('/auth/me'),
};

// ─── Hives ───────────────────────────────────────────────────────────────────

export const hivesApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<Hive>>('/hives', { params }),

  create: (data: Partial<Hive>) =>
    api.post<ApiResponse<Hive>>('/hives', data),

  get: (id: string) =>
    api.get<ApiResponse<Hive>>(`/hives/${id}`),

  update: (id: string, data: Partial<Hive>) =>
    api.patch<ApiResponse<Hive>>(`/hives/${id}`, data),

  delete: (id: string) =>
    api.delete(`/hives/${id}`),

  getTelemetry: (id: string, params?: { hours?: number; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ readings: TelemetryReading[]; total: number; latest: TelemetryReading | null }>>(`/hives/${id}/telemetry`, { params }),

  getAlerts: (id: string, status?: string) =>
    api.get<ApiResponse<Alert[]>>(`/hives/${id}/alerts`, { params: { status } }),
};

// ─── Batches ─────────────────────────────────────────────────────────────────

export const batchesApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<HoneyBatch>>('/batches', { params }),

  create: (data: Partial<HoneyBatch>) =>
    api.post<ApiResponse<HoneyBatch>>('/batches', data),

  get: (id: string) =>
    api.get<ApiResponse<HoneyBatch>>(`/batches/${id}`),

  getEvents: (id: string) =>
    api.get<ApiResponse<BatchEvent[]>>(`/batches/${id}/events`),

  getTraceability: (id: string) =>
    api.get<ApiResponse<{ batch: HoneyBatch; events: BatchEvent[] }>>(`/batches/${id}/traceability`),

  updateStatus: (id: string, status: string, options?: { notes?: string; location?: string }) =>
    api.patch<ApiResponse<HoneyBatch>>(`/batches/${id}/status`, { status, ...options }),

  addCollection: (batchId: string, data: object) =>
    api.post(`/batches/${batchId}/collections`, data),

  registerBlockchain: (id: string) =>
    api.post<ApiResponse<{ txHash: string; blockNumber: number }>>(`/batches/${id}/blockchain/register`),

  verifyBlockchain: (id: string) =>
    api.get<ApiResponse<{ isRegistered: boolean; hashMatches: boolean; verificationResult: string }>>(`/batches/${id}/blockchain/verify`),

  generateQR: (id: string) =>
    api.post<ApiResponse<{ qrRecord: object; qrDataUrl: string; verificationUrl: string }>>(`/batches/${id}/qr/generate`),

  getQR: (id: string) =>
    api.get(`/batches/${id}/qr`),
};

// ─── Devices ─────────────────────────────────────────────────────────────────

export const devicesApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Device>>('/devices', { params }),

  create: (data: Partial<Device>) =>
    api.post<ApiResponse<{ device: Device; apiKey: string }>>('/devices', data),

  get: (id: string) =>
    api.get<ApiResponse<Device>>(`/devices/${id}`),

  update: (id: string, data: Partial<Device>) =>
    api.patch<ApiResponse<Device>>(`/devices/${id}`, data),
};

// ─── Quality ─────────────────────────────────────────────────────────────────

export const qualityApi = {
  list: (params?: { batchId?: string; status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<QualityTest>>('/quality', { params }),

  create: (data: Partial<QualityTest>) =>
    api.post<ApiResponse<QualityTest>>('/quality', data),

  get: (id: string) =>
    api.get<ApiResponse<QualityTest>>(`/quality/${id}`),
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alertsApi = {
  list: (params?: { status?: string; hiveId?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Alert>>('/alerts', { params }),

  acknowledge: (id: string) =>
    api.patch(`/alerts/${id}/acknowledge`),

  resolve: (id: string, notes?: string) =>
    api.patch(`/alerts/${id}/resolve`, { notes }),
};

// ─── Public ──────────────────────────────────────────────────────────────────

export const publicApi = {
  verify: (batchId: string) =>
    api.get<ApiResponse<PublicVerificationData>>(`/public/verify/${batchId}`),
};

// ─── Marketplace ─────────────────────────────────────────────────────────────

export const marketplaceApi = {
  listListings: (params?: { page?: number; limit?: number; variety?: string }) =>
    api.get<PaginatedResponse<MarketListing>>('/marketplace/listings', { params }),

  createListing: (data: object) =>
    api.post('/marketplace/listings', data),

  getListing: (id: string) =>
    api.get(`/marketplace/listings/${id}`),

  createOrder: (data: object) =>
    api.post('/marketplace/orders', data),

  listOrders: () =>
    api.get('/marketplace/orders'),
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () =>
    api.get<ApiResponse<AdminStats>>('/admin/stats'),

  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; entityType?: string }) =>
    api.get('/admin/audit-logs', { params }),

  listUsers: (params?: { page?: number }) =>
    api.get('/admin/users', { params }),

  updateUserRole: (userId: string, data: { role?: string; status?: string }) =>
    api.patch(`/admin/users/${userId}/role`, data),

  getSystemHealth: () =>
    api.get('/admin/system-health'),
};

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiApi = {
  analyzeDisease: (hiveId: string, imageUrl?: string) =>
    api.post('/ai/disease/analyze', { hiveId, imageUrl }),

  getAnalysis: (analysisId: string) =>
    api.get(`/ai/disease/${analysisId}`),

  predictProductivity: (hiveId: string) =>
    api.post('/ai/productivity/predict', { hiveId }),

  getColonyHealth: (hiveId: string) =>
    api.get(`/ai/colony/${hiveId}/health`),
};
