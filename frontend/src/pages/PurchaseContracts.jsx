import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const STATUS_OPT   = ['등록', '진행', '종료'];
const STATUS_COLOR = { 등록: '#3b82f6', 진행: '#16a34a', 종료: '#94a3b8' };
const STATUS_BG    = { 등록: '#eff6ff', 진행: '#f0fdf4', 종료: '#f8fafc' };

const fmtM = (n) => {
  const v = Number(n || 0);
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '억원';
  if (v >= 10000)     return Math.round(v / 10000) + '만원';
  return v.toLocaleString() + '원';
};

const EMPTY = { contract_no: '', contract_name: '', vendor_name: '', worker_name: '', monthly_rate: '', months: '', start_date: '', end_date: '', status: '등록', sales_contract_id: '', notes: '' };

export default function PurchaseContracts() {
  const [list, setList]     = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', search: '' });
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getPurchaseContracts(filter.status !== 'all' || filter.search ? { status: filter.status !== 'all' ? filter.status : undefined, search: filter.search || undefined } : {})
      .then(setList).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getSalesContracts().then(setSalesList); }, []);

  const calcAmount = () => (Number(form.monthly_rate) * Number(form.months)) || 0;

  const openCreate = () => { setForm(EMPTY); setModal({ mode: 'create' }); };
  const openEdit   = (row) => {
    setForm({ ...row, start_date: row.start_date?.slice(0,10), end_date: row.end_date?.slice(0,10) });
    setModal({ mode: 'edit', id: row.id });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.mode === 'create') await api.createPurchase(form);
      else await api.updatePurchase(modal.id, form);
      setModal(null); load();
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`"${name}" 계약을 삭제하시겠습니까?`)) return;
    try { await api.deletePurchase(id); load(); }
    catch(e) { alert(e.message); }
  };

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>매입계약 관리</h1>
        <button style={s.btnPrimary} onClick={openCreate}>+ 계약 등록</button>
      </div>

      {/* 필터 */}
      <div style={s.filterRow}>
        <div style={s.tabs}>
          {['all', ...STATUS_OPT].map(v => (
            <button key={v} style={{ ...s.tab, ...(filter.status === v ? s.tabActive : {}) }}
              onClick={() => setFilter(f => ({ ...f, status: v }))}>
              {v === 'all' ? '전체' : v}
            </button>
          ))}
        </div>
        <input style={s.search} placeholder="계약명, 업체명, 인력명 검색..."
          value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
      </div>

      {/* 테이블 */}
      <div style={s.card}>
        {loading ? <div style={s.center}>로딩 중...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>계약번호</th><th>계약명</th><th>외주업체</th><th>투입인력</th>
                  <th style={{ textAlign: 'right' }}>월단가</th><th>개월</th>
                  <th style={{ textAlign: 'right' }}>계약금액</th>
                  <th>연결 매출계약</th><th>기간</th><th>상태</th><th>관리</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{r.contract_no}</td>
                    <td style={{ fontWeight: 500 }}>{r.contract_name}</td>
                    <td>{r.vendor_name}</td>
                    <td>{r.worker_name || <span style={{ color: '#94a3b8' }}>-</span>}</td>
                    <td style={{ textAlign: 'right' }}>{Number(r.monthly_rate).toLocaleString()}원</td>
                    <td style={{ textAlign: 'right' }}>{r.months}개월</td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>{fmtM(r.amount)}</td>
                    <td style={{ fontSize: 12, color: '#2563eb' }}>{r.linked_sales_name || '-'}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{r.start_date?.slice(0,10)} ~ {r.end_date?.slice(0,10)}</td>
                    <td><Badge label={r.status} color={STATUS_COLOR[r.status]} bg={STATUS_BG[r.status]} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={s.btnSm} onClick={() => openEdit(r)}>수정</button>
                        <button style={{ ...s.btnSm, ...s.btnDanger }} onClick={() => handleDelete(r.id, r.contract_name)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>데이터가 없습니다</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {modal && (
        <Modal title={modal.mode === 'create' ? '매입계약 등록' : '매입계약 수정'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="계약번호 *"><input style={s.input} value={form.contract_no} onChange={e => setForm(f => ({ ...f, contract_no: e.target.value }))} placeholder="PC-2025-001" /></Field>
            <Field label="계약명 *"><input style={s.input} value={form.contract_name} onChange={e => setForm(f => ({ ...f, contract_name: e.target.value }))} /></Field>
            <Field label="외주업체명 *"><input style={s.input} value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} /></Field>
            <Field label="투입인력명"><input style={s.input} value={form.worker_name} onChange={e => setForm(f => ({ ...f, worker_name: e.target.value }))} /></Field>
            <Field label="월단가 (원) *">
              <input style={s.input} type="number" value={form.monthly_rate} onChange={e => setForm(f => ({ ...f, monthly_rate: e.target.value }))} placeholder="7000000" />
            </Field>
            <Field label="투입 개월수 *">
              <input style={s.input} type="number" value={form.months} onChange={e => setForm(f => ({ ...f, months: e.target.value }))} placeholder="6" />
            </Field>
            <Field label="계약금액 (자동계산)" full>
              <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, color: '#16a34a', fontWeight: 700, fontSize: 16 }}>
                {fmtM(calcAmount())}
              </div>
            </Field>
            <Field label="시작일 *"><input style={s.input} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></Field>
            <Field label="종료일 *"><input style={s.input} type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></Field>
            <Field label="연결 매출계약 *" full>
              <select style={s.input} value={form.sales_contract_id} onChange={e => setForm(f => ({ ...f, sales_contract_id: e.target.value }))}>
                <option value="">매출계약 선택</option>
                {salesList.map(sc => <option key={sc.id} value={sc.id}>[{sc.status}] {sc.contract_name} ({sc.client_name})</option>)}
              </select>
            </Field>
            <Field label="상태">
              <select style={s.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPT.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="비고" full><textarea style={{ ...s.input, resize: 'vertical', minHeight: 60 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button style={s.btnSecondary} onClick={() => setModal(null)}>취소</button>
            <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Badge({ label, color, bg }) {
  return <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${color}33` }}>{label}</span>;
}
function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? 'span 2' : 'span 1' }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, color: '#1e293b' },
  btnPrimary: { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 },
  btnSecondary: { padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500 },
  btnSm: { padding: '4px 10px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  btnDanger: { background: '#fef2f2', color: '#dc2626' },
  filterRow: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' },
  tabs: { display: 'flex', background: '#fff', borderRadius: 8, padding: 4, gap: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  tab: { padding: '6px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, background: 'transparent', color: '#64748b' },
  tabActive: { background: '#2563eb', color: '#fff', fontWeight: 600 },
  search: { padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 250 },
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' },
  center: { textAlign: 'center', padding: 40, color: '#94a3b8' },
};
