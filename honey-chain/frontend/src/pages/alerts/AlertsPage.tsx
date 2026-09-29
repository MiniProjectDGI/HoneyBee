import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { alertsApi } from '../../api';
import { Card, Badge, Button, PageHeader, EmptyState, LoadingPage, ErrorState } from '../../components/ui';
import { formatDateTime } from '../../utils';
import toast from 'react-hot-toast';

const SEVERITY_COLORS = {
  CRITICAL: 'bg-rose-100 text-rose-700 border-rose-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-blue-100 text-blue-700 border-blue-200',
};

const ALERT_STATUS_COLORS = {
  OPEN: 'bg-rose-50 text-rose-700',
  ACKNOWLEDGED: 'bg-amber-50 text-amber-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: alerts, isLoading, error, refetch } = useQuery({
    queryKey: ['alerts', statusFilter],
    queryFn: () => alertsApi.list({ status: statusFilter || undefined, limit: 50 }).then((r) => r.data),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => alertsApi.acknowledge(id),
    onSuccess: () => {
      toast.success('Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: () => toast.error('Failed to acknowledge alert'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => alertsApi.resolve(id, 'Resolved via web console'),
    onSuccess: () => {
      toast.success('Alert marked resolved');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: () => toast.error('Failed to resolve alert'),
  });

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load sensor alerts" retry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="IoT Sensor Alerts & Hive Incidents"
        subtitle="Automatic threshold breach notifications, acoustic anomaly detections & battery monitors"
        action={
          <div className="flex gap-2">
            {['', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  statusFilter === s
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s || 'All Incidents'}
              </button>
            ))}
          </div>
        }
      />

      {!alerts?.data?.length ? (
        <EmptyState
          title="All systems normal"
          description="No anomalies or threshold breaches reported across all monitored hive nodes."
          icon={<span className="text-5xl">🛡️</span>}
        />
      ) : (
        <div className="space-y-3">
          {alerts.data.map((alert) => (
            <Card key={alert.id} className="border-slate-200 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'HIGH' ? '⚠️' : '🔔'}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{alert.title}</h3>
                    <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS] || 'bg-slate-100'}>
                      {alert.severity}
                    </Badge>
                    <Badge className={ALERT_STATUS_COLORS[alert.status as keyof typeof ALERT_STATUS_COLORS] || 'bg-slate-100'}>
                      {alert.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 pl-7">{alert.message}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pl-7 pt-1">
                    {alert.hive && (
                      <Link to={`/hives/${alert.hiveId}`} className="text-amber-600 font-medium hover:underline">
                        Hive: {alert.hive.name} ({alert.hive.hiveCode})
                      </Link>
                    )}
                    {alert.device && <span>Device: {alert.device.deviceId}</span>}
                    <span>Detected: {formatDateTime(alert.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center pl-7 sm:pl-0">
                  {alert.status === 'OPEN' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => ackMutation.mutate(alert.id)}
                      isLoading={ackMutation.isPending}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {alert.status !== 'RESOLVED' && (
                    <Button
                      size="sm"
                      onClick={() => resolveMutation.mutate(alert.id)}
                      isLoading={resolveMutation.isPending}
                    >
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
