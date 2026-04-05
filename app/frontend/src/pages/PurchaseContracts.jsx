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
import { Plus, Download, Pencil, Trash2, X, Loader2, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';

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
  const [salesDetail, setSalesDetail] = useState(null);
  const [salesDetailLoading, setSalesDetailLoading] = useState(false);
  const [purchaseDetail, setPurchaseDetail] = useState(null);
  const [purchaseDetailLoading, setPurchaseDetailLoading] = useState(false);

  const debouncedSearch = useDebounce(filter.search);

  const validate = () => {
    const e = {};
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
  useEffect(() => { api.getClients().then(data => setVendors((Array.isArray(data) ? data : (data.rows || [])).filter(c => c.client_type === '협력사' || c.client_type === '고객/협력사'))); }, []);

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

  const openPurchaseDetail = async (id) => {
    setPurchaseDetailLoading(true);
    setPurchaseDetail(null);
    try {
      const data = await api.getPurchaseContract(id);
      setPurchaseDetail(data);
    } catch (e) {
      toastError('매입계약 정보를 불러올 수 없습니다.');
    } finally {
      setPurchaseDetailLoading(false);
    }
  };

  const openSalesDetail = async (salesContractId) => {
    if (!salesContractId) return;
    setSalesDetailLoading(true);
    setSalesDetail(null);
    try {
      const data = await api.getSalesContract(salesContractId);
      setSalesDetail(data);
    } catch (e) {
      toastError('매출계약 정보를 불러올 수 없습니다.');
    } finally {
      setSalesDetailLoading(false);
    }
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
                    <TableCell>
                      <button
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-150"
                        onClick={() => openPurchaseDetail(r.id)}
                      >
                        {r.contract_name}
                      </button>
                    </TableCell>
                    <TableCell>{r.vendor_name}</TableCell>
                    <TableCell>{r.worker_name || <span className="text-slate-400">-</span>}</TableCell>
                    <TableCell className="text-right" title={fmtFull(r.monthly_rate)}>{Number(r.monthly_rate).toLocaleString()}원</TableCell>
                    <TableCell className="text-right">{r.months}개월</TableCell>
                    <TableCell className="text-right text-red-600 font-medium" title={fmtFull(r.amount)}>{fmtM(r.amount)}</TableCell>
                    <TableCell>
                      {r.sales_contract_id ? (
                        <button
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-150 inline-flex items-center gap-1"
                          onClick={() => openSalesDetail(r.sales_contract_id)}
                        >
                          {r.linked_sales_name}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : '-'}
                    </TableCell>
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

      {(purchaseDetail || purchaseDetailLoading) && (
        <Modal title="매입계약 상세" onClose={() => setPurchaseDetail(null)}>
          {purchaseDetailLoading ? <Spinner /> : purchaseDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="계약번호" value={purchaseDetail.contract_no} />
                <InfoItem label="계약명" value={purchaseDetail.contract_name} />
                <InfoItem label="외주업체" value={purchaseDetail.vendor_name} />
                <InfoItem label="투입인력" value={purchaseDetail.worker_name || '-'} />
                <InfoItem label="월단가" value={`${Number(purchaseDetail.monthly_rate).toLocaleString()}원`} />
                <InfoItem label="투입 개월수" value={`${purchaseDetail.months}개월`} />
                <InfoItem label="계약금액" value={fmtFull(purchaseDetail.amount)} className="text-red-600 font-bold" />
                <InfoItem label="상태">
                  <Badge variant="outline" className={STATUS_CLASSES[purchaseDetail.status] || ''}>{purchaseDetail.status}</Badge>
                </InfoItem>
                <InfoItem label="계약기간" value={`${purchaseDetail.start_date?.slice(0,10)} ~ ${purchaseDetail.end_date?.slice(0,10)}`} full />
                <InfoItem label="연결 매출계약" full>
                  {purchaseDetail.sales_contract_id ? (
                    <button
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-150 inline-flex items-center gap-1"
                      onClick={() => { setPurchaseDetail(null); openSalesDetail(purchaseDetail.sales_contract_id); }}
                    >
                      {purchaseDetail.linked_sales_name} ({purchaseDetail.client_name})
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  ) : <span className="text-sm text-slate-400">-</span>}
                </InfoItem>
              </div>
              {purchaseDetail.notes && (
                <div className="border-t pt-3">
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">비고</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{purchaseDetail.notes}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setPurchaseDetail(null)}>닫기</Button>
                <Button onClick={() => { setPurchaseDetail(null); openEdit(purchaseDetail); }}>
                  <Pencil className="mr-1 h-3 w-3" />수정
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {(salesDetail || salesDetailLoading) && (
        <Modal title="연결 매출계약 상세" onClose={() => setSalesDetail(null)}>
          {salesDetailLoading ? <Spinner /> : salesDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="계약번호" value={salesDetail.contract_no} />
                <InfoItem label="계약명" value={salesDetail.contract_name} />
                <InfoItem label="고객사" value={salesDetail.client_name} />
                <InfoItem label="담당 영업사원" value={salesDetail.salesperson_name || '-'} />
                <InfoItem label="프로젝트 유형" value={salesDetail.project_type || '-'} />
                <InfoItem label="상태">
                  <Badge variant="outline" className={STATUS_CLASSES[salesDetail.status] || ''}>{salesDetail.status}</Badge>
                </InfoItem>
                <InfoItem label="계약금액" value={fmtFull(salesDetail.amount)} className="text-blue-600 font-bold" />
                <InfoItem label="계약기간" value={`${salesDetail.start_date?.slice(0,10)} ~ ${salesDetail.end_date?.slice(0,10)}`} />
              </div>

              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">수익 현황</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-[11px] text-slate-500">총 매출</div>
                    <div className="text-sm font-bold text-blue-600">{fmtFull(salesDetail.amount)}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-[11px] text-slate-500">총 매입</div>
                    <div className="text-sm font-bold text-red-600">{fmtFull(salesDetail.total_purchase)}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-[11px] text-slate-500">순이익</div>
                    <div className="text-sm font-bold text-green-600">{fmtFull(salesDetail.net_profit)}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-[11px] text-slate-500">이익률</div>
                    <div className="text-sm font-bold text-purple-600">{salesDetail.roi}%</div>
                  </div>
                </div>
              </div>

              {salesDetail.purchase_contracts?.length > 0 && (
                <div className="border-t pt-3">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">연결 매입계약 ({salesDetail.purchase_contracts.length}건)</h3>
                  <div className="space-y-1.5">
                    {salesDetail.purchase_contracts.map(pc => (
                      <div key={pc.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <span className="text-slate-400 text-xs mr-2">{pc.contract_no}</span>
                          <span className="font-medium">{pc.contract_name}</span>
                          <span className="text-slate-400 ml-2">({pc.vendor_name})</span>
                        </div>
                        <span className="text-red-600 font-medium">{fmtFull(pc.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {salesDetail.notes && (
                <div className="border-t pt-3">
                  <h3 className="text-sm font-semibold text-slate-700 mb-1">비고</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{salesDetail.notes}</p>
                </div>
              )}

              <div className="flex justify-end mt-4">
                <Button variant="secondary" onClick={() => setSalesDetail(null)}>닫기</Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {modal && (
        <Modal title={modal.mode === 'create' ? '매입계약 등록' : '매입계약 수정'} onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4">
            {modal.mode === 'edit' && (
              <Field label="계약번호">
                <Input value={form.contract_no} disabled className="bg-slate-100 text-slate-500 cursor-not-allowed" />
              </Field>
            )}
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

function InfoItem({ label, value, children, className, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      {children || <div className={cn('text-sm font-medium text-slate-800', className)}>{value}</div>}
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
