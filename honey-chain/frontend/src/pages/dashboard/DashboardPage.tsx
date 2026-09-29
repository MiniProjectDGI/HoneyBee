import { useQuery } from '@tanstack/react-query';
import { adminApi, hivesApi, batchesApi, alertsApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Card, StatCard, LoadingPage, ErrorState, Badge } from '../../components/ui';
import { formatDate, BATCH_STATUS_COLORS, BATCH_STATUS_LABELS, ALERT_SEVERITY_COLORS } from '../../utils';
import { Link } from 'react-router-dom';
import {
  Layers,
  Package,
  Scale,
  Bell,
  Cpu,
  ShieldCheck,
  FlaskConical,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Activity,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Admin stats — real data from database
  const { data: adminStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats().then((r) => r.data.data),
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  // Beekeeper's hives
  const { data: hivesData } = useQuery({
    queryKey: ['hives', { limit: 5 }],
    queryFn: () => hivesApi.list({ limit: 5 }).then((r) => r.data),
  });

  // Recent batches
  const { data: batchesData, isLoading: batchLoading } = useQuery({
    queryKey: ['batches', { limit: 5 }],
    queryFn: () => batchesApi.list({ limit: 5 }).then((r) => r.data),
  });

  // Alerts
  const { data: alertsData } = useQuery({
    queryKey: ['alerts', { status: 'OPEN', limit: 5 }],
    queryFn: () => alertsApi.list({ status: 'OPEN' }).then((r) => r.data),
  });

  if (isAdmin && statsLoading) return <LoadingPage />;
  if (isAdmin && statsError) {
    return <ErrorState message="Failed to load dashboard statistics" />;
  }

  // Calculate greeting by time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Extract totals from real API responses
  const activeHivesCount = hivesData?.pagination.total ?? 0;
  const activeBatchesCount = batchesData?.pagination.total ?? 0;
  const openAlertsCount = alertsData?.pagination.total ?? 0;

  // Real production estimate from existing batches
  const totalProductionKg = batchesData?.data?.reduce((sum, b) => sum + (b.totalQuantityKg || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Top Greeting ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-6 rounded-2xl border border-[#e8e4dc]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
            {greeting}, {user?.firstName || 'Beekeeper'}
          </h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' • '}
            <span className="text-[#0f172a] font-medium">{user?.role || 'Beekeeper'} Workspace</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/batches/create"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>New Harvest Batch</span>
          </Link>
          <Link
            to="/verify/scan"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#faf9f6] hover:bg-[#f5f3ee] text-[#0f172a] border border-[#e8e4dc] px-3.5 py-2 rounded-lg transition-colors"
          >
            <span>Scan QR</span>
          </Link>
        </div>
      </div>

      {/* ── Overview: Active Hives, Active Batches, Production, Alerts ──── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Hives"
          value={activeHivesCount}
          icon={<Layers className="w-5 h-5 text-[#0f172a]" />}
        />
        <StatCard
          label="Active Batches"
          value={activeBatchesCount}
          icon={<Package className="w-5 h-5 text-[#d97706]" />}
        />
        <StatCard
          label="Production (Kg)"
          value={totalProductionKg > 0 ? `${totalProductionKg.toLocaleString()} kg` : '0 kg'}
          icon={<Scale className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          label="Alerts"
          value={openAlertsCount}
          icon={<Bell className="w-5 h-5 text-red-500" />}
          valueClassName={openAlertsCount > 0 ? 'text-red-600' : 'text-[#0f172a]'}
        />
      </div>

      {/* Admin specific system metrics if admin */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active IoT Devices"
            value={adminStats.devices.active}
            icon={<Cpu className="w-5 h-5 text-sky-600" />}
          />
          <StatCard
            label="Blockchain Verified"
            value={adminStats.blockchain.registrations}
            icon={<ShieldCheck className="w-5 h-5 text-[#15803d]" />}
          />
          <StatCard
            label="Pending Quality Tests"
            value={adminStats.batches.pendingQualityTests}
            icon={<FlaskConical className="w-5 h-5 text-amber-600" />}
            valueClassName={adminStats.batches.pendingQualityTests > 0 ? 'text-amber-600' : ''}
          />
          <StatCard
            label="Registered Users"
            value={adminStats.users.total}
            icon={<Users className="w-5 h-5 text-[#475569]" />}
          />
        </div>
      )}

      {/* ── Hive Health & Production Trends ───────────────────────────── */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Hive Health Card */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#e8e4dc] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#d97706]" />
              <h3 className="font-bold text-sm text-[#0f172a]">Colony Vitality & Hive Status</h3>
            </div>
            <Link to="/hives" className="text-xs font-semibold text-[#0f172a] hover:text-[#d97706] inline-flex items-center gap-1">
              <span>View all hives</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {!hivesData?.data?.length ? (
            <div className="py-8 text-center border border-dashed border-[#e8e4dc] rounded-xl bg-[#faf9f6]">
              <Layers className="w-6 h-6 text-[#64748b] mx-auto mb-1" />
              <p className="text-xs font-semibold text-[#0f172a]">No hives registered yet.</p>
              <Link to="/hives" className="text-xs text-[#d97706] hover:underline mt-1 inline-block">
                Register your first hive →
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {hivesData.data.slice(0, 3).map((hive) => (
                <div key={hive.id} className="flex items-center justify-between p-3 rounded-xl bg-[#faf9f6] border border-[#e8e4dc]">
                  <div>
                    <div className="font-semibold text-xs text-[#0f172a]">{hive.name}</div>
                    <div className="text-[11px] text-[#64748b]">
                      {hive.species || 'Apis cerana'} • {[hive.village, hive.district, hive.state].filter(Boolean).join(', ') || 'Apiary Base Yard'}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded">
                    {hive.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights & Traceability Summary */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#e8e4dc] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-[#0f172a]">AI Insights & Quality Auditing</h3>
            </div>
            <Link to="/ai" className="text-xs font-semibold text-[#0f172a] hover:text-[#d97706] inline-flex items-center gap-1">
              <span>AI Engine</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-[#faf9f6] border border-[#e8e4dc] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0f172a]">Continuous Telemetry Evaluation</span>
              <span className="text-[10px] font-mono text-[#15803d] bg-[#f0fdf4] px-2 py-0.5 rounded">MODEL ACTIVE</span>
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Automated acoustic anomaly detection and moisture compliance checking run continuously on all registered IoT endpoints.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#faf9f6] border border-[#e8e4dc]">
              <span className="text-[10px] text-[#64748b] uppercase block">Traceability Hash</span>
              <span className="font-mono font-semibold text-[#0f172a]">SHA-256 Merkle</span>
            </div>
            <div className="p-3 rounded-xl bg-[#faf9f6] border border-[#e8e4dc]">
              <span className="text-[10px] text-[#64748b] uppercase block">Quality Protocol</span>
              <span className="font-semibold text-[#0f172a]">Codex CXS 12</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Batches ────────────────────────────────────────────── */}
      <Card padding="none" className="border-[#e8e4dc]">
        <div className="px-6 py-4 border-b border-[#e8e4dc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#d97706]" />
            <h3 className="font-bold text-sm text-[#0f172a]">Recent Honey Batches</h3>
          </div>
          <Link to="/batches" className="text-xs font-semibold text-[#0f172a] hover:text-[#d97706] inline-flex items-center gap-1">
            <span>View all batches</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {batchLoading ? (
          <div className="px-6 py-8 text-center text-[#64748b] text-xs">Loading batches...</div>
        ) : !batchesData?.data?.length ? (
          <div className="px-6 py-10 text-center space-y-2">
            <Package className="w-8 h-8 text-[#64748b] mx-auto" />
            <p className="text-xs font-medium text-[#0f172a]">No honey batches registered yet.</p>
            <Link to="/batches/create" className="text-xs font-semibold text-[#d97706] hover:underline inline-block">
              Create your first harvest batch →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#f1ede5]">
            {batchesData.data.map((batch) => (
              <Link
                key={batch.id}
                to={`/batches/${batch.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-[#faf9f6] transition-colors"
              >
                <div>
                  <p className="text-xs font-mono font-bold text-[#0f172a]">{batch.publicBatchId}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">
                    {batch.variety || batch.floralSource || 'Raw Honey'} • {batch.totalQuantityKg ? `${batch.totalQuantityKg} kg` : 'Weight pending'} • {formatDate(batch.createdAt)}
                  </p>
                </div>
                <Badge className={BATCH_STATUS_COLORS[batch.status]}>
                  {BATCH_STATUS_LABELS[batch.status]}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* ── Recent Alerts ─────────────────────────────────────────────── */}
      <Card padding="none" className="border-[#e8e4dc]">
        <div className="px-6 py-4 border-b border-[#e8e4dc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#d97706]" />
            <h3 className="font-bold text-sm text-[#0f172a]">Recent Alerts</h3>
          </div>
          <Link to="/alerts" className="text-xs font-semibold text-[#0f172a] hover:text-[#d97706] inline-flex items-center gap-1">
            <span>Alerts center</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {!alertsData?.data?.length ? (
          <div className="px-6 py-8 text-center text-xs text-[#64748b] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
            <span>All monitored colonies operating within nominal parameters. No active alerts.</span>
          </div>
        ) : (
          <div className="divide-y divide-[#f1ede5]">
            {alertsData.data.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 px-6 py-3.5">
                <Badge className={ALERT_SEVERITY_COLORS[alert.severity]} dot>
                  {alert.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0f172a]">{alert.title}</p>
                  <p className="text-[11px] text-[#64748b] truncate">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
