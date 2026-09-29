import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchesApi } from '../../api';
import { Card, Badge, Button, LoadingPage, ErrorState } from '../../components/ui';
import { BATCH_STATUS_COLORS, BATCH_STATUS_LABELS, BLOCKCHAIN_STATUS_COLORS, QUALITY_STATUS_COLORS, formatDate, formatDateTime } from '../../utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: batch, isLoading, error, refetch } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => batchesApi.get(id!).then((r) => r.data.data),
  });

  const { data: events } = useQuery({
    queryKey: ['batch-events', id],
    queryFn: () => batchesApi.getEvents(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const blockchainRegisterMutation = useMutation({
    mutationFn: () => batchesApi.registerBlockchain(id!),
    onSuccess: () => {
      toast.success('Batch registered on blockchain!');
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: () => toast.error('Blockchain registration failed'),
  });

  const generateQRMutation = useMutation({
    mutationFn: () => batchesApi.generateQR(id!),
    onSuccess: (res) => {
      toast.success('QR code generated!');
      const data = res.data.data as { qrDataUrl: string };
      // Download QR
      const a = document.createElement('a');
      a.href = data.qrDataUrl;
      a.download = `qr-${batch?.publicBatchId}.png`;
      a.click();
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
    },
    onError: () => toast.error('QR generation failed'),
  });

  if (isLoading) return <LoadingPage />;
  if (error || !batch) return <ErrorState message="Batch not found" retry={refetch} />;

  const canRegisterBlockchain = ['ADMIN', 'BEEKEEPER'].includes(user?.role || '') && !batch.blockchainRecord;
  const canGenerateQR = ['ADMIN', 'BEEKEEPER'].includes(user?.role || '') && ['PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAILER', 'SOLD'].includes(batch.status);

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 font-mono">{batch.publicBatchId}</h1>
            <Badge className={BATCH_STATUS_COLORS[batch.status]}>
              {BATCH_STATUS_LABELS[batch.status]}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {batch.variety || batch.floralSource || 'No variety specified'}
            {batch.totalQuantityKg ? ` · ${batch.totalQuantityKg} kg` : ''}
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {canRegisterBlockchain && (
            <Button
              size="sm"
              variant="secondary"
              loading={blockchainRegisterMutation.isPending}
              onClick={() => blockchainRegisterMutation.mutate()}
            >
              ⛓️ Register on Blockchain
            </Button>
          )}
          {canGenerateQR && (
            <Button size="sm" loading={generateQRMutation.isPending} onClick={() => generateQRMutation.mutate()}>
              📱 Generate QR
            </Button>
          )}
        </div>
      </div>

      {/* Batch Details */}
      <Card>
        <h2 className="font-semibold text-slate-800 mb-4">Batch Details</h2>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {[
            { label: 'Batch ID', value: batch.publicBatchId },
            { label: 'Status', value: BATCH_STATUS_LABELS[batch.status] },
            { label: 'Floral Source', value: batch.floralSource || 'Not specified' },
            { label: 'Variety', value: batch.variety || 'Not specified' },
            { label: 'Harvest Season', value: batch.harvestSeason || 'Not specified' },
            { label: 'Harvest Year', value: batch.harvestYear?.toString() || 'Not specified' },
            { label: 'Total Quantity', value: batch.totalQuantityKg ? `${batch.totalQuantityKg} kg` : 'Not specified' },
            { label: 'Remaining', value: batch.remainingQuantityKg ? `${batch.remainingQuantityKg} kg` : 'Not specified' },
            { label: 'Packaging', value: batch.packagingType || 'Not specified' },
            { label: 'Created', value: formatDate(batch.createdAt) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between border-b border-slate-100 pb-2.5">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-800">{value}</span>
            </div>
          ))}
        </div>
        {batch.notes && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Notes</p>
            <p className="text-sm text-slate-700">{batch.notes}</p>
          </div>
        )}
      </Card>

      {/* Blockchain Record */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Blockchain Status</h2>
          {batch.blockchainRecord && (
            <Badge className={BLOCKCHAIN_STATUS_COLORS[batch.blockchainRecord.status]}>
              {batch.blockchainRecord.status}
            </Badge>
          )}
        </div>
        {!batch.blockchainRecord ? (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm">This batch has not been registered on the blockchain yet.</p>
            {canRegisterBlockchain && (
              <p className="text-xs text-slate-400 mt-1">Register it to create an immutable integrity record.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {batch.blockchainRecord.registrationTxHash && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Transaction Hash</p>
                <p className="text-xs font-mono text-slate-700 break-all bg-slate-50 p-2 rounded-lg">
                  {batch.blockchainRecord.registrationTxHash}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Quality Tests */}
      {batch.qualityTests && (
        <Card>
          <h2 className="font-semibold text-slate-800 mb-3">Quality Tests</h2>
          {batch.qualityTests.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No quality tests have been conducted yet.</p>
          ) : (
            <div className="space-y-3">
              {batch.qualityTests.map((qt: { id: string; testDate: string; status: string; overallGrade?: string; moisturePercent?: number; testStandard?: string; remarks?: string }) => (
                <div key={qt.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{formatDate(qt.testDate)}</span>
                    <Badge className={QUALITY_STATUS_COLORS[qt.status as keyof typeof QUALITY_STATUS_COLORS]}>{qt.status}</Badge>
                  </div>
                  {qt.overallGrade && <p className="text-xs text-slate-500 mt-1">Grade: {qt.overallGrade}</p>}
                  {qt.moisturePercent && <p className="text-xs text-slate-500">Moisture: {qt.moisturePercent}%</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Event Timeline */}
      <Card>
        <h2 className="font-semibold text-slate-800 mb-4">Traceability Timeline</h2>
        {!events?.length ? (
          <p className="text-sm text-slate-400 py-4 text-center">No events recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1.5" />
                  {i < events.length - 1 && <div className="w-0.5 flex-1 bg-amber-200 mt-1" />}
                </div>
                <div className={`${i < events.length - 1 ? 'pb-4' : ''} flex-1`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{event.description}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{formatDateTime(event.eventAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{event.eventType}</p>
                  {event.eventHash && (
                    <p className="text-xs text-slate-300 font-mono truncate mt-0.5">
                      {event.eventHash.substring(0, 20)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
