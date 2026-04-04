import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, TrendingDown, Trophy, Users, Building2, FileEdit, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import SalesContracts from './pages/SalesContracts';
import PurchaseContracts from './pages/PurchaseContracts';
import Performance from './pages/Performance';
import Salespeople from './pages/Salespeople';
import Clients from './pages/Clients';
import Quotations from './pages/Quotations';
import { ToastContainer } from './components/Toast';
import { ConfirmDialogContainer } from './components/ConfirmDialog';
import { AlertModalContainer } from './components/AlertModal';
import { CurrencyProvider } from './contexts/CurrencyContext';
import CurrencySelector from './components/CurrencySelector';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/',            label: '계약 현황',    icon: LayoutDashboard, end: true },
  { to: '/sales',       label: '매출계약',      icon: TrendingUp },
  { to: '/purchase',    label: '매입계약',      icon: TrendingDown },
  { to: '/performance', label: '영업 성과',    icon: Trophy },
  { to: '/salespeople', label: '영업사원 관리', icon: Users },
  { to: '/quotations',  label: '견적서',         icon: FileEdit },
  { to: '/clients',     label: '거래처 관리',   icon: Building2 },
];

export default function App() {
  return (
    <CurrencyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </CurrencyProvider>
  );
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <nav className={cn(
        'flex flex-col gradient-sidebar shrink-0 transition-all duration-300 ease-in-out border-r border-white/5',
        collapsed ? 'w-[64px]' : 'w-[240px]'
      )}>
        {/* Logo */}
        <div className="flex items-center min-h-[64px] border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-3 px-5 flex-1">
              <div className="w-8 h-8 rounded-lg gradient-blue flex items-center justify-center text-white text-sm font-bold shadow-lg">S</div>
              <div>
                <div className="text-sm font-bold text-white tracking-tight">SI 계약 ERP</div>
                <div className="text-[10px] text-slate-400">Contract Management</div>
              </div>
            </div>
          )}
          <button
            className={cn(
              'p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150',
              collapsed ? 'mx-auto' : 'mr-3'
            )}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Nav */}
        <div className="flex flex-col gap-1 mt-4 px-3 flex-1">
          {!collapsed && <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">메뉴</div>}
          {NAV_ITEMS.map(item => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-auto">
          <CurrencySelector collapsed={collapsed} />
          {!collapsed && (
            <div className="py-4 px-5 border-t border-white/10 text-center">
              <div className="text-[10px] text-slate-500 font-medium">v1.2.0 · SI 계약 관리</div>
            </div>
          )}
        </div>
      </nav>

      {/* Overlays */}
      <ToastContainer />
      <ConfirmDialogContainer />
      <AlertModalContainer />

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-[1400px] mx-auto">
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/sales"        element={<SalesContracts />} />
            <Route path="/purchase"     element={<PurchaseContracts />} />
            <Route path="/performance"  element={<Performance />} />
            <Route path="/salespeople"  element={<Salespeople />} />
            <Route path="/quotations"  element={<Quotations />} />
            <Route path="/clients"     element={<Clients />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, label, icon: Icon, end, collapsed }) {
  return (
    <NavLink
      to={to} end={end} title={collapsed ? label : undefined}
      className={({ isActive }) => cn(
        'group flex items-center gap-3 rounded-xl text-[13px] no-underline transition-all duration-150 relative',
        collapsed ? 'justify-center py-3 mx-auto w-10 h-10' : 'px-3 py-2.5',
        isActive
          ? 'bg-white/15 text-white font-semibold shadow-sm shadow-black/10'
          : 'text-slate-400 hover:bg-white/8 hover:text-white'
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />}
          <Icon size={collapsed ? 20 : 17} className={cn(isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300')} />
          {!collapsed && <span>{label}</span>}
        </>
      )}
    </NavLink>
  );
}
