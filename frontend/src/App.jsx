import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SalesContracts from './pages/SalesContracts';
import PurchaseContracts from './pages/PurchaseContracts';
import Performance from './pages/Performance';

export default function App() {
  return (
    <BrowserRouter>
      <div style={styles.layout}>
        <nav style={styles.sidebar}>
          <div style={styles.logo}>
            <span style={{ fontSize: 22 }}>📋</span>
            <span>SI 계약 ERP</span>
          </div>
          <NavItem to="/" label="계약 현황" icon="📊" end />
          <NavItem to="/sales" label="매출계약" icon="📈" />
          <NavItem to="/purchase" label="매입계약" icon="📉" />
          <NavItem to="/performance" label="영업 성과" icon="🏆" />
        </nav>
        <main style={styles.main}>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/sales"      element={<SalesContracts />} />
            <Route path="/purchase"   element={<PurchaseContracts />} />
            <Route path="/performance"element={<Performance />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function NavItem({ to, label, icon, end }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      ...styles.navItem,
      background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
      fontWeight: isActive ? 600 : 400,
    })}>
      <span>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

const styles = {
  layout: { display: 'flex', height: '100vh', fontFamily: "'Segoe UI', sans-serif", background: '#f0f4f8' },
  sidebar: { width: 220, background: '#1e3a5f', color: '#fff', display: 'flex', flexDirection: 'column', padding: '0', flexShrink: 0 },
  logo: { padding: '24px 20px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 8 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', color: '#cbd5e1', textDecoration: 'none', borderRadius: 8, margin: '2px 8px', fontSize: 14, transition: 'all 0.15s' },
  main: { flex: 1, overflow: 'auto', padding: 28 },
};

// Global styles
const style = document.createElement('style');
style.textContent = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0f4f8; }
  input, select, textarea { font-family: inherit; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  tr:hover td { background: #f8fafc; }
  button { cursor: pointer; font-family: inherit; }
`;
document.head.appendChild(style);
