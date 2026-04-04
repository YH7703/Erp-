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
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Search, Plus, Download, X, Edit2, Trash2, ArrowUpDown, ChevronUp, ChevronDown, Loader2, CreditCard } from 'lucide-react';

const STATUS_OPT = ['발행', '수금완료', '연체', '취소'];
const STATUS_VARIANT = { '발행': 'default', '수금완료': 'success', '연체': 'destructive', '취소': 'secondary' };

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  invoice_no: '', sales_contract_id: '', client_id: '', amount: '', currency: 'KRW',
  original_amount: '', issue_date: '', due_date: '', status: '발행', notes: '',
};

const advFilters = [
  { key: 'amount_min', label: '최소 금액', type: 'number', placeholder: '0' },
  { key: 'amount_max', label: '최대 금액', type: 'number', placeholder: '999999999' },
  { key: 'issue_from', label: '발행일(부터)', type: 'date' },
  { key: 'issue_to', label: '발행일(까지)', type: 'date' },
  { key: 'due_from', label: '만기일(부터)', type: 'date' },
  { key: 'due_to', label: '만기일(까지)', type: 'date' },
];

export default function Invoices() {
  const { fmtM, fmtFull } = useCurrency();
  const [list, setList] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', search: '' });
  const [modal, setModal] = useState(null);        // { mode: 'create'|'edit'|'pay', id?, row? }
  const [form, setForm] = useState(EMPTY);
  const [payForm, setPayForm] = useState({ paid_amount: '', paid_date: today() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [sort, setSort] = useState({ key: null, asc: true });
  const [advFilter, setAdvFilter] = useState({});

  const debouncedSearch = useDebounce(filter.search);

  const load = useCallback(() => {
    setLoading(true); setError('');
    const params = { ...advFilter };
    if (filter.status !== 'all') params.status = filter.status;
    if (debouncedSearch) params.search = debouncedSearch;
    api.getInvoices(params)
      .then(data => {
        setList(data);
        if (data.length === 0 && filter.status === 'all' && !debouncedSearch) {
          alertWarning('인보이스 데이터 없음', '등록된 인보이스가 없습니다.\n새 인보이스를 등록해주세요.');
        }
      })
      .catch(e => {
        setError(e.message);
        alertError('인보이스 로드 실패', `인보이스 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [filter.status, debouncedSearch, advFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getSalesContracts().then(setContracts).catch(() => {});
    api.getClients().then(setClients).catch(() => {});
  }, []);

  // ESC로 모달 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && modal) setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const isOverdue = (row) => row.status === '발행' && row.due_date && row.due_date.slice(0, 10) < today();

  const validate = () => {
    const e = {};
    if (!form.invoice_no.trim()) e.invoice_no = '인보이스 번호를 입력하세요.';
    if (!form.sales_contract_id) e.sales_contract_id = '매출계약을 선택하세요.';
    if (!form.client_id) e.client_id = '거래처를 선택하세요.';
    if (!form.amount || Number(form.amount) <= 0) e.amount = '금액을 올바르게 입력하세요.';
    if (!form.issue_date) e.issue_date = '발행일을 선택하세요.';
    if (!form.due_date) e.due_date = '만기일을 선택하세요.';
    return e;
  };

  const openCreate = () => { setForm(EMPTY); setFormErrors({}); setModal({ mode: 'create' }); };
  const openEdit = (row) => {
    setForm({
      ...row,
      issue_date: row.issue_date?.slice(0, 10),
      due_date: row.due_date?.slice(0, 10),
      sales_contract_id: row.sales_contract_id || '',
      client_id: row.client_id || '',
    });
    setFormErrors({});
    setModal({ mode: 'edit', id: row.id });
  };
  const openPay = (row) => {
    setPayForm({ paid_amount: '', paid_date: today() });
    setModal({ mode: 'pay', row });
  };

  const handleContractChange = (contractId) => {
    setForm(f => {
      const sc = contracts.find(c => c.id === Number(contractId));
      // Try to find client_id from the contract's client_name
      const client = sc ? clients.find(cl => cl.client_name === sc.client_name) : null;
      return { ...f, sales_contract_id: contractId, client_id: client ? String(client.id) : f.client_id };
    });
  };

  const handleSave = async () => {
    const errs = validate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toastError('필수 항목을 확인해주세요.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        original_amount: Number(form.original_amount || form.amount),
      };
      if (modal.mode === 'create') {
        await api.createInvoice(payload);
        toastSuccess('인보이스가 등록되었습니다.');
      } else {
        await api.updateInvoice(modal.id, payload);
        toastSuccess('인보이스가 수정되었습니다.');
      }
      setModal(null); load();
    } catch (e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handlePay = async () => {
    if (!payForm.paid_amount || Number(payForm.paid_amount) <= 0) {
      toastError('수금액을 입력하세요.');
      return;
    }
    if (!payForm.paid_date) {
      toastError('수금일을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.payInvoice(modal.row.id, {
        paid_amount: Number(payForm.paid_amount),
        paid_date: payForm.paid_date,
      });
      toastSuccess('수금 처리가 완료되었습니다.');
      setModal(null); load();
    } catch (e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, no) => {
    const ok = await confirmDialog({
      title: '인보이스 삭제',
      message: `"${no}" 인보이스를 삭제하시겠습니까?`,
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    try { await api.deleteInvoice(id); toastSuccess('인보이스가 삭제되었습니다.'); load(); }
    catch (e) { toastError(e.message); }
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
          <h1 className="text-2xl font-bold text-slate-800">인보이스 관리</h1>
          {!loading && <span className="text-[13px] text-slate-400">총 {list.length}건</span>}
        </div>
        <div className="flex gap-2">
          <ExportButton type="invoices" />
          <Button variant="secondary" onClick={() => exportCSV(list, fmtFull)}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV 내보내기
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            인보이스 등록
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
            className="pl-9 w-[280px]"
            placeholder="인보이스번호, 거래처, 계약명 검색..."
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

      {/* 테이블 */}
      <Card>
        <CardContent className="p-6">
          {loading ? <Spinner /> : sorted.length === 0 ? (
            <EmptyState icon="🧾" title="인보이스 데이터가 없습니다"
              description={filter.status !== 'all' || filter.search ? '검색 조건에 맞는 인보이스가 없습니다. 필터를 변경해보세요.' : '첫 인보이스를 등록해보세요.'}
              action={!filter.search ? '+ 인보이스 등록' : undefined} onAction={!filter.search ? openCreate : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortTh k="invoice_no">인보이스번호</SortTh>
                    <SortTh k="sales_contract_name">매출계약</SortTh>
                    <SortTh k="client_name">거래처</SortTh>
                    <SortTh k="amount" right>금액</SortTh>
                    <SortTh k="paid_amount" right>수금액</SortTh>
                    <SortTh k="issue_date">발행일</SortTh>
                    <SortTh k="due_date">만기일</SortTh>
                    <TableHead>상태</TableHead>
                    <TableHead>관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(r => {
                    const overdue = isOverdue(r);
                    return (
                      <TableRow key={r.id} className={cn(overdue && 'bg-red-50')}>
                        <TableCell className="text-slate-500 text-[13px]">{r.invoice_no}</TableCell>
                        <TableCell>{r.sales_contract_name || '-'}</TableCell>
                        <TableCell>{r.client_name || '-'}</TableCell>
                        <TableCell className="text-right text-blue-600 font-medium" title={fmtFull(r.amount)}>{fmtM(r.amount)}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium" title={fmtFull(r.paid_amount)}>{fmtM(r.paid_amount || 0)}</TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{r.issue_date?.slice(0, 10)}</TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">{r.due_date?.slice(0, 10)}</TableCell>
                        <TableCell>
                          {overdue
                            ? <Badge variant="destructive">연체</Badge>
                            : <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(r.status === '발행' || overdue) && (
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => openPay(r)}>
                                <CreditCard className="h-3.5 w-3.5 mr-1" />
                                수금처리
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                              <Edit2 className="h-3.5 w-3.5 mr-1" />
                              수정
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(r.id, r.invoice_no)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              삭제
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 등록/수정 모달 */}
      {modal && (modal.mode === 'create' || modal.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? '인보이스 등록' : '인보이스 수정'} onClose={() => setModal(null)}>
          <FormGrid>
            <Field label="인보이스 번호 *" error={formErrors.invoice_no}>
              <Input className={cn(formErrors.invoice_no && 'border-red-300 bg-red-50')} value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} placeholder="INV-2025-001" />
            </Field>
            <Field label="매출계약 *" error={formErrors.sales_contract_id}>
              <Select className={cn(formErrors.sales_contract_id && 'border-red-300 bg-red-50')} value={form.sales_contract_id} onChange={e => handleContractChange(e.target.value)}>
                <option value="">선택</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_name} ({c.contract_no})</option>)}
              </Select>
            </Field>
            <Field label="거래처 *" error={formErrors.client_id}>
              <Select className={cn(formErrors.client_id && 'border-red-300 bg-red-50')} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">선택</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
              </Select>
            </Field>
            <Field label="금액 *" error={formErrors.amount}>
              <div className="flex gap-2">
                <Select className="w-[100px]" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="JPY">JPY</option>
                </Select>
                <Input
                  type="number"
                  className={cn('flex-1', formErrors.amount && 'border-red-300 bg-red-50')}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="금액 입력"
                />
              </div>
            </Field>
            <Field label="발행일 *" error={formErrors.issue_date}>
              <Input type="date" className={cn(formErrors.issue_date && 'border-red-300 bg-red-50')} value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </Field>
            <Field label="만기일 *" error={formErrors.due_date}>
              <Input type="date" className={cn(formErrors.due_date && 'border-red-300 bg-red-50')} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </Field>
            <Field label="상태">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPT.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="비고" full>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] outline-none transition-colors focus:border-blue-400 resize-y min-h-[60px]"
                value={form.notes || ''}
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

      {/* 수금 처리 모달 */}
      {modal?.mode === 'pay' && modal.row && (
        <Modal title="수금 처리" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">인보이스</span>
                <span className="font-medium">{modal.row.invoice_no}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">청구 금액</span>
                <span className="font-medium text-blue-600">{fmtFull(modal.row.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">기존 수금액</span>
                <span className="font-medium">{fmtFull(modal.row.paid_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-slate-500 font-semibold">잔여 금액</span>
                <span className="font-bold text-red-600">{fmtFull(Number(modal.row.amount) - Number(modal.row.paid_amount || 0))}</span>
              </div>
            </div>
            <Field label="수금액 *">
              <Input
                type="number"
                value={payForm.paid_amount}
                onChange={e => setPayForm(f => ({ ...f, paid_amount: e.target.value }))}
                placeholder="수금 금액 입력"
              />
            </Field>
            <Field label="수금일 *">
              <Input
                type="date"
                value={payForm.paid_date}
                onChange={e => setPayForm(f => ({ ...f, paid_date: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={() => setModal(null)}>취소</Button>
            <Button onClick={handlePay} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {saving ? '처리 중...' : '수금 처리'}
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

function exportCSV(list, fmtFull) {
  const headers = ['인보이스번호', '매출계약', '거래처', '금액', '수금액', '발행일', '만기일', '상태'];
  const rows = list.map(r => [r.invoice_no, r.sales_contract_name, r.client_name, r.amount, r.paid_amount || 0, r.issue_date?.slice(0, 10), r.due_date?.slice(0, 10), r.status]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `인보이스_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-7 w-[560px] max-h-[90vh] overflow-auto shadow-2xl animate-in zoom-in-95 duration-150"
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
