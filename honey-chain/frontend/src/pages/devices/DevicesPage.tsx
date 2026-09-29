import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { devicesApi, hivesApi } from '../../api';
import { Card, Badge, Button, PageHeader, EmptyState, LoadingPage, ErrorState, Input } from '../../components/ui';
import { formatDateTime } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import axios from 'axios';

const DEVICE_STATUS_COLORS = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  OFFLINE: 'bg-rose-100 text-rose-700',
};

export default function DevicesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    deviceId: '',
    hiveId: '',
    deviceType: 'MULTI_SENSOR',
    firmwareVersion: '',
    manufacturer: '',
    model: '',
    notes: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.list({ limit: 50 }).then((r) => r.data),
  });

  const { data: hivesData } = useQuery({
    queryKey: ['hives-select'],
    queryFn: () => hivesApi.list({ limit: 100 }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => devicesApi.create(payload),
    onSuccess: (res) => {
      toast.success('IoT Device registered!');
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      const apiKey = res.data.data.apiKey;
      setCreatedApiKey(apiKey);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to register device');
    },
  });

  const simulateTelemetryMutation = useMutation({
    mutationFn: async (device: { deviceId: string; hiveId?: string }) => {
      // Send simulated telemetry ping
      const temp = Number((34 + (Math.random() * 2 - 1)).toFixed(1));
      const hum = Math.round(55 + (Math.random() * 10 - 5));
      const weight = Number((42.5 + (Math.random() * 0.4 - 0.2)).toFixed(2));
      const battery = Math.round(85 + (Math.random() * 10));

      const payload = {
        deviceId: device.deviceId,
        timestamp: new Date().toISOString(),
        temperature: temp,
        humidity: hum,
        weight: weight,
        batteryLevel: battery,
        rawPayload: {
          acousticFrequencyHz: 245,
          signalStrengthDbm: -68,
          solarChargeActive: true,
        },
      };

      return axios.post('/api/iot/telemetry', payload);
    },
    onSuccess: () => {
      toast.success('Simulated sensor telemetry packet broadcasted!');
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: () => {
      toast.error('Simulation packet failed. Ensure device API key is configured.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.deviceId.trim()) {
      toast.error('Device Hardware ID is required');
      return;
    }

    createMutation.mutate({
      deviceId: formData.deviceId.trim(),
      hiveId: formData.hiveId || undefined,
      deviceType: formData.deviceType,
      firmwareVersion: formData.firmwareVersion,
      manufacturer: formData.manufacturer,
      model: formData.model,
      notes: formData.notes || undefined,
    });
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load IoT devices" retry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="IoT Sensor Hardware"
        subtitle="Live telemetry units, environmental sensors, weight scales & acoustic monitors"
        action={
          ['ADMIN', 'BEEKEEPER'].includes(user?.role || '') ? (
            <Button size="sm" onClick={() => { setIsModalOpen(true); setCreatedApiKey(null); }}>
              + Register IoT Device
            </Button>
          ) : null
        }
      />

      {!data?.data?.length ? (
        <EmptyState
          title="No IoT devices registered"
          description="Register your first hardware node (ESP32 / Cellular Gateway) to stream real-time hive conditions."
          icon={<span className="text-5xl">📡</span>}
          action={
            ['ADMIN', 'BEEKEEPER'].includes(user?.role || '') ? (
              <Button size="sm" onClick={() => { setIsModalOpen(true); setCreatedApiKey(null); }}>
                Register IoT Device
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.data.map((device) => (
            <Card key={device.id} className="border-slate-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-mono text-xs font-bold border border-amber-100">
                    IoT
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm font-mono">{device.deviceId}</h3>
                    <p className="text-[11px] text-slate-400">{device.manufacturer || 'Hardware Node'}</p>
                  </div>
                </div>
                <Badge className={DEVICE_STATUS_COLORS[device.status as keyof typeof DEVICE_STATUS_COLORS] || 'bg-slate-100 text-slate-600'}>
                  {device.status}
                </Badge>
              </div>

              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Device Type:</span>
                  <span className="font-medium text-slate-800">{device.deviceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Firmware:</span>
                  <span className="font-mono text-[11px]">{device.firmwareVersion || 'v1.0.0'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Linked Hive:</span>
                  {device.hive ? (
                    <Link to={`/hives/${device.hiveId}`} className="text-amber-600 font-semibold hover:underline">
                      {device.hive.name} ({device.hive.hiveCode})
                    </Link>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </div>
                {device.batteryLevel !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Battery Level:</span>
                    <span className="font-semibold text-emerald-600">🔋 {device.batteryLevel}%</span>
                  </div>
                )}
                {device.lastSeenAt && (
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                    <span>Last Heartbeat:</span>
                    <span>{formatDateTime(device.lastSeenAt)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => simulateTelemetryMutation.mutate(device)}
                  isLoading={simulateTelemetryMutation.isPending}
                >
                  📡 Send Telemetry Pulse
                </Button>
                {device.hiveId && (
                  <Link to={`/hives/${device.hiveId}`}>
                    <Button size="sm" variant="ghost" className="text-xs">
                      View Hive →
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Register Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Provision IoT Device</h2>
                <p className="text-xs text-slate-500">Register hardware node with unique HMAC cryptographic API key</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {createdApiKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1 text-emerald-800">
                    <span>✓</span> Device Provisioned Successfully!
                  </div>
                  <p>
                    Save this unique Device API Key now. For security purposes, it will never be displayed again in plaintext.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Generated API Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={createdApiKey}
                      className="w-full font-mono text-xs bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-slate-800 select-all"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(createdApiKey);
                        toast.success('Copied to clipboard!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <Button size="sm" onClick={() => setIsModalOpen(false)}>
                    Close & Finish
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hardware Device Identifier (EUI/MAC) *</label>
                  <Input
                    placeholder="e.g. ESP32-HIVE-004A2F"
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hardware Sensor Type</label>
                    <select
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.deviceType}
                      onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                    >
                      <option value="MULTI_SENSOR">Multi-Sensor Suite (Temp/Hum/Weight/Acoustic)</option>
                      <option value="TEMPERATURE_HUMIDITY">Brood Chamber Temp & Humidity</option>
                      <option value="WEIGHT_SCALE">Precision Digital Hive Scale</option>
                      <option value="ACOUSTIC">Acoustic Audio Frequency Sensor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to Hive</label>
                    <select
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.hiveId}
                      onChange={(e) => setFormData({ ...formData, hiveId: e.target.value })}
                    >
                      <option value="">-- Unassigned (Inventory) --</option>
                      {hivesData?.data?.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.hiveCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                    <Input
                      placeholder="e.g. Espressif / Sensirion"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hardware Model</label>
                    <Input
                      placeholder="e.g. SHT31 / HX711 Node"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Firmware Version</label>
                  <Input
                    placeholder="e.g. v1.0.0"
                    value={formData.firmwareVersion}
                    onChange={(e) => setFormData({ ...formData, firmwareVersion: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={createMutation.isPending}
                  >
                    Generate Device Key
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
