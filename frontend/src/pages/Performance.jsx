import { useEffect, useState } from 'react';
import { api } from '../api';

const fmtM = (n) => {
  const v = Number(n || 0);
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '억';
  if (v >= 10000)     return Math.round(v / 10000) + '만';
  return v.toLocaleString();
};

const STATUS_COLOR = { 등록: '#3b82f6', 진행: '#16a34a', 종료: '#94a3b8' };
const STATUS_BG    = { 등록: '#eff6ff', 진행: '#f0fdf4', 종료: '#f8fafc' };

export default function Performance() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState({ start: '', end: '' });
  const [selected, setSelected] = useState(null);   // { person, contracts }
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.getPerformance({ start: period.start || undefined, end: period.end || undefined })
      .then(setList).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    setDetailLoading(true);
    const d = await api.getPersonPerf(id, { start: period.start || undefined, end: period.end || undefined });
    setSelected(d);
    setDetailLoading(false);
  };

  const maxSales = Math.max(...list.map(r => Number(r.total_sales)), 1);

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>영업사원 성과</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input style={s.dateInput} type="date" value={period.start} onChange={e => setPeriod(p => ({ ...p, start: e.target.value }))} />
          <span style={{ color: '#94a3b8' }}>~</span>
          <input style={s.dateInput} type="date" value={period.end} onChange={e => setPeriod(p => ({ ...p, end: e.target.value }))} />
          <button style={s.btnPrimary} onClick={load}>조회</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        {/* 성과 테이블 */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>영업사원별 성과 비교</h2>
          {loading ? <div style={s.center}>로딩 중...</div> : (
            <table>
              <thead>
                <tr>
                  <th>순위</th><th>영업사원</th><th>부서</th>
                  <th style={{ textAlign: 'right' }}>수주건수</th>
                  <th style={{ textAlign: 'right' }}>매출금액</th>
                  <th style={{ textAlign: 'right' }}>매입금액</th>
                  <th style={{ textAlign: 'right' }}>순이익</th>
                  <th>ROI</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.id} style={selected?.person?.id === r.id ? { background: '#eff6ff' } : {}}>
                    <td>
                      <RankBadge rank={i + 1} />
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{r.department || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{r.contract_count}건</td>
                    <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 500 }}>{fmtM(r.total_sales)}원</td>
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmtM(r.total_purchase)}원</td>
                    <td style={{ textAlign: 'right', color: Number(r.net_profit) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {fmtM(r.net_profit)}원
                    </td>
                    <td>
                      <RoiBar value={Number(r.roi)} />
                    </td>
                    <td>
                      <button style={s.btnSm} onClick={() => openDetail(r.id)}>상세</button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>데이터가 없습니다</td></tr>}
              </tbody>
            </table>
          )}

          {/* 매출 바 차트 */}
          {list.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 12 }}>매출 비교</h3>
              {list.map(r => (
                <div key={r.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</span>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{fmtM(r.total_sales)}원</span>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(Number(r.total_sales) / maxSales) * 100}%`, background: '#2563eb', borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 개인 상세 */}
        {selected && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={s.cardTitle}>{selected.person.name} 상세</h2>
              <button style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }} onClick={() => setSelected(null)}>✕</button>
            </div>

            {detailLoading ? <div style={s.center}>로딩 중...</div> : (
              <>
                {/* 개인 KPI */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <MiniKpi label="수주건수" value={`${selected.contracts.length}건`} />
                  <MiniKpi label="총매출" value={`${fmtM(selected.contracts.reduce((a,c) => a + Number(c.amount), 0))}원`} color="#2563eb" />
                  <MiniKpi label="총매입" value={`${fmtM(selected.contracts.reduce((a,c) => a + Number(c.total_purchase), 0))}원`} color="#dc2626" />
                  <MiniKpi
                    label="순이익"
                    value={`${fmtM(selected.contracts.reduce((a,c) => a + Number(c.net_profit), 0))}원`}
                    color="#16a34a"
                  />
                </div>

                {/* 계약 목록 */}
                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>담당 계약</h3>
                {selected.contracts.map(c => (
                  <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{c.contract_name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{c.client_name}</div>
                      </div>
                      <Badge label={c.status} color={STATUS_COLOR[c.status]} bg={STATUS_BG[c.status]} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>매출</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>{fmtM(c.amount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>매입</div>
                        <div style={{ fontSize: 12, color: '#dc2626' }}>{fmtM(c.total_purchase)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>ROI</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: Number(c.roi) >= 30 ? '#16a34a' : '#f59e0b' }}>{c.roi}%</div>
                      </div>
                    </div>
                  </div>
                ))}
                {selected.contracts.length === 0 && <div style={s.center}>담당 계약이 없습니다</div>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  const bg = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7c2b' : '#e2e8f0';
  const color = rank <= 3 ? '#fff' : '#64748b';
  return <span style={{ width: 24, height: 24, borderRadius: '50%', background: bg, color, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{rank}</span>;
}

function RoiBar({ value }) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = value >= 50 ? '#16a34a' : value >= 20 ? '#f59e0b' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 70, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${clamped}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36 }}>{value}%</span>
    </div>
  );
}

function MiniKpi({ label, value, color }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: color || '#1e293b', fontSize: 14 }}>{value}</div>
    </div>
  );
}

function Badge({ label, color, bg }) {
  return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, color, background: bg }}>{label}</span>;
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 700, color: '#1e293b' },
  btnPrimary: { padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSm: { padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500 },
  dateInput: { padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 16 },
  center: { textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 },
};
