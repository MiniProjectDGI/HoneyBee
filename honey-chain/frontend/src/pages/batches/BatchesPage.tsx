import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { batchesApi } from '../../api';
import { Card, Badge, Button, PageHeader, EmptyState, LoadingPage, ErrorState } from '../../components/ui';
import { BATCH_STATUS_COLORS, BATCH_STATUS_LABELS, formatDate } from '../../utils';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function BatchesPage() {
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['batches', { status: statusFilter }],
    queryFn: () => batchesApi.list({ status: statusFilter || undefined, limit: 20 }).then((r) => r.data),
  });

  const STATUS_OPTIONS = [
    '', 'DRAFT', 'COLLECTED', 'PROCESSING', 'QUALITY_TESTING',
    'APPROVED', 'PACKAGED', 'IN_DISTRIBUTION', 'AT_RETAILER', 'SOLD', 'RECALLED'
  ];

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load batches" retry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Honey Batches"
        subtitle={data?.pagination.total !== undefined ? `${data.pagination.total} total batches` : ''}
        action={
          ['ADMIN', 'BEEKEEPER', 'COLLECTION_CENTER'].includes(user?.role || '') ? (
            <Link to="/batches/create">
              <Button size="sm">+ New Batch</Button>
            </Link>
          ) : null
        }
      />

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === s
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-slate-600 border-slate-300 hover:border-amber-300'
            }`}
          >
            {s ? BATCH_STATUS_LABELS[s as keyof typeof BATCH_STATUS_LABELS] : 'All'}
          </button>
        ))}
      </div>

      {!data?.data?.length ? (
        <EmptyState
          title="No honey batches found"
          description={statusFilter ? `No batches with status "${BATCH_STATUS_LABELS[statusFilter as keyof typeof BATCH_STATUS_LABELS]}"` : 'Create your first honey batch to get started with traceability.'}
          action={
            ['ADMIN', 'BEEKEEPER', 'COLLECTION_CENTER'].includes(user?.role || '') ? (
              <Link to="/batches/create"><Button size="sm">Create Batch</Button></Link>
            ) : null
          }
          icon={<span className="text-5xl">🍯</span>}
        />
      ) : (
        <div className="space-y-3">
          {data.data.map((batch) => (
            <Link key={batch.id} to={`/batches/${batch.id}`}>
              <Card className="hover:border-amber-200 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 font-mono text-sm">{batch.publicBatchId}</span>
                      <Badge className={BATCH_STATUS_COLORS[batch.status]}>
                        {BATCH_STATUS_LABELS[batch.status]}
                      </Badge>
                      {batch.blockchainRecord?.status === 'CONFIRMED' && (
                        <Badge className="bg-green-100 text-green-700">⛓️ On-Chain</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {batch.variety || batch.floralSource || 'Unknown variety'}
                      {batch.totalQuantityKg ? ` · ${batch.totalQuantityKg} kg` : ''}
                      {batch.beekeeper?.user ? ` · ${batch.beekeeper.user.firstName} ${batch.beekeeper.user.lastName}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Created {formatDate(batch.createdAt)}</p>
                  </div>
                  <div className="text-slate-400 text-sm">→</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
