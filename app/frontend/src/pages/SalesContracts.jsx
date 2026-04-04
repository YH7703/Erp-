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
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Search, Plus, Download, X, Edit2, Trash2, Eye, ArrowUpDown, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

const STATUS_OPT = ['등록', '진행', '종료'];
const TYPE_OPT   = ['신규개발', '유지보수', '컨설팅'];

const STATUS_VARIANT = { 등록: 'default', 진행: 'success', 종료: 'secondary' };
const TYPE_COLORS = { 신규개발: 'text-violet-600', 유지보수: 'text-cyan-600', 컨설팅: 'text-amber-600' };

const daysLeft = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

const EMPTY = { contract_no: '', contract_name: '', client_id: '', client_name: '', amount: '', input_currency: 'KRW', input_amount: '', start_date: '', end_date: '', status: '등록', project_type: '신규개발', salesperson_id: '', notes: '' };

const advFilters = [
  { key: 'project_type', label: '프로젝트유형', type: 'select', options: [{value:'신규개발',label:'신규개발'},{value:'유지보수',label:'유지보수'},{value:'컨설팅',label:'컨설팅'}] },
  { key: 'start_from', label: '시작일(부터)', type: 'date' },
  { key: 'start_to', label: '시작일(까지)', type: 'date' },
  { key: 'end_from', label: '종료일(부터)', type: 'date' },
  { key: 'end_to', label: '종료일(까지)', type: 'date' },
  { key: 'amount_min', label: '최소 금액', type: 'number', placeholder: '0' },
  { key: 'amount_max', label: '최대 금액', type: 'number', placeholder: '999999999' },
];

export default function SalesContracts() {
  const { fmtM, fmtFull } = useCurrency();
  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', search: '', salesperson_id: '' });
  const [advFilter, setAdvFilter] = useState({});
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [sort, setSort] = useState({ key: null, asc: true });

  const debouncedSearch = useDebounce(filter.search);

  const load = useCallback(() => {
    setLoading(true); setError('');
    const params = { ...advFilter };
    if (filter.status !== 'all') params.status = filter.status;
    if (debouncedSearch) params.search = debouncedSearch;
    if (filter.salesperson_id) params.salesperson_id = filter.salesperson_id;
    api.getSalesContracts(params)
      .then(data => {
        setList(data);
        if (data.length === 0 && filter.status === 'all' && !debouncedSearch && !filter.salesperson_id) {
          alertWarning('매출계약 데이터 없음', '등록된 매출계약이 없습니다.\n새 계약을 등록해주세요.');
        }
      })
      .catch(e => {
        setError(e.message);
        alertError('매출계약 로드 실패', `매출계약 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [filter.status, debouncedSearch, filter.salesperson_id, advFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getSalespeople().then(setPeople); }, []);
  useEffect(() => { api.getClients().then(data => setClients((Array.isArray(data) ? data : (data.rows || [])).filter(c => c.type !== '협력사'))); }, []);

  // ESC로 모달 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && modal) setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const validate = () => {
    const e = {};
    if (!form.contract_no.trim())    e.contract_no    = '계약번호를 입력하세요.';
    if (!form.contract_name.trim())  e.contract_name  = '계약명을 입력하세요.';
    if (!form.client_id)              e.client_name    = '고객사를 선택하세요.';
    if (!form.input_amount || Number(form.input_amount) <= 0) e.amount = '계약금액을 올바르게 입력하세요.';
    if (!form.start_date)            e.start_date     = '시작일을 선택하세요.';
    if (!form.end_date)              e.end_date       = '종료일을 선택하세요.';
    if (form.start_date && form.end_date && form.start_date > form.end_date) e.end_date = '종료일이 시작일보다 빠릅니다.';
    if (!form.salesperson_id)        e.salesperson_id = '담당 영업사원을 선택하세요.';
    return e;
  };

  const openCreate = () => { setForm(EMPTY); setFormErrors({}); setModal({ mode: 'create' }); };
  const openEdit   = (row) => {
    const cur = row.currency || 'KRW';
    const origAmt = row.original_amount ? Number(row.original_amount) : fromKRW(row.amount, cur);
    setForm({ ...row, start_date: row.start_date?.slice(0,10), end_date: row.end_date?.slice(0,10), input_currency: cur, input_amount: cur === 'KRW' ? row.amount : origAmt });
    setFormErrors({}); setModal({ mode: 'edit', id: row.id });
  };
  const openDetail = async (id) => {
    try { const d = await api.getSalesContract(id); setDetail(d); setModal({ mode: 'detail' }); }
    catch(e) { toastError(e.message); }
  };

  const handleSave = async () => {
    const errs = validate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toastError('필수 항목을 확인해주세요.'); return; }
    setSaving(true);
    try {
      const krwAmount = toKRW(form.input_amount, form.input_currency);
      const payload = {
        ...form,
        amount: Math.round(krwAmount),
        currency: form.input_currency,
        original_amount: Number(form.input_amount),
      };
      if (modal.mode === 'create') { await api.createSales(payload); toastSuccess('매출계약이 등록되었습니다.'); }
      else { await api.updateSales(modal.id, payload); toastSuccess('매출계약이 수정되었습니다.'); }
      setModal(null); load();
    } catch(e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirmDialog({ title: '계약 삭제', message: `"${name}" 계약을 삭제하시겠습니까?\n연결된 매입계약이 있으면 삭제할 수 없습니다.`, confirmText: '삭제', danger: true });
    if (!ok) return;
    try { await api.deleteSales(id); toastSuccess('계약이 삭제되었습니다.'); load(); }
    catch(e) { toastError(e.message); }
  };

  // 정렬
  const toggleSort = (key) => setSort(prev => ({ key, asc: prev.key === key ? !prev.asc : true }));
  const sorted = [...list].sort((a, b) => {
    if (!sort.key) return 0;
    let va = a[sort.key], vb = b[sort.key];
    if (typeof va === 'string') return sort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sort.asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
  });

  const SortTh = ({ k, children, right }) => (
    <TableHead
      className={cn('cursor-pointer select-none', right && 'text-right')}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.key === k
          ? (sort.asc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
          : <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />}
      </span>
    </TableHead>
  );

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">매출계약 관리</h1>
          {!loading && <span className="text-[13px] text-slate-400">총 {list.length}건</span>}
        </div>
        <div className="flex gap-2">
          <ExportButton type="sales-contracts" />
          <Button variant="secondary" onClick={() => exportCSV(list)}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV 내보내기
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            계약 등록
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <Tabs value={filter.status} onValueChange={v => setFilter(f => ({ ...f, status: v }))}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            {STATUS_OPT.map(v => (
              <TabsTrigger key={v} value={v}>{v}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 w-[250px]"
            placeholder="계약명, 고객사 검색..."
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
        <Select
          className="w-[150px]"
          value={filter.salesperson_id}
          onChange={e => setFilter(f => ({ ...f, salesperson_id: e.target.value }))}
        >
          <option value="">전체 담당자</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      <AdvancedFilter filters={advFilters} values={advFilter} onChange={setAdvFilter} />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* 테이블 */}
      <Card>
        <CardContent className="p-6">
          {loading ? <Spinner /> : sorted.length === 0 ? (
            <EmptyState icon="📈" title="매출계약 데이터가 없습니다"
              description={filter.status !== 'all' || filter.search ? '검색 조건에 맞는 계약이 없습니다. 필터를 변경해보세요.' : '첫 매출계약을 등록해보세요.'}
              action={!filter.search ? '+ 계약 등록' : undefined} onAction={!filter.search ? openCreate : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortTh k="contract_no">계약번호</SortTh>
                    <SortTh k="contract_name">계약명</SortTh>
                    <SortTh k="client_name">고객사</SortTh>
                    <TableHead>유형</TableHead>
                    <SortTh k="amount" right>매출금액</SortTh>
                    <SortTh k="total_purchase" right>매입금액</SortTh>
                    <SortTh k="roi" right>ROI</SortTh>
                    <SortTh k="start_date">기간</SortTh>
                    <TableHead>담당자</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-slate-500 text-[13px]">{r.contract_no}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <button
                            className="bg-transparent border-none text-blue-600 font-medium cursor-pointer underline underline-offset-2 text-sm"
                            onClick={() => openDetail(r.id)}
                          >
                            {r.contract_name}
                          </button>
                          {r.status !== '종료' && daysLeft(r.end_date) <= 30 && daysLeft(r.end_date) >= 0 && (
                            <span className={cn(
                              'text-[11px] font-bold px-1.5 py-px rounded-full',
                              daysLeft(r.end_date) <= 7
                                ? 'bg-red-50 text-red-600'
                                : 'bg-orange-50 text-orange-600'
                            )}>
                              D-{daysLeft(r.end_date)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{r.client_name}</TableCell>
                      <TableCell>
                        <span className={cn('text-xs', TYPE_COLORS[r.project_type] || 'text-slate-500')}>
                          {r.project_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-medium" title={fmtFull(r.amount)}>{fmtM(r.amount)}</TableCell>
                      <TableCell className="text-right text-red-600" title={fmtFull(r.total_purchase)}>{fmtM(r.total_purchase)}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'font-semibold',
                          r.roi >= 30 ? 'text-green-600' : r.roi >= 0 ? 'text-amber-500' : 'text-red-600'
                        )}>
                          {r.roi}%
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{r.start_date?.slice(0,10)} ~ {r.end_date?.slice(0,10)}</TableCell>
                      <TableCell>{r.salesperson_name}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            수정
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(r.id, r.contract_name)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            삭제
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 등록/수정 모달 */}
      {modal && modal.mode !== 'detail' && (
        <Modal title={modal.mode === 'create' ? '매출계약 등록' : '매출계약 수정'} onClose={() => setModal(null)}>
          <FormGrid>
            <Field label="계약번호 *" error={formErrors.contract_no}>
              <Input className={cn(formErrors.contract_no && 'border-red-300 bg-red-50')} value={form.contract_no} onChange={e => setForm(f => ({ ...f, contract_no: e.target.value }))} placeholder="SC-2025-001" />
            </Field>
            <Field label="계약명 *" error={formErrors.contract_name}>
              <Input className={cn(formErrors.contract_name && 'border-red-300 bg-red-50')} value={form.contract_name} onChange={e => setForm(f => ({ ...f, contract_name: e.target.value }))} />
            </Field>
            <Field label="고객사 *" error={formErrors.client_name}>
              <Select className={cn(formErrors.client_name && 'border-red-300 bg-red-50')} value={form.client_id || ''} onChange={e => { const c = clients.find(cl => String(cl.id) === e.target.value); setForm(f => ({ ...f, client_id: e.target.value, client_name: c ? c.name : '' })); }}>
                <option value="">고객사 선택</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="계약금액 *" error={formErrors.amount}>
              <CurrencyAmountInput
                currency={form.input_currency}
                onCurrencyChange={c => setForm(f => ({ ...f, input_currency: c }))}
                value={form.input_amount}
                onValueChange={v => setForm(f => ({ ...f, input_amount: v }))}
                error={!!formErrors.amount}
                placeholder="금액 입력"
              />
            </Field>
            <Field label="시작일 *" error={formErrors.start_date}>
              <Input type="date" className={cn(formErrors.start_date && 'border-red-300 bg-red-50')} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </Field>
            <Field label="종료일 *" error={formErrors.end_date}>
              <Input type="date" className={cn(formErrors.end_date && 'border-red-300 bg-red-50')} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </Field>
            <Field label="프로젝트 유형 *">
              <Select value={form.project_type} onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}>
                {TYPE_OPT.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="담당 영업사원 *" error={formErrors.salesperson_id}>
              <Select className={cn(formErrors.salesperson_id && 'border-red-300 bg-red-50')} value={form.salesperson_id} onChange={e => setForm(f => ({ ...f, salesperson_id: e.target.value }))}>
                <option value="">선택</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.department})</option>)}
              </Select>
            </Field>
            <Field label="상태">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPT.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="비고" full>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] outline-none transition-colors focus:border-blue-400 resize-y min-h-[60px]"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </FormGrid>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={() => setModal(null)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </Modal>
      )}

      {/* 상세 모달 */}
      {modal?.mode === 'detail' && detail && (
        <Modal title="매출계약 상세" onClose={() => setModal(null)} wide>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <InfoRow label="계약번호" value={detail.contract_no} />
            <InfoRow label="계약명" value={detail.contract_name} />
            <InfoRow label="고객사" value={detail.client_name} />
            <InfoRow label="담당자" value={detail.salesperson_name} />
            <InfoRow label="매출금액" value={fmtFull(detail.amount)} />
            <InfoRow label="매입합계" value={fmtFull(detail.total_purchase)} />
            <InfoRow label="순이익" value={fmtFull(detail.net_profit)} color={Number(detail.net_profit) < 0 ? 'text-red-600' : 'text-green-600'} />
            <InfoRow label="ROI" value={`${detail.roi}%`} color={detail.roi < 0 ? 'text-red-600' : undefined} />
            <InfoRow label="기간" value={`${detail.start_date?.slice(0,10)} ~ ${detail.end_date?.slice(0,10)}`} />
            <InfoRow label="상태" value={<Badge variant={STATUS_VARIANT[detail.status]}>{detail.status}</Badge>} />
          </div>
          {Number(detail.total_purchase) > Number(detail.amount) && (
            <div className="bg-red-50 border border-red-300 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-red-600 font-semibold">
              ⚠️ 매입금액이 매출금액을 초과했습니다. (초과: {fmtFull(Number(detail.total_purchase) - Number(detail.amount))})
            </div>
          )}
          <h3 className="text-sm font-semibold text-slate-600 mb-2.5">연결된 매입계약 ({detail.purchase_contracts?.length}건)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>계약명</TableHead>
                <TableHead>외주업체</TableHead>
                <TableHead>투입인력</TableHead>
                <TableHead className="text-right">월단가</TableHead>
                <TableHead>개월</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.purchase_contracts?.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.contract_name}</TableCell>
                  <TableCell>{p.vendor_name}</TableCell>
                  <TableCell>{p.worker_name || '-'}</TableCell>
                  <TableCell className="text-right">{Number(p.monthly_rate).toLocaleString()}원</TableCell>
                  <TableCell className="text-right">{p.months}개월</TableCell>
                  <TableCell className="text-right text-red-600">{fmtM(p.amount)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!detail.purchase_contracts?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">연결된 매입계약 없음</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
  const headers = ['계약번호', '계약명', '고객사', '유형', '매출금액', '매입금액', 'ROI', '시작일', '종료일', '담당자', '상태'];
  const rows = list.map(r => [r.contract_no, r.contract_name, r.client_name, r.project_type, r.amount, r.total_purchase, r.roi, r.start_date?.slice(0,10), r.end_date?.slice(0,10), r.salesperson_name, r.status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `매출계약_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white rounded-xl p-7 max-h-[90vh] overflow-auto shadow-2xl animate-in zoom-in-95 duration-150',
          wide ? 'w-[800px]' : 'w-[560px]'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormGrid({ children }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
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

function InfoRow({ label, value, color }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3.5 py-2.5">
      <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
      <div className={cn('font-medium', color || 'text-slate-800')}>{value}</div>
    </div>
  );
}
