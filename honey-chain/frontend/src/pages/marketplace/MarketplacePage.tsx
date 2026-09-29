import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { marketplaceApi, batchesApi } from '../../api';
import { Card, Badge, Button, PageHeader, EmptyState, LoadingPage, ErrorState, Input } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { Store, CheckCircle2, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MarketplacePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [orderModalListing, setOrderModalListing] = useState<any | null>(null);
  const [orderQuantityKg, setOrderQuantityKg] = useState(5);

  const [newListingData, setNewListingData] = useState({
    batchId: '',
    title: '',
    description: 'Raw unpasteurized honey with verified batch traceability directly sourced from registered apiary.',
    pricePerKg: 450,
    availableQuantityKg: 50,
    minimumOrderKg: 1,
    variety: 'Raw & Unprocessed',
    harvestSeason: 'Spring Harvest',
    deliveryOptions: 'Standard Express Courier / Regional Pickup',
  });

  const { data: listings, isLoading, error, refetch } = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: () => marketplaceApi.listListings({ limit: 50 }).then((r) => r.data),
  });

  const { data: batches } = useQuery({
    queryKey: ['user-batches-for-sale'],
    queryFn: () => batchesApi.list({ limit: 50 }).then((r) => r.data),
  });

  const createListingMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => marketplaceApi.createListing(payload),
    onSuccess: () => {
      toast.success('Batch listed on the Honey Chain Marketplace!');
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      setIsListingModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to create marketplace listing');
    },
  });

  const orderMutation = useMutation({
    mutationFn: (payload: { listingId: string; quantityKg: number }) => marketplaceApi.createOrder(payload),
    onSuccess: () => {
      toast.success('Purchase order created! Beekeeper notified for fulfillment.');
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      setOrderModalListing(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Order placement failed');
    },
  });

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListingData.batchId) {
      toast.error('Please select a verified honey batch');
      return;
    }
    createListingMutation.mutate({
      batchId: newListingData.batchId,
      title: newListingData.title || 'Single-Origin Raw Honey',
      description: newListingData.description,
      pricePerKg: Number(newListingData.pricePerKg),
      availableQuantityKg: Number(newListingData.availableQuantityKg),
      minimumOrderKg: Number(newListingData.minimumOrderKg),
      variety: newListingData.variety,
      harvestSeason: newListingData.harvestSeason,
      deliveryOptions: newListingData.deliveryOptions,
    });
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderModalListing) return;
    orderMutation.mutate({
      listingId: orderModalListing.id,
      quantityKg: Number(orderQuantityKg),
    });
  };

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorState message="Failed to load marketplace listings" retry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decentralized Honey Marketplace"
        subtitle="Direct-from-beekeeper trade with cryptographic batch verification & laboratory quality reports"
        action={
          ['ADMIN', 'BEEKEEPER', 'COLLECTION_CENTER'].includes(user?.role || '') ? (
            <Button size="sm" onClick={() => setIsListingModalOpen(true)}>
              + Create Honey Listing
            </Button>
          ) : null
        }
      />

      {!listings?.data?.length ? (
        <EmptyState
          title="Verified honey listings will appear here."
          description="No active marketplace listings at this moment. Verified honey batches ready for distribution will be published here by certified apiaries."
          icon={<Store className="w-12 h-12 text-slate-400 mx-auto" />}
          action={
            ['ADMIN', 'BEEKEEPER', 'COLLECTION_CENTER'].includes(user?.role || '') ? (
              <Button size="sm" onClick={() => setIsListingModalOpen(true)}>
                List Honey Batch
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.data.map((item: any) => {
            const batchId = item.batch?.publicBatchId || item.batchId || 'Awaiting ID';
            const producer = item.seller?.organizationName || (item.seller?.firstName ? `${item.seller.firstName} ${item.seller.lastName || ''}`.trim() : 'Registered Producer');
            const origin = item.batch?.origin || item.batch?.hive?.location || item.seller?.state || 'Registered Apiary';
            const qualityStatus = item.batch?.qualityStatus || 'Standard Compliant';
            const traceabilityStatus = item.batch?.status ? item.batch.status.replace(/_/g, ' ') : 'Verified Traceable';

            return (
              <Card key={item.id} className="border-slate-200 hover:shadow-lg transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                      <p className="text-xs text-amber-600 font-medium">{item.variety || 'Natural Honey'}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified Batch</span>
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                    {item.description || 'Verified honey from registered sustainable apiary.'}
                  </p>

                  <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl text-slate-700 mb-4 border border-slate-200/60">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400">Price:</span>
                      <span className="text-base font-extrabold text-slate-900">₹{item.pricePerKg} / kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Available Stock:</span>
                      <span className="font-semibold text-emerald-600">{item.availableQuantityKg} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Producer:</span>
                      <span className="font-medium text-slate-800 truncate max-w-[170px]">{producer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Origin:</span>
                      <span className="font-medium text-slate-800 truncate max-w-[170px]">{origin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quality Status:</span>
                      <span className="font-medium text-emerald-700">{qualityStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Traceability:</span>
                      <span className="font-mono text-[11px] text-slate-700">{traceabilityStatus}</span>
                    </div>
                    {batchId && (
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                        <span className="text-slate-400">Batch Code:</span>
                        <Link
                          to={`/verify/${batchId}`}
                          className="text-amber-600 font-mono font-semibold hover:underline text-[11px] flex items-center gap-1"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>{batchId} ↗</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setOrderModalListing(item);
                      setOrderQuantityKg(item.minimumOrderKg || 1);
                    }}
                  >
                    Buy Honey
                  </Button>
                  {item.batch?.publicBatchId && (
                    <Link to={`/verify/${item.batch.publicBatchId}`}>
                      <Button size="sm" variant="outline" className="px-3">
                        Verify
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Place Order Modal */}
      {orderModalListing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Purchase Verified Honey</h3>
              <button
                onClick={() => setOrderModalListing(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">{orderModalListing.title}</div>
                <div className="text-slate-500">Unit Price: ₹{orderModalListing.pricePerKg} / kg</div>
                <div className="text-slate-500">Available: {orderModalListing.availableQuantityKg} kg</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Order Quantity (kg) *
                </label>
                <Input
                  type="number"
                  min={orderModalListing.minimumOrderKg || 1}
                  max={orderModalListing.availableQuantityKg}
                  value={orderQuantityKg}
                  onChange={(e) => setOrderQuantityKg(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Total Payable:</span>
                <span className="text-base font-extrabold text-slate-900">
                  ₹{Number(orderQuantityKg) * Number(orderModalListing.pricePerKg)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderModalListing(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={orderMutation.isPending}
                >
                  Confirm Purchase Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Listing Modal */}
      {isListingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Create Honey Marketplace Listing</h3>
              <button
                onClick={() => setIsListingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Verified Batch *</label>
                <select
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={newListingData.batchId}
                  onChange={(e) => {
                    const b = batches?.data?.find((x) => x.id === e.target.value);
                    setNewListingData({
                      ...newListingData,
                      batchId: e.target.value,
                      title: b ? `${b.floralSource} - Natural Honey (${b.harvestSeason})` : '',
                      availableQuantityKg: b?.remainingQuantityKg || b?.totalQuantityKg || 50,
                    });
                  }}
                  required
                >
                  <option value="">-- Choose Batch --</option>
                  {batches?.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.publicBatchId} — {b.floralSource} ({b.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Listing Title *</label>
                <Input
                  value={newListingData.title}
                  onChange={(e) => setNewListingData({ ...newListingData, title: e.target.value })}
                  placeholder="e.g. Single-Origin Himalayan Honey 2026"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price per kg (₹) *</label>
                  <Input
                    type="number"
                    min="1"
                    value={newListingData.pricePerKg}
                    onChange={(e) => setNewListingData({ ...newListingData, pricePerKg: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Available Quantity (kg) *</label>
                  <Input
                    type="number"
                    min="1"
                    value={newListingData.availableQuantityKg}
                    onChange={(e) => setNewListingData({ ...newListingData, availableQuantityKg: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Listing Description</label>
                <textarea
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={newListingData.description}
                  onChange={(e) => setNewListingData({ ...newListingData, description: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsListingModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={createListingMutation.isPending}
                >
                  Publish Listing
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
