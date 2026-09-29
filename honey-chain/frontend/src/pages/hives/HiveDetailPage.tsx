import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { hivesApi, aiApi } from '../../api';
import { Card, Badge, LoadingPage, ErrorState, EmptyState } from '../../components/ui';
import { formatDateTime, formatDate } from '../../utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function HiveDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: hive, isLoading, error, refetch } = useQuery({
    queryKey: ['hive', id],
    queryFn: () => hivesApi.get(id!).then((r) => r.data.data),
  });

  const { data: telemetryData } = useQuery({
    queryKey: ['hive-telemetry', id, { hours: 24 }],
    queryFn: () => hivesApi.getTelemetry(id!, { hours: 24, limit: 100 }).then((r) => r.data.data),
    enabled: !!id,
    refetchInterval: 60000,
  });

  const { data: healthData } = useQuery({
    queryKey: ['hive-health', id],
    queryFn: () => aiApi.getColonyHealth(id!).then((r) => r.data.data as { status: string; message: string; result?: { healthScore: number; healthCategory: string; issues: string[] } }),
    enabled: !!id,
  });

  const { data: alerts } = useQuery({
    queryKey: ['hive-alerts', id],
    queryFn: () => hivesApi.getAlerts(id!, 'OPEN').then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) return <LoadingPage />;
  if (error || !hive) return <ErrorState message="Hive not found" retry={refetch} />;

  const latest = telemetryData?.latest;
  const chartData = (telemetryData?.readings || []).slice().reverse().map((r) => ({
    time: new Date(r.recordedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    temperature: r.temperature,
    humidity: r.humidity,
    weight: r.weight,
    battery: r.batteryLevel,
  }));

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐝</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{hive.name}</h1>
            <p className="text-sm font-mono text-amber-600">{hive.hiveCode}</p>
          </div>
        </div>
      </div>

      {/* Live Sensor Values */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Temperature', value: latest?.temperature != null ? `${latest.temperature.toFixed(1)}°C` : '—', icon: '🌡️', warning: latest?.temperature && (latest.temperature > 38 || latest.temperature < 32) },
          { label: 'Humidity', value: latest?.humidity != null ? `${latest.humidity.toFixed(1)}%` : '—', icon: '💧', warning: latest?.humidity && (latest.humidity > 70 || latest.humidity < 40) },
          { label: 'Weight', value: latest?.weight != null ? `${latest.weight.toFixed(2)} kg` : '—', icon: '⚖️', warning: false },
          { label: 'Battery', value: latest?.batteryLevel != null ? `${latest.batteryLevel.toFixed(0)}%` : '—', icon: '🔋', warning: latest?.batteryLevel && latest.batteryLevel < 20 },
        ].map((stat) => (
          <Card key={stat.label} className={stat.warning ? 'border-orange-200' : ''}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{stat.label}</span>
              <span className="text-base">{stat.icon}</span>
            </div>
            <p className={`text-xl font-bold ${stat.warning ? 'text-orange-600' : 'text-slate-800'}`}>{stat.value}</p>
            {latest?.recordedAt && <p className="text-xs text-slate-400 mt-1">As of {formatDateTime(latest.recordedAt)}</p>}
          </Card>
        ))}
      </div>

      {/* AI Colony Health */}
      {healthData && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-800">Colony Health Assessment</h2>
            <Badge className={
              healthData.status === 'PREDICTION_AVAILABLE' ? 'bg-green-100 text-green-700' :
              healthData.status === 'INSUFFICIENT_DATA' ? 'bg-yellow-100 text-yellow-700' :
              'bg-slate-100 text-slate-600'
            }>
              {healthData.status?.replace(/_/g, ' ')}
            </Badge>
          </div>
          {healthData.result ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl font-bold text-slate-800">{healthData.result.healthScore}</div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{healthData.result.healthCategory}</p>
                  <p className="text-xs text-slate-400">Rule-based score</p>
                </div>
              </div>
              {healthData.result.issues.length > 0 && (
                <ul className="space-y-1">
                  {healthData.result.issues.map((issue: string, i: number) => (
                    <li key={i} className="text-xs text-orange-700 flex items-center gap-1.5">
                      <span>⚠️</span> {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{healthData.message}</p>
          )}
        </Card>
      )}

      {/* Temperature & Humidity Chart */}
      <Card>
        <h2 className="font-semibold text-slate-800 mb-4">Temperature & Humidity (Last 24h)</h2>
        {chartData.length === 0 ? (
          <EmptyState title="No sensor data available" description="No telemetry readings in the last 24 hours. Check that your IoT device is connected and sending data." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="temperature" stroke="#f59e0b" name="Temp (°C)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="humidity" stroke="#0ea5e9" name="Humidity (%)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Weight Chart */}
      {chartData.some((d) => d.weight != null) && (
        <Card>
          <h2 className="font-semibold text-slate-800 mb-4">Hive Weight (Last 24h)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" kg" />
              <Tooltip />
              <Line type="monotone" dataKey="weight" stroke="#22c55e" name="Weight (kg)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Open Alerts */}
      <Card>
        <h2 className="font-semibold text-slate-800 mb-3">Open Alerts</h2>
        {!alerts?.length ? (
          <p className="text-sm text-slate-400 py-3 text-center">✅ No open alerts for this hive</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                  alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                  alert.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {alert.severity}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{alert.title}</p>
                  <p className="text-xs text-slate-500">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Hive Info */}
      <Card>
        <h2 className="font-semibold text-slate-800 mb-3">Hive Information</h2>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
          {[
            { label: 'Hive Code', value: hive.hiveCode },
            { label: 'Status', value: hive.status },
            { label: 'Type', value: hive.hiveType || 'Not specified' },
            { label: 'Species', value: hive.species || 'Not specified' },
            { label: 'Village', value: hive.village || 'Not specified' },
            { label: 'District', value: hive.district || 'Not specified' },
            { label: 'State', value: hive.state || 'Not specified' },
            { label: 'Established', value: hive.establishedAt ? formatDate(hive.establishedAt) : 'Not specified' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between border-b border-slate-100 py-2">
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-xs font-medium text-slate-800">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
