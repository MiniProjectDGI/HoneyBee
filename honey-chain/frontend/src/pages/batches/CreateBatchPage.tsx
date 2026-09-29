import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { batchesApi } from '../../api';
import { Card, Button, PageHeader, Input } from '../../components/ui';
import toast from 'react-hot-toast';

const FLORAL_SOURCES = [
  { name: 'Mustard Flora', desc: 'Mild, quick-crystallizing, pale golden', tag: 'Fast Market' },
  { name: 'Acacia Flora', desc: 'Light, crystal clear, slow crystallization, delicate aroma', tag: 'Export Grade' },
  { name: 'Multifloral Forest', desc: 'Rich amber, robust wild floral bouquet', tag: 'High Antioxidants' },
  { name: 'Eucalyptus Flora', desc: 'Warm amber, distinct herbal note, woody undertones', tag: 'Medicinal Grade' },
  { name: 'Sidr / Ber Flora', desc: 'Dark, viscous, rich caramel notes, highly sought-after', tag: 'Premium Royal' },
  { name: 'Litchi Flora', desc: 'Golden, fruity fragrance, sweet refreshing finish', tag: 'Seasonal Specialty' },
  { name: 'Jamun Flora', desc: 'Dark purple-brown, mildly bitter sweet, low glycemic profile', tag: 'Health Focused' },
];

export default function CreateBatchPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    floralSource: 'Mustard Flora',
    variety: 'Raw & Unprocessed',
    harvestSeason: 'Spring Harvest',
    harvestYear: new Date().getFullYear(),
    totalQuantityKg: 100,
    unit: 'kg',
    packagingType: 'Food-grade Drums',
    storageConditions: 'Cool, dark environment (< 21°C, < 60% RH)',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => batchesApi.create(payload),
    onSuccess: (res) => {
      toast.success('Honey batch created successfully!');
      const createdBatch = res.data.data;
      navigate(`/batches/${createdBatch.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to create honey batch');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.totalQuantityKg || formData.totalQuantityKg <= 0) {
      toast.error('Please specify a positive batch quantity');
      return;
    }

    createMutation.mutate({
      floralSource: formData.floralSource,
      variety: formData.variety,
      harvestSeason: formData.harvestSeason,
      harvestYear: Number(formData.harvestYear),
      totalQuantityKg: Number(formData.totalQuantityKg),
      unit: formData.unit,
      packagingType: formData.packagingType,
      storageConditions: formData.storageConditions,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Register New Honey Batch"
        subtitle="Initiate batch provenance, cryptographic event log, and QR traceability"
        action={
          <Link to="/batches">
            <Button variant="outline" size="sm">
              ← Back to Batches
            </Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Floral Source Selection */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">1</span>
            <h2 className="text-base font-bold text-slate-800">Botanical & Floral Origin</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Select the dominant botanical pollen source. This defines the batch flavor profile, color index, and lab testing baseline.
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {FLORAL_SOURCES.map((flora) => {
              const isSelected = formData.floralSource === flora.name;
              return (
                <div
                  key={flora.name}
                  onClick={() => setFormData({ ...formData, floralSource: flora.name })}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-2 ring-amber-500/20'
                      : 'border-slate-200 hover:border-amber-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900">{flora.name}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
                      {flora.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{flora.desc}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Step 2: Harvest & Batch Metadata */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">2</span>
            <h2 className="text-base font-bold text-slate-800">Harvest & Quantity Specifications</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Harvest Season</label>
              <select
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={formData.harvestSeason}
                onChange={(e) => setFormData({ ...formData, harvestSeason: e.target.value })}
              >
                <option value="Spring Harvest">Spring Harvest (Mar – May)</option>
                <option value="Summer Harvest">Summer Harvest (Jun – Aug)</option>
                <option value="Autumn Harvest">Autumn Harvest (Sep – Nov)</option>
                <option value="Winter Harvest">Winter Harvest (Dec – Feb)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Harvest Year</label>
              <Input
                type="number"
                min={2020}
                max={2035}
                value={formData.harvestYear}
                onChange={(e) => setFormData({ ...formData, harvestYear: parseInt(e.target.value) || 2026 })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Quantity (kg) *</label>
              <Input
                type="number"
                step="0.1"
                min="0.5"
                placeholder="e.g. 150"
                value={formData.totalQuantityKg}
                onChange={(e) => setFormData({ ...formData, totalQuantityKg: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Honey Variety / Processing Grade</label>
              <select
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={formData.variety}
                onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
              >
                <option value="Raw & Unprocessed">Raw & Cold-Filtered (Unheated)</option>
                <option value="Organic Certified Raw">Organic Certified Raw Honey</option>
                <option value="Comb Honey Section">Honeycomb / Comb Section</option>
                <option value="Naturally Crystallized Creamed">Creamed / Crystallized Honey</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Packaging Storage Unit</label>
              <select
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={formData.packagingType}
                onChange={(e) => setFormData({ ...formData, packagingType: e.target.value })}
              >
                <option value="Food-grade Stainless Steel Drums">Food-grade Stainless Steel Drums (300kg)</option>
                <option value="HDPE Food-grade Buckets">HDPE Food-grade Buckets (25kg)</option>
                <option value="Amber Glass Jars 500g">Amber Glass Jars 500g</option>
                <option value="Hexagonal Glass Jars 1kg">Hexagonal Glass Jars 1kg</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Step 3: Storage & Verification Notes */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">3</span>
            <h2 className="text-base font-bold text-slate-800">Storage Environment & Provenance Notes</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recommended Storage Protocol</label>
              <Input
                value={formData.storageConditions}
                onChange={(e) => setFormData({ ...formData, storageConditions: e.target.value })}
                placeholder="e.g. Keep away from direct sunlight, sealed container below 22°C"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Beekeeper Batch Notes & Harvest Log</label>
              <textarea
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Weather during extraction, capping percentage (e.g. 90% sealed comb), floral abundance notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/batches">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            isLoading={createMutation.isPending}
            className="px-6"
          >
            Create Batch & Generate Cryptographic Root
          </Button>
        </div>
      </form>
    </div>
  );
}
