import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { hivesApi } from '../../api';
import { Card, Badge, Button, PageHeader, EmptyState, LoadingPage, ErrorState, Input } from '../../components/ui';
import { formatDate } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const HIVE_STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  ABANDONED: 'bg-red-100 text-red-700',
  MIGRATED: 'bg-blue-100 text-blue-700',
};

export default function HivesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    hiveCode: '',
    species: 'Apis mellifera',
    hiveType: 'Langstroth Box',
    village: '',
    district: '',
    state: '',
    latitude: '',
    longitude: '',
    notes: '',
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hives'],
    queryFn: () => hivesApi.list({ limit: 50 }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => hivesApi.create(payload),
    onSuccess: () => {
      toast.success('Hive registered successfully!');
      queryClient.invalidateQueries({ queryKey: ['hives'] });
      setIsModalOpen(false);
      setFormData({
        name: '',
        hiveCode: '',
        species: 'Apis mellifera',
        hiveType: 'Langstroth Box',
        village: '',
        district: '',
        state: '',
        latitude: '',
        longitude: '',
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to register hive');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Hive name is required');
      return;
    }
    const code = formData.hiveCode.trim() || `HIVE-${Date.now().toString().slice(-6)}`;
    createMutation.mutate({
      name: formData.name,
      hiveCode: code,
      species: formData.species,
      hiveType: formData.hiveType,
      village: formData.village || undefined,
      district: formData.district || undefined,
      state: formData.state || undefined,
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      notes: formData.notes || undefined,
    });
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load hives" retry={refetch} />;

  return (
    <div>
      <PageHeader
        title="My Hives"
        subtitle={`${data?.pagination?.total ?? 0} total registered hives`}
        action={
          ['ADMIN', 'BEEKEEPER'].includes(user?.role || '') ? (
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              + Register Hive
            </Button>
          ) : null
        }
      />

      {!data?.data?.length ? (
        <EmptyState
          title="No hives registered"
          description="Register your first hive to start monitoring and tracking honey production."
          icon={<span className="text-5xl">🏠</span>}
          action={
            ['ADMIN', 'BEEKEEPER'].includes(user?.role || '') ? (
              <Button size="sm" onClick={() => setIsModalOpen(true)}>
                Register Hive
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.data.map((hive) => (
            <Link key={hive.id} to={`/hives/${hive.id}`}>
              <Card className="hover:border-amber-300 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🐝</span>
                      <span className="font-semibold text-slate-800 text-sm">{hive.name}</span>
                    </div>
                    <p className="text-xs text-amber-600 font-mono mt-0.5">{hive.hiveCode}</p>
                  </div>
                  <Badge className={HIVE_STATUS_COLORS[hive.status]}>{hive.status}</Badge>
                </div>

                <div className="space-y-1.5 text-xs text-slate-500">
                  {hive.hiveType && <p>Type: {hive.hiveType}</p>}
                  {hive.species && <p>Species: {hive.species}</p>}
                  {[hive.village, hive.district, hive.state].filter(Boolean).length > 0 && (
                    <p>📍 {[hive.village, hive.district, hive.state].filter(Boolean).join(', ')}</p>
                  )}
                  {hive.establishedAt && <p>Est. {formatDate(hive.establishedAt)}</p>}
                </div>

                {hive._count && (
                  <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">{hive._count.sensors} sensors</span>
                    <span className="text-xs text-slate-500 font-medium">{hive._count.honeyCollections} collections</span>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Register Hive Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Register New Hive</h2>
                <p className="text-xs text-slate-500">Add an apiary hive for IoT monitoring and batch tracking</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hive Name *</label>
                <Input
                  placeholder="e.g. Valley Orchard Hive Alpha"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hive Code (Optional)</label>
                  <Input
                    placeholder="e.g. HIVE-2026-001"
                    value={formData.hiveCode}
                    onChange={(e) => setFormData({ ...formData, hiveCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hive Architecture</label>
                  <select
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={formData.hiveType}
                    onChange={(e) => setFormData({ ...formData, hiveType: e.target.value })}
                  >
                    <option value="Langstroth Box">Langstroth Box</option>
                    <option value="Top Bar Hive">Top Bar Hive</option>
                    <option value="Warre Hive">Warre Hive</option>
                    <option value="Traditional Clay / Log">Traditional Clay / Log</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bee Species</label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={formData.species}
                  onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                >
                  <option value="Apis mellifera">Apis mellifera (Western / European)</option>
                  <option value="Apis cerana indica">Apis cerana indica (Indian Honey Bee)</option>
                  <option value="Apis dorsata">Apis dorsata (Giant Rock Bee)</option>
                  <option value="Tetragonula iridipennis">Tetragonula iridipennis (Stingless Bee)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Village</label>
                  <Input
                    placeholder="Village"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                  <Input
                    placeholder="District"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <Input
                    placeholder="State"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GPS Latitude</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 28.6139"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GPS Longitude</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 77.2090"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes & Flora Details</label>
                <textarea
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Surrounding flora, colony strength, queen introduction date..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  Register Hive
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
