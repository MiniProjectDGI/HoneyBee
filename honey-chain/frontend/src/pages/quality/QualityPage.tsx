import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qualityApi, batchesApi } from '../../api';
import { Card, Badge, Button, PageHeader, EmptyState, LoadingPage, ErrorState, Input } from '../../components/ui';
import { formatDate } from '../../utils';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const QUALITY_STATUS_COLORS = {
  PASS: 'bg-emerald-100 text-emerald-700',
  FAIL: 'bg-rose-100 text-rose-700',
  CONDITIONAL_PASS: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-blue-100 text-blue-700',
};

export default function QualityPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    batchId: '',
    testStandard: 'Standard Laboratory Honey Panel',
    moisturePercent: 18.0,
    hmfMgPerKg: 15.0,
    ph: 3.9,
    invertSugarPercent: 70.0,
    sucrosPercent: 2.5,
    pollenCount: 10000,
    pollenTypes: '',
    syrupAdulteration: false,
    antibioticResidues: false,
    pesticideResidues: false,
    heavyMetals: false,
    status: 'PASS',
    overallGrade: 'Grade A',
    remarks: '',
  });

  const { data: tests, isLoading, error, refetch } = useQuery({
    queryKey: ['quality-tests'],
    queryFn: () => qualityApi.list({ limit: 50 }).then((r) => r.data),
  });

  const { data: batches } = useQuery({
    queryKey: ['batches-pending-test'],
    queryFn: () => batchesApi.list({ limit: 100 }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => qualityApi.create(payload),
    onSuccess: () => {
      toast.success('Laboratory Report submitted and anchored to batch!');
      queryClient.invalidateQueries({ queryKey: ['quality-tests'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to submit test report');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batchId) {
      toast.error('Please select a honey batch to test');
      return;
    }

    createMutation.mutate({
      batchId: formData.batchId,
      testDate: new Date().toISOString(),
      testStandard: formData.testStandard,
      moisturePercent: Number(formData.moisturePercent),
      hmfMgPerKg: Number(formData.hmfMgPerKg),
      ph: Number(formData.ph),
      invertSugarPercent: Number(formData.invertSugarPercent),
      sucrosPercent: Number(formData.sucrosPercent),
      pollenCount: Number(formData.pollenCount),
      pollenTypes: formData.pollenTypes,
      syrupAdulteration: formData.syrupAdulteration,
      antibioticResidues: formData.antibioticResidues,
      pesticideResidues: formData.pesticideResidues,
      heavyMetals: formData.heavyMetals,
      status: formData.status,
      overallGrade: formData.overallGrade,
      remarks: formData.remarks,
    });
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load quality test records" retry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quality Assurance & Laboratory Records"
        subtitle="Independent laboratory testing, HMF index, sugar profile & moisture analytics"
        action={
          ['ADMIN', 'QUALITY_LAB', 'BEEKEEPER'].includes(user?.role || '') ? (
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              + Submit Quality Report
            </Button>
          ) : null
        }
      />

      {/* Standard Reference Info Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Quality Record Reference Thresholds</h3>
          <p className="text-xs text-slate-600">
            Moisture: ≤ 20.0% | HMF: ≤ 40 mg/kg | Fructose+Glucose: ≥ 60% | Sucrose: ≤ 5% | Quality Record Verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-slate-700">Laboratory information available</span>
        </div>
      </div>

      {!tests?.data?.length ? (
        <EmptyState
          title="No quality tests recorded"
          description="Submit the first certified laboratory test result for harvested honey batches."
          icon={<span className="text-5xl">🧪</span>}
          action={
            ['ADMIN', 'QUALITY_LAB', 'BEEKEEPER'].includes(user?.role || '') ? (
              <Button size="sm" onClick={() => setIsModalOpen(true)}>
                Record Quality Test
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.data.map((qt) => (
            <Card key={qt.id} className="border-slate-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔬</span>
                    <span className="font-semibold text-slate-800 text-sm">{qt.overallGrade || 'Laboratory Test'}</span>
                  </div>
                  <p className="text-xs text-amber-600 font-mono mt-0.5">
                    Batch: {qt.batch?.publicBatchId || qt.batchId.slice(0, 8)}
                  </p>
                </div>
                <Badge className={QUALITY_STATUS_COLORS[qt.status as keyof typeof QUALITY_STATUS_COLORS] || 'bg-slate-100 text-slate-600'}>
                  {qt.status}
                </Badge>
              </div>

              <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl mb-3 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Test Standard:</span>
                  <span className="font-medium text-[11px] truncate max-w-[150px]">{qt.testStandard || 'Codex Alimentarius'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Moisture Content:</span>
                  <span className={`font-semibold ${Number(qt.moisturePercent) <= 20 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {qt.moisturePercent}% {Number(qt.moisturePercent) <= 20 ? '✓' : '⚠️'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">HMF Index:</span>
                  <span className={`font-semibold ${Number(qt.hmfMgPerKg) <= 40 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {qt.hmfMgPerKg} mg/kg {Number(qt.hmfMgPerKg) <= 40 ? '✓' : '⚠️'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">pH Level:</span>
                  <span className="font-medium">{qt.ph ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                  <span>Tested On:</span>
                  <span>{formatDate(qt.testDate)}</span>
                </div>
              </div>

              {qt.remarks && (
                <p className="text-[11px] text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                  "{qt.remarks}"
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Submit Test Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Record Quality Test Report</h2>
                <p className="text-xs text-slate-500">Official physico-chemical and parameter verification analysis</p>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Honey Batch *</label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={formData.batchId}
                  onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Honey Batch --</option>
                  {batches?.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.publicBatchId} — {b.floralSource} ({b.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Testing Standard</label>
                  <Input
                    value={formData.testStandard}
                    onChange={(e) => setFormData({ ...formData, testStandard: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Overall Assigned Grade</label>
                  <select
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={formData.overallGrade}
                    onChange={(e) => setFormData({ ...formData, overallGrade: e.target.value })}
                  >
                    <option value="Grade A Premium">Grade A Premium (Export Quality)</option>
                    <option value="Grade Standard">Grade Standard (Domestic Retail)</option>
                    <option value="Grade Commercial">Grade Commercial / Industrial</option>
                    <option value="Rejected">Rejected / Failed Parameters</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Moisture (%) *</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.moisturePercent}
                    onChange={(e) => setFormData({ ...formData, moisturePercent: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">HMF (mg/kg) *</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.hmfMgPerKg}
                    onChange={(e) => setFormData({ ...formData, hmfMgPerKg: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">pH Level</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.ph}
                    onChange={(e) => setFormData({ ...formData, ph: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invert Sugar (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.invertSugarPercent}
                    onChange={(e) => setFormData({ ...formData, invertSugarPercent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sucrose (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.sucrosPercent}
                    onChange={(e) => setFormData({ ...formData, sucrosPercent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Adulteration & Contaminant Screenings</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.syrupAdulteration}
                      onChange={(e) => setFormData({ ...formData, syrupAdulteration: e.target.checked })}
                      className="rounded text-amber-500"
                    />
                    <span>Corn/Rice/C4 Sugar Syrup Present</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.antibioticResidues}
                      onChange={(e) => setFormData({ ...formData, antibioticResidues: e.target.checked })}
                      className="rounded text-amber-500"
                    />
                    <span>Antibiotic Residues Present</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quality Record Verdict</label>
                  <select
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="PASS">PASS — Standard Compliant</option>
                    <option value="CONDITIONAL_PASS">CONDITIONAL_PASS — Borderline Spec</option>
                    <option value="FAIL">FAIL — Non-Compliant Parameters</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pollen Spectrum Notes</label>
                  <Input
                    value={formData.pollenTypes}
                    onChange={(e) => setFormData({ ...formData, pollenTypes: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Lab Remarks</label>
                <textarea
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
                  Sign & Anchor Test to Batch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
