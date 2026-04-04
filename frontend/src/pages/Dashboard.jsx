import { useEffect, useState } from 'react';
import { api } from '../api';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
const fmtM = (n) => {
  const v = Number(n || 0);
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '억';
  if (v >= 10000)     return (v / 10000).toFixed(0) + '만';
  return v.toLocaleString();
};

const STATUS_COLOR = { 등록: '#3b82f6', 진행: '#16a34a', 종료: '#94a3b8' };
const STATUS_BG    = { 등록: '#eff6ff', 진행: '#f0fdf4', 종료: '#f8fafc' };
const TYPE_COLOR   = { 신규개발: '#7c3aed', 유지보수: '#0891b2', 컨설팅: '#d97706' };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [roi,   setRoi  ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getStats(), api.getRoi()])
      .then(([s, r]) => { setStats(s); setRoi(r); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={s.center}>로딩 중...</div>;
  if (error)   return <div style={{ ...s.center, color: '#dc2626' }}>DB 연결 오류: {error}</div>;

  const { sales, purchase, net_profit, roi: totalRoi } = stats;

  return (
    <div>
      <h1 style={s.title}>계약 현황 대시보드</h1>

      {/* KPI 카드 */}
      <div style={s.kpiGrid}>
        <KpiCard label="총 매출금액" value={fmtM(sales.total_amount)} sub={`계약 ${sales.total}건`} color="#2563eb" icon="📈" />
        <KpiCard label="총 매입금액" value={fmtM(purchase.total_amount)} sub={`계약 ${purchase.total}건`} color="#dc2626" icon="📉" />
        <KpiCard label="순이익" value={fmtM(net_profit)} sub={net_profit >= 0 ? '흑자' : '적자'} color={net_profit >= 0 ? '#16a34a' : '#dc2626'} icon="💰" />
        <KpiCard label="전체 ROI" value={`${totalRoi}%`} sub="매출 대비 이익률" color="#7c3aed" icon="📊" />
      </div>

      {/* 상태 요약 */}
      <div style={s.statusRow}>
        <StatusBadge label="등록" count={sales.cnt_registered} />
        <StatusBadge label="진행" count={sales.cnt_active} />
        <StatusBadge label="종료" count={sales.cnt_closed} />
      </div>

      {/* 프로젝트별 ROI 테이블 */}
      <div style={s.card}>
        <h2 style={s.cardTitle}>프로젝트별 수익성 현황</h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>계약번호</th>
                <th>프로젝트명</th>
                <th>고객사</th>
                <th>담당자</th>
                <th style={{ textAlign: 'right' }}>매출금액</th>
                <th style={{ textAlign: 'right' }}>매입금액</th>
                <th style={{ textAlign: 'right' }}>순이익</th>
                <th style={{ textAlign: 'right' }}>ROI</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {roi.map(r => (
                <tr key={r.id}>
                  <td style={{ color: '#64748b', fontSize: 13 }}>{r.contract_no}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.contract_name}</div>
                    <div style={{ fontSize: 12, color: TYPE_COLOR[r.project_type] }}>{r.project_type}</div>
                  </td>
                  <td>{r.client_name}</td>
                  <td>{r.salesperson_name}</td>
                  <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 500 }}>{fmtM(r.sales_amount)}</td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtM(r.total_purchase)}</td>
                  <td style={{ textAlign: 'right', color: Number(r.net_profit) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {fmtM(r.net_profit)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <RoiBar value={Number(r.roi)} />
                  </td>
                  <td>
                    <Badge label={r.status} color={STATUS_COLOR[r.status]} bg={STATUS_BG[r.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
        <span style={{ fontSize: 24 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function StatusBadge({ label, count }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <Badge label={label} color={STATUS_COLOR[label]} bg={STATUS_BG[label]} />
      <span style={{ fontSize: 20, fontWeight: 700 }}>{count}건</span>
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${color}33` }}>
      {label}
    </span>
  );
}

function RoiBar({ value }) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = value >= 50 ? '#16a34a' : value >= 20 ? '#f59e0b' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 40 }}>{value}%</span>
    </div>
  );
}

const s = {
  title: { fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 24 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 },
  statusRow: { display: 'flex', gap: 12, marginBottom: 24 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 16 },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, fontSize: 16, color: '#64748b' },
};
