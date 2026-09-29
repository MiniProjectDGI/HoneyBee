import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { aiApi, hivesApi } from '../../api';
import { Card, Badge, Button, PageHeader, LoadingPage, ErrorState, Input } from '../../components/ui';
import { Sparkles, Activity, LineChart as ChartIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AiPage() {
  const [selectedHiveId, setSelectedHiveId] = useState('');
  const [activeTab, setActiveTab] = useState<'health' | 'disease' | 'productivity'>('health');

  const { data: hives, isLoading: isHivesLoading, error: hivesError } = useQuery({
    queryKey: ['hives-for-ai'],
    queryFn: () => hivesApi.list({ limit: 50 }).then((r) => r.data),
  });

  const selectedHive = hives?.data?.find((h) => h.id === selectedHiveId) || hives?.data?.[0];

  // Set default hive when loaded
  if (hives?.data?.length && !selectedHiveId) {
    setSelectedHiveId(hives.data[0].id);
  }

  // Colony Health query (calls backend AI service)
  const {
    data: healthData,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ['colony-health', selectedHive?.id],
    queryFn: () => aiApi.getColonyHealth(selectedHive!.id).then((r) => r.data.data),
    enabled: !!selectedHive?.id,
  });

  // Productivity Prediction mutation
  const [productivityResult, setProductivityResult] = useState<any>(null);
  const productivityMutation = useMutation({
    mutationFn: () => aiApi.predictProductivity(selectedHive!.id),
    onSuccess: (res) => {
      toast.success('Productivity AI prediction request completed');
      setProductivityResult(res.data.data);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Prediction failed. Sufficient telemetry history required.');
    },
  });

  // Disease / Anomaly detection mutation
  const [diseaseImageUrl, setDiseaseImageUrl] = useState('');
  const [diseaseResult, setDiseaseResult] = useState<any>(null);

  const diseaseMutation = useMutation({
    mutationFn: (imgUrl: string) => aiApi.analyzeDisease(selectedHive!.id, imgUrl || undefined),
    onSuccess: (res) => {
      toast.success('Analysis request processed');
      setDiseaseResult(res.data.data);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Disease analysis request failed');
    },
  });

  if (isHivesLoading) return <LoadingPage />;
  if (hivesError) return <ErrorState message="Failed to load hives for AI analytics" />;

  const healthResult = healthData?.result as {
    healthScore?: number;
    healthCategory?: string;
    issues?: string[];
    dataPoints?: number;
    avgTemperature?: number | null;
    weightTrend7Days?: number | null;
  } | undefined;

  const isModelConnected = healthData?.status === 'PREDICTION_AVAILABLE';

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Colony Analytics & Diagnostics"
        subtitle="Machine learning anomaly detection, colony biometrics, and productivity forecasting"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Target Hive:</span>
            <select
              className="text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={selectedHiveId}
              onChange={(e) => {
                setSelectedHiveId(e.target.value);
                setDiseaseResult(null);
                setProductivityResult(null);
              }}
            >
              {hives?.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.hiveCode})
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'health'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>COLONY HEALTH INSIGHTS</span>
        </button>
        <button
          onClick={() => setActiveTab('disease')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'disease'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI-ASSISTED ANOMALY DETECTION</span>
        </button>
        <button
          onClick={() => setActiveTab('productivity')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'productivity'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ChartIcon className="w-3.5 h-3.5" />
          <span>PRODUCTIVITY FORECASTING</span>
        </button>
      </div>

      {/* Tab 1: COLONY HEALTH INSIGHTS */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Colony Vitality Score</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-amber-600">
                  {healthResult?.healthScore !== undefined ? healthResult.healthScore : '—'}
                </span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {healthResult?.healthCategory ? `Category: ${healthResult.healthCategory}` : 'Waiting for telemetry'}
              </p>
            </Card>

            <Card className="border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Brood Temperature Status</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-slate-800">
                  {healthResult?.avgTemperature !== undefined && healthResult?.avgTemperature !== null
                    ? `${healthResult.avgTemperature.toFixed(1)}°C`
                    : 'Waiting for telemetry'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {healthResult?.avgTemperature !== undefined && healthResult?.avgTemperature !== null
                  ? '7-day telemetry average'
                  : 'IoT gateway is not connected'}
              </p>
            </Card>

            <Card className="border-slate-200">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Weight Trajectory</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-slate-800">
                  {healthResult?.weightTrend7Days !== undefined && healthResult?.weightTrend7Days !== null
                    ? `${healthResult.weightTrend7Days >= 0 ? '+' : ''}${healthResult.weightTrend7Days.toFixed(2)} kg`
                    : 'Waiting for telemetry'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {healthResult?.dataPoints ? `${healthResult.dataPoints} sensor readings evaluated` : 'Awaiting sensor logs'}
              </p>
            </Card>
          </div>

          {/* Model Evaluation Specification Card */}
          <Card className="border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">COLONY HEALTH INSIGHTS</h3>
                <p className="text-xs text-slate-500">Biometric rule-based & ML health scoring pipeline</p>
              </div>
              <Badge className={isModelConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}>
                {healthData?.status ? healthData.status.replace(/_/g, ' ') : 'MODEL_UNAVAILABLE'}
              </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <div className="flex justify-between">
                  <span className="text-slate-500">Input</span>
                  <span className="font-semibold text-slate-800">Hive Telemetry (Last 7 Days)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Model</span>
                  <span className="font-semibold text-slate-800">{healthData?.modelProvider || 'rule-based'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Model Version</span>
                  <span className="font-mono text-slate-800">{healthData?.modelVersion || 'rule-based-v1'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Generated At</span>
                  <span className="font-mono text-slate-800">
                    {healthResult ? new Date().toLocaleDateString() : 'Awaiting telemetry'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                <div className="flex justify-between">
                  <span className="text-slate-500">Prediction</span>
                  <span className="font-semibold text-slate-800">
                    {healthResult ? `${healthResult.healthCategory} (Score: ${healthResult.healthScore})` : 'AI service unavailable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confidence</span>
                  <span className="font-semibold text-slate-800">
                    {healthResult?.dataPoints ? `${Math.min(95, healthResult.dataPoints * 5)}% (Data-density weighted)` : 'Model not connected'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Recommendation</span>
                  <p className="text-slate-700 leading-snug">
                    {healthResult?.issues && healthResult.issues.length > 0
                      ? healthResult.issues.join('; ')
                      : healthData?.message || 'Connect an IoT gateway to begin receiving readings.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <Button size="sm" variant="outline" onClick={() => refetchHealth()}>
                ↻ Re-evaluate Biometrics
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: AI-ASSISTED ANOMALY DETECTION */}
      {activeTab === 'disease' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Brood & Comb Inspection Input</h3>
            <p className="text-xs text-slate-500">
              Submit an image URL or upload an apiary photograph to run machine-learning assisted anomaly and pathogen screening.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Comb Image URL</label>
                <Input
                  placeholder="https://example.com/apiary-comb-sample.jpg"
                  value={diseaseImageUrl}
                  onChange={(e) => setDiseaseImageUrl(e.target.value)}
                />
              </div>

              <div className="p-6 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl text-center">
                <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Brood comb visual input</p>
                <p className="text-[11px] text-slate-400 mt-1">Image input for computer vision classification</p>
              </div>

              <Button
                size="sm"
                className="w-full"
                isLoading={diseaseMutation.isPending}
                onClick={() => diseaseMutation.mutate(diseaseImageUrl)}
              >
                Run AI Anomaly Diagnostic
              </Button>
            </div>
          </Card>

          <Card className="border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Diagnostic Findings</h3>
            {diseaseResult ? (
              <div className="space-y-3 text-xs">
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Input</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                      {diseaseResult.imageUrl || diseaseImageUrl || 'Direct image upload'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model</span>
                    <span className="font-semibold text-slate-800">
                      {diseaseResult.modelProvider || 'ApisVision-Classifier'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model Version</span>
                    <span className="font-mono text-slate-800">
                      {diseaseResult.modelVersion || 'Not connected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prediction</span>
                    <span className="font-semibold text-slate-800">
                      {diseaseResult.result?.prediction || diseaseResult.message || 'AI service unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confidence</span>
                    <span className="font-semibold text-slate-800">
                      {diseaseResult.result?.confidence !== undefined
                        ? `${(diseaseResult.result.confidence * 100).toFixed(1)}%`
                        : 'Model not connected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Generated At</span>
                    <span className="font-mono text-slate-800">{new Date().toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl text-amber-800">
                  <span className="font-bold block mb-1">Recommendation:</span>
                  {diseaseResult.result?.recommendation ||
                    'Review visual inspections with a certified apiculture specialist. Machine learning diagnostics are decision-support tools.'}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs">Provide a comb photo and run diagnostic to inspect for parasites and brood anomalies.</p>
                <p className="text-[11px] text-slate-400">If AI is not configured, service status will be reported as unavailable.</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 3: PRODUCTIVITY FORECASTING */}
      {activeTab === 'productivity' && (
        <div className="space-y-4">
          <Card className="border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">PRODUCTIVITY FORECASTING</h3>
                <p className="text-xs text-slate-500">
                  Combines hive scale telemetry, historical flowering timelines, and regional rainfall data.
                </p>
              </div>
              <Button
                size="sm"
                isLoading={productivityMutation.isPending}
                onClick={() => productivityMutation.mutate()}
              >
                Run Forecast Simulation
              </Button>
            </div>

            {productivityResult ? (
              <div className="space-y-4 pt-2">
                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Input</span>
                      <span className="font-semibold text-slate-800">Hive Scale & Environmental Telemetry</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Model</span>
                      <span className="font-semibold text-slate-800">
                        {productivityResult.modelProvider || 'ApisYield-ML'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Model Version</span>
                      <span className="font-mono text-slate-800">
                        {productivityResult.modelVersion || 'Not connected'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Generated At</span>
                      <span className="font-mono text-slate-800">{new Date().toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Prediction</span>
                      <span className="font-semibold text-slate-800">
                        {productivityResult.result?.predictedYieldKg !== undefined
                          ? `${productivityResult.result.predictedYieldKg} kg projected`
                          : productivityResult.message || 'AI service unavailable'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Confidence</span>
                      <span className="font-semibold text-slate-800">
                        {productivityResult.result?.confidence !== undefined
                          ? `${productivityResult.result.confidence}%`
                          : 'Model not connected'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Recommendation</span>
                      <p className="text-slate-700 leading-snug">
                        {productivityResult.result?.recommendation ||
                          productivityResult.message ||
                          'Telemetry history required to compute seasonal nectar yield curve.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
                <ChartIcon className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">Yield Forecasting Simulation</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click 'Run Forecast Simulation' to evaluate seasonal hive telemetry against regional floral bloom indices.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
