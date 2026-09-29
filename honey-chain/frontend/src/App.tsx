import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { LoadingPage } from './components/ui';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const VerifyPage = lazy(() => import('./pages/public/VerifyPage'));
const ScanQrPage = lazy(() => import('./pages/public/ScanQrPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const HivesPage = lazy(() => import('./pages/hives/HivesPage'));
const HiveDetailPage = lazy(() => import('./pages/hives/HiveDetailPage'));
const BatchesPage = lazy(() => import('./pages/batches/BatchesPage'));
const BatchDetailPage = lazy(() => import('./pages/batches/BatchDetailPage'));
const CreateBatchPage = lazy(() => import('./pages/batches/CreateBatchPage'));
const DevicesPage = lazy(() => import('./pages/devices/DevicesPage'));
const QualityPage = lazy(() => import('./pages/quality/QualityPage'));
const AiPage = lazy(() => import('./pages/ai/AiPage'));
const AlertsPage = lazy(() => import('./pages/alerts/AlertsPage'));
const MarketplacePage = lazy(() => import('./pages/marketplace/MarketplacePage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));

// Stub pages for supporting info
const StubPage = lazy(() => import('./pages/StubPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingPage />}>
          <Routes>
            {/* ── Public ──────────────────────────────────────────── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<Navigate to="/" replace />} />
            <Route path="/verify/:batchId" element={<VerifyPage />} />
            <Route path="/verify/scan" element={<ScanQrPage />} />
            <Route path="/about" element={<StubPage title="About Honey Chain" description="Honey Chain is a decentralized provenance and IoT telemetry platform for sustainable apiculture." />} />
            <Route path="/how-it-works" element={<StubPage title="How Honey Chain Works" description="Explore cryptographic Merkle tree batch verification, IoT sensor telemetry, and fair-trade marketplace mechanisms." />} />
            <Route path="/contact" element={<StubPage title="Contact & Support" description="Get in touch with the Honey Chain developer and apiary network team." />} />

            {/* ── Auth ────────────────────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* ── Dashboard ───────────────────────────────────────── */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

            {/* ── Hives ───────────────────────────────────────────── */}
            <Route path="/hives" element={<ProtectedRoute allowedRoles={['ADMIN', 'BEEKEEPER']}><HivesPage /></ProtectedRoute>} />
            <Route path="/hives/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'BEEKEEPER']}><HiveDetailPage /></ProtectedRoute>} />

            {/* ── Devices ─────────────────────────────────────────── */}
            <Route path="/devices" element={<ProtectedRoute allowedRoles={['ADMIN', 'BEEKEEPER']}><DevicesPage /></ProtectedRoute>} />
            <Route path="/telemetry" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />

            {/* ── Batches ─────────────────────────────────────────── */}
            <Route path="/batches" element={<ProtectedRoute><BatchesPage /></ProtectedRoute>} />
            <Route path="/batches/create" element={<ProtectedRoute allowedRoles={['ADMIN', 'BEEKEEPER', 'COLLECTION_CENTER']}><CreateBatchPage /></ProtectedRoute>} />
            <Route path="/batches/:id" element={<ProtectedRoute><BatchDetailPage /></ProtectedRoute>} />
            <Route path="/traceability/:batchId" element={<ProtectedRoute><BatchDetailPage /></ProtectedRoute>} />

            {/* ── Quality ─────────────────────────────────────────── */}
            <Route path="/quality" element={<ProtectedRoute allowedRoles={['ADMIN', 'QUALITY_LAB', 'BEEKEEPER']}><QualityPage /></ProtectedRoute>} />

            {/* ── AI ──────────────────────────────────────────────── */}
            <Route path="/ai" element={<ProtectedRoute allowedRoles={['ADMIN', 'BEEKEEPER']}><AiPage /></ProtectedRoute>} />
            <Route path="/ai/disease" element={<ProtectedRoute allowedRoles={['ADMIN', 'BEEKEEPER']}><AiPage /></ProtectedRoute>} />
            <Route path="/ai/productivity" element={<ProtectedRoute allowedRoles={['ADMIN', 'BEEKEEPER']}><AiPage /></ProtectedRoute>} />

            {/* ── Alerts ──────────────────────────────────────────── */}
            <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />

            {/* ── Marketplace ─────────────────────────────────────── */}
            <Route path="/marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />

            {/* ── Admin ───────────────────────────────────────────── */}
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
            <Route path="/admin/beekeepers" element={<ProtectedRoute allowedRoles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
            <Route path="/admin/organizations" element={<ProtectedRoute allowedRoles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN']}><AuditLogsPage /></ProtectedRoute>} />

            {/* ── Fallback ────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: '13px', borderRadius: '10px', fontFamily: 'Inter, sans-serif' },
          success: { iconTheme: { primary: '#f59e0b', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  );
}
