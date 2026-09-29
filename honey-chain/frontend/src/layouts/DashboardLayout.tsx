import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';
import toast from 'react-hot-toast';
import { cn } from '../utils';
import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  Cpu,
  Package,
  FlaskConical,
  Sparkles,
  Bell,
  Store,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['all'] },
  { to: '/hives', label: 'My Hives', icon: Layers, roles: ['BEEKEEPER', 'ADMIN'] },
  { to: '/devices', label: 'IoT Devices', icon: Cpu, roles: ['BEEKEEPER', 'ADMIN'] },
  { to: '/batches', label: 'Honey Batches', icon: Package, roles: ['all'] },
  { to: '/quality', label: 'Quality Tests', icon: FlaskConical, roles: ['QUALITY_LAB', 'ADMIN', 'BEEKEEPER'] },
  { to: '/ai', label: 'AI Insights', icon: Sparkles, roles: ['BEEKEEPER', 'ADMIN'] },
  { to: '/alerts', label: 'Alerts', icon: Bell, roles: ['BEEKEEPER', 'ADMIN'] },
  { to: '/marketplace', label: 'Marketplace', icon: Store, roles: ['all'] },
  { to: '/admin/users', label: 'Admin Panel', icon: ShieldCheck, roles: ['ADMIN'] },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const filteredNav = NAV_ITEMS.filter(
    (item) => item.roles.includes('all') || (user && item.roles.includes(user.role))
  );

  return (
    <div className="flex h-screen bg-[#faf9f6]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-[#0f172a] text-slate-300 flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight">Honey Chain</span>
            <p className="text-[11px] text-slate-400">Apiculture SaaS</p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                  active
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
                )}
              >
                <Icon className={cn('w-4 h-4', active ? 'text-amber-400' : 'text-slate-400')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Public verifier shortcut */}
        <div className="px-3 py-3 border-t border-slate-800">
          <Link
            to="/verify/scan"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              Public QR Verifier
            </span>
          </Link>
        </div>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {user ? `${user.firstName} ${user.lastName}` : 'Signed In'}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">{user?.role || 'User'}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-[#e8e4dc] px-4 lg:px-6 py-3.5 flex items-center justify-between gap-4">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <span>Honey Chain Ecosystem</span>
            <span>/</span>
            <span className="font-semibold text-[#0f172a] capitalize">
              {location.pathname.replace('/', '') || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/verify/scan"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a] hover:text-[#d97706] bg-[#faf9f6] border border-[#e8e4dc] px-3 py-1.5 rounded-lg transition-colors"
            >
              Verify QR
            </Link>
            <div className="flex items-center gap-2 text-xs text-[#0f172a] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{user?.firstName}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#faf9f6]">
          {children}
        </main>
      </div>
    </div>
  );
}
