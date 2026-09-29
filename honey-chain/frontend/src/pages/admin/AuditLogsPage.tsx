import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api';
import { Card, Badge, PageHeader, EmptyState, LoadingPage, ErrorState } from '../../components/ui';
import { formatDateTime } from '../../utils';

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', actionFilter],
    queryFn: () =>
      adminApi.getAuditLogs({ action: actionFilter || undefined, limit: 50 }).then((r) => r.data.data),
  });

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load immutable audit logs" retry={refetch} />;

  const logs = data?.logs || data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cryptographic Audit Trail"
        subtitle="Tamper-evident system activity log, blockchain anchored event history & actor records"
        action={
          <div className="flex gap-2">
            {['', 'BATCH_CREATED', 'BLOCKCHAIN_REGISTERED', 'QUALITY_TEST_ADDED', 'USER_ROLE_CHANGED'].map((act) => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  actionFilter === act
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {act || 'All Actions'}
              </button>
            ))}
          </div>
        }
      />

      {logs.length === 0 ? (
        <EmptyState
          title="No audit entries logged"
          description="System events such as batch creation, quality certifications, and blockchain submissions will appear here."
          icon={<span className="text-5xl">📜</span>}
        />
      ) : (
        <Card className="border-slate-200 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">
                      <Badge className="bg-amber-100 text-amber-800 text-[10px] font-mono">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.entityType ? `${log.entityType} (${log.entityId?.slice(0, 8) || ''})` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {log.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId?.slice(0, 8) || 'System'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
