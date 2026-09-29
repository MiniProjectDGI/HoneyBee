import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../api';
import { formatDate, formatDateTime } from '../../utils';
import type { VerificationResult } from '../../types';
import {
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  Package,
  Truck,
  Store,
  ShoppingCart,
  Workflow,
} from 'lucide-react';

function VerificationBadge({ result }: { result: VerificationResult }) {
  if (result === 'VERIFIED') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <span className="text-emerald-800 font-bold text-base tracking-tight">Traceability Verified</span>
        <p className="text-xs text-[#64748b] text-center max-w-xs leading-relaxed">
          The integrity of this batch record has been verified against the blockchain ledger.
          Blockchain verification confirms data integrity, not chemical purity.
        </p>
      </div>
    );
  }

  if (result === 'NOT_BLOCKCHAIN_REGISTERED') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <span className="text-amber-800 font-bold text-base tracking-tight">Batch Registered (Off-Chain)</span>
        <p className="text-xs text-[#64748b] text-center max-w-xs leading-relaxed">
          This batch exists in the local database registry but has not yet been anchored to the public blockchain ledger.
        </p>
      </div>
    );
  }

  if (result === 'BLOCKCHAIN_MISMATCH') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <span className="text-red-800 font-bold text-base tracking-tight">Integrity Check Failed</span>
        <p className="text-xs text-[#64748b] text-center max-w-xs leading-relaxed">
          The batch record hash does not match the on-chain Merkle root. Do not consume and report to the platform.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
        <HelpCircle className="w-8 h-8" />
      </div>
      <span className="text-[#0f172a] font-bold text-base tracking-tight">Batch Record Not Found</span>
      <p className="text-xs text-[#64748b] text-center max-w-xs leading-relaxed">
        No active batch with this identifier was located in the registry. Check the QR code on your product packaging.
      </p>
    </div>
  );
}

function TimelineStep({ event, isLast }: { event: { eventType: string; description: string; eventAt: string; eventHash?: string }; isLast: boolean }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'BATCH_CREATED':
      case 'HONEY_COLLECTED':
        return Layers;
      case 'PROCESSING_STARTED':
        return Workflow;
      case 'QUALITY_TESTING_STARTED':
      case 'QUALITY_APPROVED':
        return FileCheck;
      case 'BATCH_PACKAGED':
        return Package;
      case 'TRANSFERRED_TO_DISTRIBUTOR':
        return Truck;
      case 'TRANSFERRED_TO_RETAILER':
        return Store;
      case 'BATCH_SOLD':
        return ShoppingCart;
      default:
        return CheckCircle2;
    }
  };

  const IconComponent = getIcon(event.eventType);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-[#faf9f6] border border-[#e8e4dc] flex items-center justify-center text-[#0f172a]">
          <IconComponent className="w-3.5 h-3.5" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-[#e8e4dc] my-1" />}
      </div>
      <div className={`${!isLast ? 'pb-4' : ''} flex-1 min-w-0`}>
        <p className="text-xs font-semibold text-[#0f172a]">{event.description}</p>
        <p className="text-[11px] text-[#64748b] mt-0.5">{formatDateTime(event.eventAt)}</p>
        {event.eventHash && (
          <p className="text-[10px] text-[#64748b] mt-0.5 font-mono truncate">
            Hash: {event.eventHash.substring(0, 20)}...
          </p>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const { batchId } = useParams<{ batchId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['verify', batchId],
    queryFn: () => publicApi.verify(batchId!).then((r) => r.data.data),
    enabled: !!batchId,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[#faf9f6] font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Header */}
      <header className="bg-white border-b border-[#e8e4dc] px-4 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0f172a] text-white flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-bold text-[#0f172a] text-sm">Honey Chain</span>
          </Link>
          <span className="text-[11px] font-mono text-[#64748b] bg-[#faf9f6] border border-[#e8e4dc] px-2 py-0.5 rounded">
            Consumer Verification
          </span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-12 h-12 rounded-full border-2 border-[#0f172a] border-t-transparent animate-spin" />
            <p className="text-[#64748b] text-xs">Verifying on-chain provenance records...</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-white rounded-2xl p-8 text-center border border-[#e8e4dc]">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700 font-semibold text-sm">Failed to verify batch</p>
            <p className="text-xs text-[#64748b] mt-1">Check network connection and retry.</p>
          </div>
        )}

        {/* Result */}
        {data && !isLoading && (
          <div className="space-y-4">
            {/* Verification Status Card */}
            <div className="bg-white rounded-2xl p-6 border border-[#e8e4dc] text-center shadow-xs">
              <VerificationBadge result={data.verificationResult} />
            </div>

            {/* Batch Info */}
            {data.batch && (
              <>
                <div className="bg-white rounded-2xl p-5 border border-[#e8e4dc] shadow-xs">
                  <h2 className="font-bold text-xs uppercase tracking-wider text-[#64748b] mb-3">Batch Information</h2>
                  <div className="space-y-2">
                    {[
                      { label: 'Batch ID', value: data.batch.publicBatchId },
                      { label: 'Status', value: data.batch.status?.replace(/_/g, ' ') },
                      { label: 'Honey Variety', value: data.batch.variety || data.batch.floralSource || 'Raw Honey' },
                      { label: 'Harvest Season', value: data.batch.harvestSeason || 'Standard' },
                      { label: 'Harvest Year', value: data.batch.harvestYear?.toString() || new Date().getFullYear().toString() },
                      { label: 'Net Weight', value: data.batch.totalQuantityKg ? `${data.batch.totalQuantityKg} kg` : 'Recorded' },
                      { label: 'Packaging Format', value: data.batch.packagingType || 'Food-Grade Glass Jar' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between gap-3 text-xs">
                        <span className="text-[#64748b]">{label}</span>
                        <span className="font-medium text-[#0f172a] text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Producer */}
                <div className="bg-white rounded-2xl p-5 border border-[#e8e4dc] shadow-xs">
                  <h2 className="font-bold text-xs uppercase tracking-wider text-[#64748b] mb-3">Producer / Apiary</h2>
                  <div className="space-y-2">
                    {[
                      { label: 'Beekeeper', value: data.batch.producer.name },
                      { label: 'Organization', value: data.batch.producer.organization || 'Independent Apiary' },
                      { label: 'District', value: data.batch.producer.district || 'Recorded' },
                      { label: 'State', value: data.batch.producer.state || 'India' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between gap-3 text-xs">
                        <span className="text-[#64748b]">{label}</span>
                        <span className="font-medium text-[#0f172a] text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quality Tests */}
                {data.batch.qualityTests && data.batch.qualityTests.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-[#e8e4dc] shadow-xs">
                    <h2 className="font-bold text-xs uppercase tracking-wider text-[#64748b] mb-3">Laboratory Assessment</h2>
                    {data.batch.qualityTests.map((qt, i) => (
                      <div key={i} className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Test Date</span>
                          <span className="font-medium text-[#0f172a]">{formatDate(qt.testDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Standard Result</span>
                          <span className={`font-semibold ${qt.status === 'PASS' ? 'text-emerald-700' : 'text-red-700'}`}>
                            {qt.status}
                          </span>
                        </div>
                        {qt.overallGrade && (
                          <div className="flex justify-between">
                            <span className="text-[#64748b]">Grade</span>
                            <span className="font-medium text-[#0f172a]">{qt.overallGrade}</span>
                          </div>
                        )}
                        {qt.testStandard && (
                          <div className="flex justify-between">
                            <span className="text-[#64748b]">Accreditation</span>
                            <span className="font-medium text-[#0f172a]">{qt.testStandard}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Blockchain Proof */}
                {data.batch.blockchainRecord && (
                  <div className="bg-white rounded-2xl p-5 border border-[#e8e4dc] shadow-xs">
                    <h2 className="font-bold text-xs uppercase tracking-wider text-[#64748b] mb-3">Cryptographic Layer</h2>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">On-Chain Status</span>
                        <span className="font-semibold text-emerald-700">
                          {data.blockchainVerified ? '✓ Verified' : data.batch.blockchainRecord.status}
                        </span>
                      </div>
                      {data.batch.blockchainRecord.registrationTxHash && (
                        <div>
                          <span className="text-[#64748b] block mb-1">Transaction Hash</span>
                          <span className="font-mono text-[11px] text-[#0f172a] break-all bg-[#faf9f6] p-2 rounded border border-[#e8e4dc] block">
                            {data.batch.blockchainRecord.registrationTxHash}
                          </span>
                        </div>
                      )}
                      {data.batch.blockchainRecord.registrationBlock && (
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Block Number</span>
                          <span className="font-mono font-medium text-[#0f172a]">#{data.batch.blockchainRecord.registrationBlock}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Traceability Timeline */}
                {data.batch.events && data.batch.events.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-[#e8e4dc] shadow-xs">
                    <h2 className="font-bold text-xs uppercase tracking-wider text-[#64748b] mb-4">Traceability Audit Trail</h2>
                    <div>
                      {data.batch.events.map((event, i) => (
                        <TimelineStep
                          key={i}
                          event={event}
                          isLast={i === data.batch!.events.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Honest Disclaimer */}
                <div className="bg-[#faf9f6] rounded-xl p-4 border border-[#e8e4dc]">
                  <p className="text-[11px] text-[#64748b] leading-relaxed">
                    <span className="font-bold text-[#0f172a]">Auditing Note: </span>
                    Blockchain verification confirms the cryptographic integrity of recorded event logs.
                    It verifies that records have not been altered after recording, and does not replace chemical laboratory tests.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="text-center py-8 px-4 text-xs text-[#64748b]">
        Honey Chain Smart Apiculture Ecosystem
      </footer>
    </div>
  );
}
