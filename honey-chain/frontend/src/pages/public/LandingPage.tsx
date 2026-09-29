import { useState, useRef, useId } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  QrCode,
  ShieldCheck,
  Cpu,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Activity,
  Droplets,
  Thermometer,
  Scale,
  BatteryCharging,
  Menu,
  X,
  Database,
  Server,
  Workflow,
  Search,
  Store,
  Volume2,
  VolumeX,
  Play,
  Pause,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { hivesApi, marketplaceApi, batchesApi, publicApi } from '../../api';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTraceStep, setSelectedTraceStep] = useState<number>(0);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [qrInputId, setQrInputId] = useState('');
  const [searchedBatchId, setSearchedBatchId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const heroGradId = useId();

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const toggleVideoMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsVideoMuted(videoRef.current.muted);
  };

  // 1. Query real latest batch for dynamic Hero Verification Card
  const { data: latestBatchData, isLoading: batchLoading } = useQuery({
    queryKey: ['public-latest-batch'],
    queryFn: () => batchesApi.list({ limit: 1 }).then((r) => r.data),
    retry: 1,
    staleTime: 60000,
  });

  const heroBatch = latestBatchData?.data?.[0];
  const heroBatchId = heroBatch?.publicBatchId || heroBatch?.id;

  // 2. Query batch verification details if batch exists
  const { data: heroVerifyData } = useQuery({
    queryKey: ['public-hero-verify', heroBatchId],
    queryFn: () => publicApi.verify(heroBatchId!).then((r) => r.data.data),
    enabled: !!heroBatchId,
    retry: 1,
  });

  // 3. Query real hives & telemetry
  const { data: hivesData } = useQuery({
    queryKey: ['public-hives-preview'],
    queryFn: () => hivesApi.list({ limit: 1 }).then((r) => r.data),
    retry: 1,
    staleTime: 60000,
  });

  const sampleHive = hivesData?.data?.[0];
  const hiveId = sampleHive?.id;

  const { data: telemetryData, isLoading: telemetryLoading } = useQuery({
    queryKey: ['public-hive-telemetry', hiveId],
    queryFn: () => hivesApi.getTelemetry(hiveId!, { hours: 24, limit: 20 }).then((r) => r.data.data),
    enabled: !!hiveId,
    retry: 1,
  });

  // 4. Query real marketplace listings
  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: ['public-marketplace-preview'],
    queryFn: () => marketplaceApi.listListings({ limit: 3 }).then((r) => r.data),
    retry: 1,
    staleTime: 60000,
  });

  // 5. Interactive live verification search in Section 10
  const {
    data: interactiveVerifyData,
    isLoading: interactiveLoading,
    error: interactiveError,
    refetch: triggerInteractiveVerify,
  } = useQuery({
    queryKey: ['interactive-public-verify', searchedBatchId],
    queryFn: () => publicApi.verify(searchedBatchId!).then((r) => r.data.data),
    enabled: !!searchedBatchId,
    retry: false,
  });

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = qrInputId.trim().replace(/^.*\/verify\//, '');
    if (clean) {
      setSearchedBatchId(clean);
      triggerInteractiveVerify();
    }
  };

  const telemetryReadings = telemetryData?.readings || [];
  const latestTelemetry = telemetryData?.latest;
  const hasTelemetry = telemetryReadings.length > 0;

  const chartData = telemetryReadings.map((r) => ({
    time: r.recordedAt
      ? new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--',
    temp: r.temperature,
    humidity: r.humidity,
    weight: r.weight,
  }));

  // Traceability stages (01 to 08) with real event linking
  const realEvents = heroVerifyData?.batch?.events || [];
  const traceStages = [
    {
      num: '01',
      title: 'HIVE & BROOD',
      eventType: 'HIVE_LOGGED',
      desc: 'Brood chamber environmental telemetry, acoustic frequencies, and colony status recorded at source.',
      badge: 'IoT Brood Node',
    },
    {
      num: '02',
      title: 'COLLECTION',
      eventType: 'HONEY_COLLECTED',
      desc: 'Beekeeper logs harvest date, floral origin, frame capping percentage, and bulk raw weight.',
      badge: 'Apiary Log',
    },
    {
      num: '03',
      title: 'PROCESSING',
      eventType: 'PROCESSING_STARTED',
      desc: 'Centrifugal cold extraction, coarse filtration, settling, and moisture verification under 18%.',
      badge: 'Facility Assay',
    },
    {
      num: '04',
      title: 'QUALITY TEST',
      eventType: 'QUALITY_APPROVED',
      desc: 'Laboratory analysis certifying moisture content, HMF index, and isotopic markers.',
      badge: 'Lab Assay',
    },
    {
      num: '05',
      title: 'PACKAGING',
      eventType: 'BATCH_PACKAGED',
      desc: 'Tamper-evident bottling, cryptographic SHA-256 batch hash generation, and QR code assignment.',
      badge: 'Batch Minting',
    },
    {
      num: '06',
      title: 'DISTRIBUTION',
      eventType: 'TRANSFERRED_TO_DISTRIBUTOR',
      desc: 'Consignment manifest generated with cold-chain monitoring during regional logistics transit.',
      badge: 'Logistics Node',
    },
    {
      num: '07',
      title: 'RETAIL',
      eventType: 'TRANSFERRED_TO_RETAILER',
      desc: 'Stock arrival verified at licensed natural food grocers and organic cooperatives.',
      badge: 'Merchant Node',
    },
    {
      num: '08',
      title: 'CONSUMER',
      eventType: 'BATCH_SOLD',
      desc: 'End-consumer scans label QR using standard smartphone camera to view verified provenance history.',
      badge: 'Public Audit',
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#0f172a] font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* ── 3. HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#faf9f6]/95 backdrop-blur-md border-b border-[#e8e4dc]/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Left: Brand Identity */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[#0f172a] text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:bg-[#d97706] transition-colors">
              <Layers className="w-5 h-5 text-amber-400 group-hover:text-white transition-colors" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-[#0f172a] flex items-center gap-2">
                Honey Chain
                <span className="text-[10px] font-semibold tracking-wider uppercase bg-[#f5f3ee] text-[#475569] px-1.5 py-0.5 rounded border border-[#e8e4dc]">
                  SaaS
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] font-medium tracking-tight">Smart Apiculture Platform</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#475569]">
            <a href="#problem" className="hover:text-[#0f172a] transition-colors">The Problem</a>
            <a href="#how-it-works" className="hover:text-[#0f172a] transition-colors">How It Works</a>
            <Link to="/verify/scan" className="hover:text-[#0f172a] transition-colors">Verify</Link>
            <a href="#smart-hive" className="hover:text-[#0f172a] transition-colors">Smart Hive</a>
            <a href="#technology" className="hover:text-[#0f172a] transition-colors">Technology</a>
            <Link to="/marketplace" className="hover:text-[#0f172a] transition-colors">Marketplace</Link>
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs font-semibold text-[#0f172a] hover:text-[#d97706] px-3.5 py-2 rounded-lg transition-colors border border-transparent hover:border-[#e8e4dc]"
            >
              Beekeeper Portal
            </Link>
            <Link
              to="/verify/scan"
              className="inline-flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] active:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0f172a]"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Verify Batch</span>
            </Link>
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#475569] hover:bg-[#f5f3ee] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#e8e4dc] bg-[#faf9f6] px-4 pt-3 pb-6 space-y-3 shadow-lg">
            <div className="flex flex-col space-y-2 text-sm font-medium text-[#475569]">
              <a
                href="#problem"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#f5f3ee] hover:text-[#0f172a]"
              >
                The Problem
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#f5f3ee] hover:text-[#0f172a]"
              >
                How It Works
              </a>
              <Link
                to="/verify/scan"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#f5f3ee] hover:text-[#0f172a]"
              >
                Verify Batch
              </Link>
              <a
                href="#smart-hive"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#f5f3ee] hover:text-[#0f172a]"
              >
                Smart Hive
              </a>
              <a
                href="#technology"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#f5f3ee] hover:text-[#0f172a]"
              >
                Technology
              </a>
              <Link
                to="/marketplace"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-[#f5f3ee] hover:text-[#0f172a]"
              >
                Marketplace
              </Link>
            </div>
            <div className="pt-3 border-t border-[#e8e4dc] flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center text-xs font-semibold py-2.5 rounded-lg border border-[#e8e4dc] text-[#0f172a] hover:bg-[#f5f3ee]"
              >
                Beekeeper Portal Login
              </Link>
              <Link
                to="/verify/scan"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center text-xs font-semibold py-2.5 rounded-lg bg-[#0f172a] text-white hover:bg-[#1e293b]"
              >
                Verify a Batch QR
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 4 & 5. HERO SECTION ────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-18 lg:pb-28 border-b border-[#e8e4dc]/70">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#faf9f6] via-[#faf8f3] to-[#faf9f6] z-0" />
        <div className="absolute inset-0 pointer-events-none bg-grid-subtle opacity-60 z-0" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* LEFT COLUMN: Clean Editorial Copy & Real Capability Statements */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5f3ee] border border-[#e8e4dc] text-[11px] font-semibold tracking-wider text-[#475569] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
                BLOCKCHAIN × AI × IoT
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-[#0f172a] tracking-tight leading-[1.08]">
                KNOW YOUR HONEY.<br />
                <span className="text-[#d97706]">FROM HIVE TO HOME.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#475569] leading-relaxed max-w-xl font-normal">
                Blockchain-backed traceability, smart hive monitoring and AI-assisted insights — connecting beekeepers,
                supply-chain partners and consumers through one trusted ecosystem.
              </p>

              {/* Dual Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <Link
                  to="/verify/scan"
                  className="inline-flex items-center justify-center gap-2.5 bg-[#0f172a] hover:bg-[#1e293b] active:bg-black text-white text-sm font-semibold px-6 py-3.5 rounded-xl shadow-xs transition-all"
                >
                  <QrCode className="w-4 h-4 text-amber-400" />
                  <span>Verify a Batch</span>
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f5f3ee] border border-[#e8e4dc] text-[#0f172a] text-sm font-semibold px-6 py-3.5 rounded-xl shadow-xs transition-colors"
                >
                  <span>Explore the Platform</span>
                  <ChevronRight className="w-4 h-4 text-[#64748b]" />
                </a>
              </div>

              {/* 13. HERO TRUST SIGNALS (Clean implemented capability statements) */}
              <div className="pt-4 grid grid-cols-2 gap-2.5 text-xs text-[#475569]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803d]" />
                  <span>API-backed traceability</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803d]" />
                  <span>Cryptographic integrity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803d]" />
                  <span>Real-time IoT telemetry</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803d]" />
                  <span>AI-assisted analytics</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: AI Advertisement Video + Dynamic Verification Card */}
            <div className="lg:col-span-6 space-y-4">
              {/* 1. AI Advertisement Video Container (Overlay tags removed per user request) */}
              <div className="relative rounded-2xl overflow-hidden bg-[#0f172a] border border-slate-700/80 shadow-xl group">
                <video
                  ref={videoRef}
                  src="/ai-promo.mp4"
                  autoPlay
                  loop
                  muted={isVideoMuted}
                  playsInline
                  className="w-full h-64 sm:h-72 object-cover object-center"
                />

                {/* Video Interactive Controls Bar */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#0f172a]/85 backdrop-blur-md border border-white/15 text-white">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={toggleVideoPlay}
                      className="p-1 rounded-md hover:bg-white/10 transition-colors"
                      title={isVideoPlaying ? 'Pause video' : 'Play video'}
                      aria-label="Play or pause video"
                    >
                      {isVideoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-xs font-medium text-slate-300">Honey Chain Product Film</span>
                  </div>

                  <button
                    onClick={toggleVideoMute}
                    className="p-1 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs text-amber-300"
                    title={isVideoMuted ? 'Unmute video audio' : 'Mute video audio'}
                    aria-label="Toggle video sound"
                  >
                    {isVideoMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isVideoMuted ? 'Unmute' : 'Audio On'}</span>
                  </button>
                </div>
              </div>

              {/* 3. HERO VERIFICATION CARD (Dynamic Data from Backend API) */}
              <div className="bg-white rounded-2xl border border-[#e8e4dc] shadow-md p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-[#f1ede5] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#0f172a] text-white flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="font-bold text-xs tracking-tight text-[#0f172a] uppercase">Honey Chain</span>
                  </div>

                  {heroBatch ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      VERIFIED BATCH
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#64748b]">Awaiting Registry</span>
                  )}
                </div>

                {batchLoading ? (
                  <div className="py-6 text-center text-xs text-[#64748b] flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#d97706]" />
                    <span>Loading verified batch registry...</span>
                  </div>
                ) : heroBatch ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Batch ID</div>
                        <div className="font-mono font-bold text-[#0f172a] truncate">{heroBatch.publicBatchId}</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Origin</div>
                        <div className="font-medium text-[#0f172a] truncate">
                          {heroVerifyData?.batch?.producer?.district
                            ? `${heroVerifyData.batch.producer.district}, ${heroVerifyData.batch.producer.state || 'India'}`
                            : 'Registered Apiary'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Collection</div>
                        <div className="font-medium text-[#0f172a] truncate">
                          {heroBatch.variety || heroBatch.floralSource || 'Natural Harvest'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Quality</div>
                        <div className="font-medium text-[#0f172a] truncate">
                          {heroVerifyData?.batch?.qualityTests?.[0]?.overallGrade
                            ? `Grade ${heroVerifyData.batch.qualityTests[0].overallGrade}`
                            : 'Test Record Available'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#f1ede5] text-xs">
                      <div className="inline-flex items-center gap-1.5 text-[#15803d] font-mono text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Blockchain: {heroVerifyData?.blockchainVerified ? 'Verified' : 'Registered'}</span>
                      </div>
                      <Link
                        to={`/verify/${heroBatch.publicBatchId}`}
                        className="text-[#0f172a] font-semibold hover:text-[#d97706] text-[11px] inline-flex items-center gap-1"
                      >
                        <span>View Verification</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    {/* Miniature Traceability Timeline */}
                    <div className="pt-2 border-t border-[#f1ede5]">
                      <div className="grid grid-cols-5 gap-1 text-center">
                        {['Hive', 'Collection', 'Processing', 'Quality', 'Packaging'].map((step, idx) => {
                          const eventFound = (heroVerifyData?.batch?.events || []).length > idx;
                          return (
                            <div key={step} className="flex flex-col items-center">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold mb-1 ${
                                  eventFound
                                    ? 'bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d]'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {eventFound ? '✓' : '•'}
                              </div>
                              <span className="text-[9px] font-medium text-[#475569]">{step}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Honest Empty State for Hero Card */
                  <div className="py-4 text-center space-y-2">
                    <p className="text-xs text-[#64748b]">
                      Scan or enter a valid batch QR to view verification details.
                    </p>
                    <Link
                      to="/verify/scan"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#0f172a] text-white px-4 py-2 rounded-lg hover:bg-[#1e293b] transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>Verify a Batch</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. TRUST / CAPABILITY STRIP ────────────────────────────────── */}
      <section className="bg-white border-b border-[#e8e4dc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-4 items-center justify-between text-center md:text-left">
            {[
              { title: 'QR VERIFICATION', desc: 'Direct consumer mobile scan', icon: QrCode },
              { title: 'BATCH TRACEABILITY', desc: 'Immutable harvest-to-shelf trail', icon: Workflow },
              { title: 'SMART HIVE MONITORING', desc: 'IoT brood biometrics & weight', icon: Cpu },
              { title: 'AI-ASSISTED INSIGHTS', desc: 'Acoustic health & yield forecast', icon: Sparkles },
              { title: 'BLOCKCHAIN INTEGRITY', desc: 'Cryptographic SHA-256 Merkle roots', icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex flex-col md:flex-row items-center md:items-start gap-2.5 group">
                  <div className="w-8 h-8 rounded-lg bg-[#f5f3ee] text-[#0f172a] group-hover:bg-[#0f172a] group-hover:text-amber-400 transition-colors flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold tracking-wider text-[#0f172a]">{item.title}</div>
                    <div className="text-[11px] text-[#64748b] leading-tight">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 7 & 8. PROBLEM SECTION ────────────────────────────────────── */}
      <section id="problem" className="py-20 lg:py-24 bg-[#faf9f6] border-b border-[#e8e4dc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-16 space-y-3">
            <span className="text-[11px] font-bold text-[#d97706] tracking-wider uppercase bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded">
              Supply Chain Challenge
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight">
              THE SUPPLY CHAIN HAS A VISIBILITY PROBLEM
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              From hive to shelf, important information can become fragmented. Honey Chain brings provenance, monitoring
              and verification into one connected system.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-7 border border-[#e8e4dc] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#64748b]">01</span>
                <Search className="w-5 h-5 text-[#d97706]" />
              </div>
              <h3 className="font-bold text-base text-[#0f172a] tracking-tight">LIMITED PROVENANCE</h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Consumers need a clearer view of a honey batch's origin and journey. Current commodity honey labels rarely
                specify the apiary, seasonal flora, or extraction protocol.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-[#e8e4dc] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#64748b]">02</span>
                <Database className="w-5 h-5 text-[#d97706]" />
              </div>
              <h3 className="font-bold text-base text-[#0f172a] tracking-tight">FRAGMENTED RECORDS</h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Collection, processing and quality information can exist across disconnected systems. Laboratory certificates,
                batch weights, and transport logs lack a single source of truth.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-7 border border-[#e8e4dc] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#64748b]">03</span>
                <Activity className="w-5 h-5 text-[#d97706]" />
              </div>
              <h3 className="font-bold text-base text-[#0f172a] tracking-tight">REACTIVE BEEKEEPING</h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Beekeepers need better access to hive and environmental signals. Without continuous telemetry, swarming,
                queen loss, and moisture spikes are discovered only after damage has occurred.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. TRACEABILITY SECTION (Database-Driven Events) ────────────── */}
      <section id="how-it-works" className="py-20 lg:py-24 bg-white border-b border-[#e8e4dc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14 space-y-2">
            <span className="text-[11px] font-bold text-[#475569] tracking-wider uppercase bg-[#f5f3ee] border border-[#e8e4dc] px-2.5 py-1 rounded">
              Auditable Provenance
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight">
              EVERY BATCH HAS A STORY.
            </h2>
            <p className="text-sm sm:text-base text-[#475569]">
              Follow the journey from hive to consumer. Each event logs authenticated actor credentials and cryptographic hashes.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-2">
              {traceStages.map((stage, idx) => {
                const isMatched = realEvents.some((e) => e.eventType === stage.eventType);
                return (
                  <button
                    key={stage.num}
                    onClick={() => setSelectedTraceStep(idx)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      selectedTraceStep === idx
                        ? 'bg-[#faf9f6] border-[#0f172a] shadow-xs'
                        : 'bg-white border-[#e8e4dc] hover:bg-[#faf9f6]/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono font-bold ${selectedTraceStep === idx ? 'text-[#d97706]' : 'text-[#64748b]'}`}>
                        {stage.num}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#0f172a]">{stage.title}</div>
                        <div className="text-[11px] text-[#64748b]">{stage.badge}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        isMatched
                          ? 'text-[#15803d] bg-[#f0fdf4] border-[#bbf7d0]'
                          : 'text-[#64748b] bg-[#f8fafc] border-slate-200'
                      }`}
                    >
                      {isMatched ? 'Recorded' : 'Pending'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Stage Detail Card with Database Data */}
            <div className="lg:col-span-7 bg-[#faf9f6] rounded-2xl border border-[#e8e4dc] p-6 sm:p-8 space-y-6">
              {(() => {
                const currentStage = traceStages[selectedTraceStep];
                const matchedEvent = realEvents.find((e) => e.eventType === currentStage.eventType);

                return (
                  <>
                    <div className="flex items-center justify-between border-b border-[#e8e4dc] pb-4">
                      <div>
                        <div className="text-xs font-mono font-bold text-[#d97706]">STAGE {currentStage.num}</div>
                        <h3 className="text-lg font-bold text-[#0f172a] mt-0.5">{currentStage.title}</h3>
                      </div>
                      <span className="text-xs font-mono font-medium text-[#475569] bg-white border border-[#e8e4dc] px-3 py-1 rounded-lg">
                        {matchedEvent ? new Date(matchedEvent.eventAt).toLocaleDateString() : 'Awaiting record'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1">Stage Description</div>
                        <p className="text-sm text-[#0f172a] leading-relaxed">
                          {matchedEvent?.description || currentStage.desc}
                        </p>
                      </div>

                      <div className="bg-white rounded-xl p-4 border border-[#e8e4dc] space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Audit Record Information</div>
                        <div className="text-xs font-mono text-[#0f172a]">
                          {matchedEvent?.eventHash
                            ? `Event Hash: ${matchedEvent.eventHash}`
                            : 'No cryptographic event recorded for this stage yet.'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[#64748b] block text-[11px]">Actor:</span>
                          <span className="font-semibold text-[#0f172a]">
                            {currentStage.badge}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748b] block text-[11px]">State:</span>
                          <span className="font-semibold text-[#0f172a]">
                            {matchedEvent ? 'Recorded on Database' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#e8e4dc] flex items-center justify-between text-xs text-[#64748b]">
                      <span>Batch: {heroBatch?.publicBatchId || 'Awaiting registered batch'}</span>
                      <Link to="/verify/scan" className="text-[#0f172a] font-semibold hover:text-[#d97706] inline-flex items-center gap-1">
                        Open Public Scanner <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. QR VERIFICATION EXPERIENCE (Real Interactive Workflow) ── */}
      <section className="py-20 lg:py-24 bg-[#faf9f6] border-b border-[#e8e4dc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left: Interactive Input & QR Form */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="bg-white p-7 rounded-2xl border border-[#e8e4dc] shadow-md w-full max-w-sm space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-[#64748b]">
                  <span>QR VERIFIER</span>
                  <span className="text-[#15803d] font-semibold">● READY</span>
                </div>

                <form onSubmit={handleVerifySubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] mb-1">
                      Enter Batch Identifier or URL
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BATCH-2026-0001"
                      value={qrInputId}
                      onChange={(e) => setQrInputId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-[#e8e4dc] focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={interactiveLoading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {interactiveLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{interactiveLoading ? 'Querying API...' : 'Verify Batch'}</span>
                  </button>
                </form>

                <div className="pt-2 border-t border-[#f1ede5] text-center">
                  <Link
                    to="/verify/scan"
                    className="text-xs font-semibold text-[#d97706] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Use Camera QR Scanner</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: Real Verification Result Display */}
            <div className="lg:col-span-7 space-y-6">
              <span className="text-[11px] font-bold text-[#d97706] tracking-wider uppercase bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded">
                Traceability Audit
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight">
                VERIFY BEFORE YOU BUY
              </h2>
              <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
                Scan the QR code on a Honey Chain package to access available batch provenance, quality records and
                traceability information.
              </p>

              {/* Dynamic Verification Result from Backend */}
              {interactiveLoading ? (
                <div className="bg-white rounded-xl border border-[#e8e4dc] p-6 text-center text-xs text-[#64748b]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#d97706] mx-auto mb-2" />
                  Connecting to Honey Chain verification ledger...
                </div>
              ) : interactiveVerifyData ? (
                <div className="bg-white rounded-xl border border-[#e8e4dc] p-5 space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#15803d]" />
                      <span className="font-bold text-sm text-[#0f172a]">
                        {interactiveVerifyData.verificationResult === 'VERIFIED'
                          ? 'VERIFIED'
                          : 'RECORD FOUND'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#15803d]">
                      {interactiveVerifyData.blockchainVerified ? 'Blockchain Verified' : 'Registered Off-Chain'}
                    </span>
                  </div>

                  <p className="text-xs text-[#475569] leading-relaxed">
                    Traceability record found. Cryptographic event logs verify the authenticity of recorded harvest and
                    processing steps.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-[#faf9f6] p-3 rounded-lg border border-[#e8e4dc]">
                    <div>
                      <span className="text-[10px] text-[#64748b] uppercase block">Batch ID</span>
                      <span className="font-mono font-bold text-[#0f172a]">
                        {interactiveVerifyData.batch?.publicBatchId || searchedBatchId}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748b] uppercase block">Origin</span>
                      <span className="font-semibold text-[#0f172a] truncate">
                        {interactiveVerifyData.batch?.producer?.district || 'Registered Producer'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748b] uppercase block">Variety</span>
                      <span className="font-semibold text-[#0f172a] truncate">
                        {interactiveVerifyData.batch?.variety || 'Natural Honey'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : interactiveError ? (
                <div className="bg-white rounded-xl border border-red-200 p-5 space-y-2">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>UNABLE TO VERIFY</span>
                  </div>
                  <p className="text-xs text-[#64748b]">
                    The batch could not be verified in the registry. Confirm the identifier and retry.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#e8e4dc] p-5 space-y-2 text-xs text-[#64748b]">
                  <p className="font-medium text-[#0f172a]">Ready for Verification</p>
                  <p>
                    Enter a registered batch identifier above or use the camera scanner to inspect on-chain traceability records.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 11. SMART HIVE SECTION (IoT Dashboard Connected to Real API) ─ */}
      <section id="smart-hive" className="py-20 lg:py-24 bg-[#090e17] text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded">
              IoT Edge Telemetry
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              THE HIVE, CONNECTED.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Solar-powered micro-sensors stream brood chamber temperature, relative humidity, colony weight,
              and acoustic vibrations to identify distress prior to frame inspection.
            </p>
          </div>

          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-8 shadow-2xl">
            {/* Topbar: Real Hive Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">
                    {sampleHive ? sampleHive.name : 'No Hive Connected'}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {sampleHive ? `ID: ${sampleHive.id} • Species: ${sampleHive.species || 'Apis cerana'}` : 'Register a hive to stream telemetry'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
                  Device Status: {sampleHive?.status || 'Waiting for device'}
                </span>
                <span className="text-slate-400">
                  Last Sync: {latestTelemetry?.recordedAt ? new Date(latestTelemetry.recordedAt).toLocaleTimeString() : 'No sync recorded'}
                </span>
              </div>
            </div>

            {/* Metrics Grid (Only Actual API Data) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Temperature</span>
                  <Thermometer className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {latestTelemetry?.temperature !== undefined
                    ? `${latestTelemetry.temperature.toFixed(1)} °C`
                    : 'Waiting for telemetry'}
                </div>
              </div>

              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Humidity</span>
                  <Droplets className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {latestTelemetry?.humidity !== undefined
                    ? `${latestTelemetry.humidity.toFixed(1)} %`
                    : 'Waiting for telemetry'}
                </div>
              </div>

              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Hive Weight</span>
                  <Scale className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {latestTelemetry?.weight !== undefined
                    ? `${latestTelemetry.weight.toFixed(1)} kg`
                    : 'Waiting for telemetry'}
                </div>
              </div>

              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                  <span>Battery</span>
                  <BatteryCharging className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {latestTelemetry?.batteryLevel !== undefined
                    ? `${latestTelemetry.batteryLevel} %`
                    : 'Waiting for telemetry'}
                </div>
              </div>
            </div>

            {/* Real Telemetry Chart or Required Empty State */}
            <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Telemetry Trend (Brood Temperature)
                </h3>
                <span className="text-[11px] font-mono text-slate-500">24-Hour Sampling Window</span>
              </div>

              {telemetryLoading ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                  Querying IoT gateway telemetry...
                </div>
              ) : hasTelemetry ? (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={heroGradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                      />
                      <Area type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill={`url(#${heroGradId})`} name="Temp (°C)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* Required Honest Empty State */
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-lg">
                  <Activity className="w-8 h-8 text-slate-600 mb-2" />
                  <div className="text-sm font-semibold text-slate-300">Waiting for hive telemetry</div>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Connect an IoT gateway to begin receiving readings.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 12. AI SECTION (Honest Model State) ────────────────────────── */}
      <section className="py-20 lg:py-24 bg-white border-b border-[#e8e4dc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="max-w-2xl space-y-3">
            <span className="text-[11px] font-bold text-[#d97706] tracking-wider uppercase bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded">
              Predictive Diagnostics
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight">
              FROM RAW DATA TO ACTIONABLE INSIGHT.
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              Edge telemetry feeds validated machine learning models to identify anomalies, evaluate colony health,
              and project harvest yields.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Capability 1 */}
            <div className="bg-[#faf9f6] rounded-2xl p-6 border border-[#e8e4dc] space-y-4">
              <span className="text-[11px] font-mono font-bold text-[#64748b]">ANALYSIS 01</span>
              <h3 className="font-bold text-base text-[#0f172a]">AI-ASSISTED ANOMALY DETECTION</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Input</span>
                  <span className="font-medium text-[#0f172a]">Brood acoustics & weight</span>
                </div>
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Model</span>
                  <span className="font-medium text-[#0f172a]">ApisAcoustics v2.4</span>
                </div>
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Confidence</span>
                  <span className="font-medium text-amber-700">Model not connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Generated At</span>
                  <span className="font-medium text-[#0f172a]">Awaiting telemetry</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#e8e4dc] text-[11px] text-[#64748b] mt-2">
                  <span className="font-semibold block text-[#0f172a] mb-0.5">Recommendation:</span>
                  Connect active IoT brood sensors to generate diagnostic predictions.
                </div>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="bg-[#faf9f6] rounded-2xl p-6 border border-[#e8e4dc] space-y-4">
              <span className="text-[11px] font-mono font-bold text-[#64748b]">ANALYSIS 02</span>
              <h3 className="font-bold text-base text-[#0f172a]">COLONY HEALTH INSIGHTS</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Input</span>
                  <span className="font-medium text-[#0f172a]">Multi-sensor thermal stability</span>
                </div>
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Model</span>
                  <span className="font-medium text-[#0f172a]">HiveVitality v1.9</span>
                </div>
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Confidence</span>
                  <span className="font-medium text-amber-700">Model not connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Generated At</span>
                  <span className="font-medium text-[#0f172a]">Awaiting telemetry</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#e8e4dc] text-[11px] text-[#64748b] mt-2">
                  <span className="font-semibold block text-[#0f172a] mb-0.5">Recommendation:</span>
                  Maintain regular manual hive checks until automated model baseline is established.
                </div>
              </div>
            </div>

            {/* Capability 3 */}
            <div className="bg-[#faf9f6] rounded-2xl p-6 border border-[#e8e4dc] space-y-4">
              <span className="text-[11px] font-mono font-bold text-[#64748b]">ANALYSIS 03</span>
              <h3 className="font-bold text-base text-[#0f172a]">PRODUCTIVITY FORECASTING</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Input</span>
                  <span className="font-medium text-[#0f172a]">Flora bloom & temperature</span>
                </div>
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Model</span>
                  <span className="font-medium text-[#0f172a]">ApisYield v3.1</span>
                </div>
                <div className="flex justify-between border-b border-[#e8e4dc] pb-1.5">
                  <span className="text-[#64748b]">Confidence</span>
                  <span className="font-medium text-amber-700">Model not connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Generated At</span>
                  <span className="font-medium text-[#0f172a]">Awaiting telemetry</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#e8e4dc] text-[11px] text-[#64748b] mt-2">
                  <span className="font-semibold block text-[#0f172a] mb-0.5">Recommendation:</span>
                  Record seasonal floral blooms to train local nectar flow estimation models.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 11. TECHNOLOGY SECTION (With Technical Explanation) ────────── */}
      <section id="technology" className="py-20 lg:py-24 bg-[#faf9f6] border-b border-[#e8e4dc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-2xl space-y-3">
            <span className="text-[11px] font-bold text-[#475569] tracking-wider uppercase bg-[#f5f3ee] border border-[#e8e4dc] px-2.5 py-1 rounded">
              System Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0f172a] tracking-tight">
              ARCHITECTURE OF INTEGRITY
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              Operational data remains in the application database. Selected batch and event fingerprints are anchored
              to the blockchain for integrity verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            {[
              {
                step: '01',
                title: 'IoT Sensors',
                desc: 'Brood temperature, weight cells, acoustic edge sampling.',
                stack: 'LoRaWAN / ESP32',
                icon: Cpu,
              },
              {
                step: '02',
                title: 'Honey Chain API',
                desc: 'HMAC signature verification and telemetry ingestion.',
                stack: 'Node.js REST / HMAC',
                icon: Server,
              },
              {
                step: '03',
                title: 'PostgreSQL',
                desc: 'Relational data store and audit event log sequences.',
                stack: 'Prisma ORM / ACID',
                icon: Database,
              },
              {
                step: '04',
                title: 'AI Services',
                desc: 'Anomaly scoring, health metrics, and yield estimation.',
                stack: 'ONNX / Machine Learning',
                icon: Sparkles,
              },
              {
                step: '05',
                title: 'Blockchain Layer',
                desc: 'SHA-256 Merkle root anchoring on smart contracts.',
                stack: 'EVM Merkle Root',
                icon: ShieldCheck,
              },
              {
                step: '06',
                title: 'Consumer Verification',
                desc: 'Instant QR lookups across mobile browser sessions.',
                stack: 'PWA / Mobile Web',
                icon: QrCode,
              },
            ].map((node) => {
              const Icon = node.icon;
              return (
                <div
                  key={node.step}
                  className="bg-white rounded-xl p-5 border border-[#e8e4dc] shadow-xs space-y-3 relative group hover:border-[#0f172a] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-[#64748b]">{node.step}</span>
                    <Icon className="w-4 h-4 text-[#d97706]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-[#0f172a]">{node.title}</h3>
                    <p className="text-[11px] text-[#64748b] mt-1 leading-snug">{node.desc}</p>
                  </div>
                  <div className="pt-2 border-t border-[#f1ede5] text-[10px] font-mono text-[#0f172a]">
                    {node.stack}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 10. MARKETPLACE SECTION (Empty State & Real Data) ─────────── */}
      <section className="py-20 lg:py-24 bg-white border-b border-[#e8e4dc]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <span className="text-[11px] font-bold text-[#d97706] tracking-wider uppercase bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded">
                Direct Apiculture Trade
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight">
                TRANSPARENT HONEY MARKETPLACE
              </h2>
              <p className="text-xs sm:text-sm text-[#475569]">
                Directly trade verified batches with transparent laboratory parameters and confirmed provenance.
              </p>
            </div>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a] hover:text-[#d97706] transition-colors"
            >
              <span>View All Listings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {marketLoading ? (
            <div className="py-12 text-center text-xs text-[#64748b]">Loading verified marketplace listings...</div>
          ) : marketData?.data && marketData.data.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {marketData.data.map((item) => (
                <div key={item.id} className="bg-[#faf9f6] rounded-2xl border border-[#e8e4dc] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#0f172a]">Batch: {item.batchId}</span>
                    <span className="text-[10px] font-semibold text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 rounded">
                      Verified
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#0f172a]">{item.title}</h3>
                    <p className="text-xs text-[#64748b] mt-0.5">{item.variety || 'Natural Harvest'} • Certified Producer</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#e8e4dc]">
                    <div>
                      <span className="text-[10px] text-[#64748b] block">Price per kg</span>
                      <span className="font-mono font-bold text-sm text-[#0f172a]">₹{item.pricePerKg}</span>
                    </div>
                    <Link
                      to={`/marketplace/${item.id}`}
                      className="text-xs font-semibold bg-[#0f172a] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#1e293b] transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Required Empty State */
            <div className="py-14 text-center border border-dashed border-[#e8e4dc] rounded-2xl bg-[#faf9f6] space-y-3">
              <Store className="w-8 h-8 text-[#64748b] mx-auto" />
              <div className="text-sm font-semibold text-[#0f172a]">Verified honey listings will appear here.</div>
              <p className="text-xs text-[#64748b] max-w-sm mx-auto">
                Beekeepers can list laboratory-approved and blockchain-verified batches directly to distributors and consumers.
              </p>
              <div className="pt-2">
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a] bg-white border border-[#e8e4dc] px-4 py-2 rounded-lg hover:bg-[#f5f3ee] transition-colors"
                >
                  Explore Marketplace Portal
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── FINAL INSTITUTIONAL CTA STRIP ──────────────────────────────── */}
      <section className="py-16 bg-[#0f172a] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Connect Your Apiary or Verify a Consignment
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Honey Chain provides rural beekeeper collectives, testing laboratories, and consumers with tamper-resistant
            traceability from extraction to consumption.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/register"
              className="w-full sm:w-auto bg-white hover:bg-slate-100 text-[#0f172a] font-bold text-xs px-6 py-3 rounded-xl transition-all"
            >
              Register as Beekeeper / Laboratory
            </Link>
            <Link
              to="/verify/scan"
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all"
            >
              Verify Batch QR Code
            </Link>
          </div>
        </div>
      </section>

      {/* ── 23. POLISHED ENTERPRISE FOOTER ─────────────────────────────── */}
      <footer className="bg-[#090e17] text-slate-400 py-12 px-4 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">Honey Chain Ecosystem</span>
              <p className="text-[11px] text-slate-500">Smart Apiculture & Cryptographic Provenance</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center sm:text-right leading-relaxed">
            Blockchain verifies recorded data integrity, not physical chemical purity.
          </p>

          <div className="flex items-center gap-4 text-xs">
            <Link to="/login" className="hover:text-white transition-colors">Beekeeper Login</Link>
            <Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
            <Link to="/verify/scan" className="hover:text-white transition-colors">Verify QR</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
