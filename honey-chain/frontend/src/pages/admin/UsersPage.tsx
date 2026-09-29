import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api';
import { Card, Badge, Button, PageHeader, EmptyState, LoadingPage, ErrorState } from '../../components/ui';
import { formatDateTime } from '../../utils';
import toast from 'react-hot-toast';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-rose-100 text-rose-800',
  BEEKEEPER: 'bg-amber-100 text-amber-800',
  COLLECTION_CENTER: 'bg-blue-100 text-blue-800',
  PROCESSOR: 'bg-indigo-100 text-indigo-800',
  QUALITY_LAB: 'bg-emerald-100 text-emerald-800',
  DISTRIBUTOR: 'bg-purple-100 text-purple-800',
  RETAILER: 'bg-teal-100 text-teal-800',
  CONSUMER: 'bg-slate-100 text-slate-800',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [newRole, setNewRole] = useState('BEEKEEPER');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers().then((r) => r.data.data),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.updateUserRole(userId, { role }),
    onSuccess: () => {
      toast.success('User role updated!');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUser(null);
    },
    onError: () => toast.error('Failed to update user role'),
  });

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load platform users" retry={refetch} />;

  const users = data?.users || data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User & Stakeholder Governance"
        subtitle="Manage beekeepers, collection centers, processing units, certified labs & administrators"
      />

      {!users.length ? (
        <EmptyState
          title="No users found"
          description="Registered platform members will appear here."
          icon={<span className="text-5xl">👥</span>}
        />
      ) : (
        <Card className="border-slate-200 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{u.email}</td>
                    <td className="py-3 px-4">
                      <Badge className={ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-700'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(u);
                          setNewRole(u.role);
                        }}
                      >
                        Change Role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Change Role Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-1">Modify Role & Permissions</h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating role for {selectedUser.firstName} ({selectedUser.email})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Assigned Role</label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="BEEKEEPER">BEEKEEPER — Apiary & Hive Owner</option>
                  <option value="COLLECTION_CENTER">COLLECTION_CENTER — Bulk Raw Honey Aggregator</option>
                  <option value="QUALITY_LAB">QUALITY_LAB — Certified Testing Laboratory</option>
                  <option value="PROCESSOR">PROCESSOR — Packaging & Quality Processing</option>
                  <option value="DISTRIBUTOR">DISTRIBUTOR — Supply Chain Distributor</option>
                  <option value="RETAILER">RETAILER — Retail Outlets</option>
                  <option value="ADMIN">ADMIN — Full Platform Governance</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  isLoading={updateRoleMutation.isPending}
                  onClick={() =>
                    updateRoleMutation.mutate({
                      userId: selectedUser.id,
                      role: newRole,
                    })
                  }
                >
                  Save Role
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
