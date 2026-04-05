import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { toastSuccess, toastError } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { alertError, alertWarning } from '../components/AlertModal';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import useDebounce from '../hooks/useDebounce';
import { useCurrency } from '../contexts/CurrencyContext';
import AdvancedFilter from '../components/AdvancedFilter';
import ExportButton from '../components/ExportButton';
import CurrencyAmountInput, { toKRW, fromKRW } from '../components/CurrencyAmountInput';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Plus, Download, Pencil, Trash2, X, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const STATUS_OPT   = ['등록', '진행', '종료'];
const STATUS_CLASSES = {
  등록: 'border-blue-500/30 bg-blue-50 text-blue-600',
  진행: 'border-green-500/30 bg-green-50 text-green-600',
  종료: 'border-slate-400/30 bg-slate-50 text-slate-500',
};

const EMPTY = { contract_no: '', contract_name: '', vendor_id: '', vendor_name: '', worker_name: '', monthly_rate: '', months: '', input_currency: 'KRW', input_monthly_rate: '', start_date: '', end_date: '', status: '등록', sales_contract_id: '', notes: '' };

const advFilters = [
  { key: 'start_from', label: '시작일(부터)', type: 'date' },
  { key: 'start_to', label: '시작일(까지)', type: 'date' },
  { key: 'end_from', label: '종료일(부터)', type: 'date' },
  { key: 'end_to', label: '종료일(까지)', type: 'date' },
  { key: 'amount_min', label: '최소 금액', type: 'number', placeholder: '0' },
  { key: 'amount_max', label: '최대 금액', type: 'number', placeholder: '999999999' },
];

export default function PurchaseContracts() {
  const { fmtM, fmtFull } = useCurrency();
  const [list, setList]     = useState([]);
  const [vendors, setVendors] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', search: '' });
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [sort, setSort]     = useState({ key: null, asc: true });
  const [advFilter, setAdvFilter] = useState({});

  const debouncedSearch = useDebounce(filter.search);

  const validate = () => {
    const e = {};
    if (!form.contract_no.trim())    e.contract_no    = '계약번호를 입력하세요.';
    if (!form.contract_name.trim())  e.contract_name  = '계약명을 입력하세요.';
    if (!form.vendor_id)              e.vendor_name    = '외주업체를 선택하세요.';
    if (!form.input_monthly_rate || Number(form.input_monthly_rate) <= 0) e.monthly_rate = '월단가를 올바르게 입력하세요.';
    if (!form.months || Number(form.months) <= 0) e.months = '개월수를 올바르게 입력하세요.';
    if (!form.start_date) e.start_date = '시작일을 선택하세요.';
    if (!form.end_date)   e.end_date   = '종료일을 선택하세요.';
    if (form.start_date && form.end_date && form.start_date > form.end_date) e.end_date = '종료일이 시작일보다 빠릅니다.';
    if (!form.sales_contract_id) e.sales_contract_id = '연결 매출계약을 선택하세요.';
    return e;
  };

  const load = useCallback(() => {
    setLoading(true); setError('');
    const params = { ...advFilter };
    if (filter.status !== 'all') params.status = filter.status;
    if (debouncedSearch) params.search = debouncedSearch;
    api.getPurchaseContracts(params)
      .then(data => {
        setList(data);
        if (data.length === 0 && filter.status === 'all' && !debouncedSearch) {
          alertWarning('매입계약 데이터 없음', '등록된 매입계약이 없습니다.\n새 계약을 등록해주세요.');
        }
      })
      .catch(e => {
        setError(e.message);
        alertError('매입계약 로드 실패', `매입계약 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [filter.status, debouncedSearch, advFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getSalesContracts().then(setSalesList); }, []);
  useEffect(() => { api.getClients().then(data => setVendors((Array.isArray(data) ? data : (data.rows || [])).filter(c => c.type === '협력사'))); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && modal) setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const calcAmount = () => {
    const krwRate = toKRW(form.input_monthly_rate, form.input_currency);
    return (krwRate * Number(form.months)) || 0;
  };

  const openCreate = () => { setForm(EMPTY); setFormErrors({}); setModal({ mode: 'create' }); };
  const openEdit   = (row) => {
    const cur = row.currency || 'KRW';
    const origRate = row.original_monthly_rate ? Number(row.original_monthly_rate) : fromKRW(row.monthly_rate, cur);
    setForm({ ...row, start_date: row.start_date?.slice(0,10), end_date: row.end_date?.slice(0,10), input_currency: cur, input_monthly_rate: cur === 'KRW' ? row.monthly_rate : origRate });
    setFormErrors({}); setModal({ mode: 'edit', id: row.id });
  };

  const handleSave = async () => {
    const errs = validate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toastError('필수 항목을 확인해주세요.'); return; }
    setSaving(true);
    try {
      const krwRate = Math.round(toKRW(form.input_monthly_rate, form.input_currency));
      const payload = {
        ...form,
        monthly_rate: krwRate,
        currency: form.input_currency,
        original_monthly_rate: Number(form.input_monthly_rate),
      };
      if (modal.mode === 'create') { await api.createPurchase(payload); toastSuccess('매입계약이 등록되었습니다.'); }
      else { await api.updatePurchase(modal.id, payload); toastSuccess('매입계약이 수정되었습니다.'); }
      setModal(null); load();
    } catch(e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirmDialog({ title: '계약 삭제', message: `"${name}" 매입계약을 삭제하시겠습니까?`, confirmText: '삭제', danger: true });
    if (!ok) return;
    try { await api.deletePurchase(id); toastSuccess('계약이 삭제되었습니다.'); load(); }
    catch(e) { toastError(e.message); }
  };

  const toggleSort = (key) => setSort(prev => ({ key, asc: prev.key === key ? !prev.asc : true }));
  const sorted = [...list].sort((a, b) => {
    if (!sort.key) return 0;
    let va = a[sort.key], vb = b[sort.key];
    if (typeof va === 'string') return sort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sort.asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
  });

  const SortHead = ({ k, children, className }) => (
    <TableHead
      className={cn('cursor-pointer select-none', className)}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.key === k ? (
          sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-slate-300" />
        )}
      </span>
    </TableHead>
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">매입계약 관리</h1>
          {!loading && <span className="text-[13px] text-slate-400">총 {list.length}건</span>}
        </div>
        <div className="flex gap-2">
          <ExportButton type="purchase-contracts" />
          <Button variant="secondary" onClick={() => exportCSV(list)}>
            <Download className="mr-1.5 h-4 w-4" />
            CSV 내보내기
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            계약 등록
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs value={filter.status} onValueChange={v => setFilter(f => ({ ...f, status: v }))}>
          <TabsList>
            {['all', ...STATUS_OPT].map(v => (
              <TabsTrigger key={v} value={v}>
                {v === 'all' ? '전체' : v}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative">
          <Input
            className="w-[250px] text-[13px]"
            placeholder="계약명, 업체명, 인력명 검색..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
          {filter.search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setFilter(f => ({ ...f, search: '' }))}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <AdvancedFilter filters={advFilters} values={advFilter} onChange={setAdvFilter} />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <Card>
        <CardContent className="p-6">
          {loading ? <Spinner /> : sorted.length === 0 ? (
            <EmptyState icon="📉" title="매입계약 데이터가 없습니다"
              description={filter.status !== 'all' || filter.search ? '검색 조건에 맞는 계약이 없습니다.' : '첫 매입계약을 등록해보세요.'}
              action={!filter.search ? '+ 계약 등록' : undefined} onAction={!filter.search ? openCreate : undefined} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="contract_no">계약번호</SortHead>
                  <SortHead k="contract_name">계약명</SortHead>
                  <SortHead k="vendor_name">외주업체</SortHead>
                  <TableHead>투입인력</TableHead>
                  <SortHead k="monthly_rate" className="text-right">월단가</SortHead>
                  <TableHead className="text-right">개월</TableHead>
                  <SortHead k="amount" className="text-right">계약금액</SortHead>
                  <TableHead>연결 매출계약</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-slate-500 text-[13px]">{r.contract_no}</TableCell>
                    <TableCell className="font-medium">{r.contract_name}</TableCell>
                    <TableCell>{r.vendor_name}</TableCell>
                    <TableCell>{r.worker_name || <span className="text-slate-400">-</span>}</TableCell>
                    <TableCell className="text-right" title={fmtFull(r.monthly_rate)}>{Number(r.monthly_rate).toLocaleString()}원</TableCell>
                    <TableCell className="text-right">{r.months}개월</TableCell>
                    <TableCell className="text-right text-red-600 font-medium" title={fmtFull(r.amount)}>{fmtM(r.amount)}</TableCell>
                    <TableCell className="text-xs text-blue-600 font-medium hover:text-blue-800 transition-colors duration-150">{r.linked_sales_name || '-'}</TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{r.start_date?.slice(0,10)} ~ {r.end_date?.slice(0,10)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASSES[r.status]}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          수정
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(r.id, r.contract_name)}>
                          <Trash2 className="mr-1 h-3 w-3" />
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {modal && (
        <Modal title={modal.mode === 'create' ? '매입계약 등록' : '매입계약 수정'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="계약번호 *" error={formErrors.contract_no}>
              <Input className={cn(formErrors.contract_no && 'border-red-300 bg-red-50')} value={form.contract_no} onChange={e => setForm(f => ({ ...f, contract_no: e.target.value }))} placeholder="PC-2025-001" />
            </Field>
            <Field label="계약명 *" error={formErrors.contract_name}>
              <Input className={cn(formErrors.contract_name && 'border-red-300 bg-red-50')} value={form.contract_name} onChange={e => setForm(f => ({ ...f, contract_name: e.target.value }))} />
            </Field>
            <Field label="외주업체명 *" error={formErrors.vendor_name}>
              <select
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  formErrors.vendor_name && 'border-red-300 bg-red-50'
                )}
                value={form.vendor_id || ''}
                onChange={e => { const v = vendors.find(vn => String(vn.id) === e.target.value); setForm(f => ({ ...f, vendor_id: e.target.value, vendor_name: v ? v.name : '' })); }}
              >
                <option value="">외주업체 선택</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="투입인력명">
              <Input value={form.worker_name} onChange={e => setForm(f => ({ ...f, worker_name: e.target.value }))} />
            </Field>
            <Field label="월단가 *" error={formErrors.monthly_rate}>
              <CurrencyAmountInput
                currency={form.input_currency}
                onCurrencyChange={c => setForm(f => ({ ...f, input_currency: c }))}
                value={form.input_monthly_rate}
                onValueChange={v => setForm(f => ({ ...f, input_monthly_rate: v }))}
                error={!!formErrors.monthly_rate}
                placeholder="월단가 입력"
              />
            </Field>
            <Field label="투입 개월수 *" error={formErrors.months}>
              <Input className={cn(formErrors.months && 'border-red-300 bg-red-50')} type="number" value={form.months} onChange={e => setForm(f => ({ ...f, months: e.target.value }))} placeholder="6" />
            </Field>
            <Field label="계약금액 (자동계산)" full>
              <div className="px-3 py-2 bg-green-50 rounded-lg text-green-600 font-bold text-base">
                {fmtFull(calcAmount())}
              </div>
            </Field>
            <Field label="시작일 *" error={formErrors.start_date}>
              <Input className={cn(formErrors.start_date && 'border-red-300 bg-red-50')} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </Field>
            <Field label="종료일 *" error={formErrors.end_date}>
              <Input className={cn(formErrors.end_date && 'border-red-300 bg-red-50')} type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </Field>
            <Field label="연결 매출계약 *" full error={formErrors.sales_contract_id}>
              <select
                className={cn(
                  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  formErrors.sales_contract_id && 'border-red-300 bg-red-50'
                )}
                value={form.sales_contract_id}
                onChange={e => setForm(f => ({ ...f, sales_contract_id: e.target.value }))}
              >
                <option value="">매출계약 선택</option>
                {salesList.map(sc => <option key={sc.id} value={sc.id}>[{sc.status}] {sc.contract_name} ({sc.client_name})</option>)}
              </select>
            </Field>
            <Field label="상태">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPT.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="비고" full>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[60px]"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={() => setModal(null)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
}

function exportCSV(list) {
  const headers = ['계약번호', '계약명', '외주업체', '투입인력', '월단가', '개월', '계약금액', '연결매출계약', '시작일', '종료일', '상태'];
  const rows = list.map(r => [r.contract_no, r.contract_name, r.vendor_name, r.worker_name || '', r.monthly_rate, r.months, r.amount, r.sales_contract_name || '', r.start_date?.slice(0,10), r.end_date?.slice(0,10), r.status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `매입계약_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-7 w-[600px] max-h-[90vh] overflow-auto shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, full, error }) {
  return (
    <div className={full ? 'col-span-2' : 'col-span-1'}>
      <label className={cn('block text-xs font-semibold mb-1', error ? 'text-red-600' : 'text-slate-600')}>
        {label}
      </label>
      {children}
      {error && <div className="text-[11px] text-red-600 mt-0.5">{error}</div>}
    </div>
  );
}
