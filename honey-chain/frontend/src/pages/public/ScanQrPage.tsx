import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { batchesApi } from '../../api';
import { Card, Button, Input } from '../../components/ui';
import { Layers, Camera } from 'lucide-react';

export default function ScanQrPage() {
  const navigate = useNavigate();
  const [batchInput, setBatchInput] = useState('');

  const { data: batchesData } = useQuery({
    queryKey: ['public-sample-batches'],
    queryFn: () => batchesApi.list({ limit: 4 }).then((r) => r.data),
    retry: 1,
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = batchInput.trim().replace(/^.*\/verify\//, '');
    if (cleanId) {
      navigate(`/verify/${cleanId}`);
    }
  };

  const realBatches = batchesData?.data?.map((b) => b.publicBatchId) || [];

  return (
    <div className="min-h-screen bg-[#faf9f6] py-16 px-4 flex items-center justify-center font-sans">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 text-[#0f172a] font-bold text-base mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] text-white flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <span>Honey Chain Provenance</span>
          </Link>
          <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Verify Batch Provenance</h1>
          <p className="text-xs text-[#64748b] leading-relaxed max-w-sm mx-auto">
            Scan the QR code on your package label or enter the unique batch identifier to inspect verified laboratory records and harvest coordinates.
          </p>
        </div>

        <Card className="border-[#e8e4dc] shadow-lg p-6 space-y-6 bg-white rounded-2xl">
          {/* Scanner Viewport */}
          <div className="relative aspect-square max-w-[220px] mx-auto rounded-2xl bg-[#0f172a] flex flex-col items-center justify-center text-white overflow-hidden shadow-inner border border-slate-700">
            <div className="absolute inset-4 border border-amber-400/60 rounded-xl border-dashed opacity-80 animate-pulse" />
            <Camera className="w-8 h-8 text-amber-400 mb-2" />
            <span className="text-[11px] font-mono text-amber-300">Point Camera at Label QR</span>
            <div className="absolute bottom-3 text-[10px] text-slate-400">Scanner active</div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e8e4dc]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[#64748b] font-semibold text-[10px] tracking-wider">
                Or Enter Identifier
              </span>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#0f172a] mb-1">Public Batch ID or QR URL</label>
              <Input
                placeholder="e.g. BATCH-2026-0001"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" className="w-full py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white">
              Verify On-Chain Provenance
            </Button>
          </form>

          {realBatches.length > 0 && (
            <div className="pt-2 border-t border-[#f1ede5]">
              <span className="text-[11px] font-semibold text-[#64748b] block mb-2">Registered Batches in Ledger:</span>
              <div className="flex flex-wrap gap-2">
                {realBatches.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBatchInput(s)}
                    className="text-xs font-mono bg-[#faf9f6] hover:bg-[#f5f3ee] text-[#0f172a] px-2.5 py-1 rounded-lg border border-[#e8e4dc] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="text-center">
          <Link to="/" className="text-xs text-[#475569] hover:text-[#0f172a] font-medium transition-colors">
            ← Return to Honey Chain Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
