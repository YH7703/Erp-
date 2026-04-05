import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Search, Plus, X, Edit2, Trash2, Eye, ArrowUpDown, ChevronUp, ChevronDown, Loader2, ArrowRightLeft, PlusCircle, MinusCircle, FileDown } from 'lucide-react';

const STATUS_OPT = ['작성', '제출', '승인', '거절', '계약전환'];
const TYPE_OPT   = ['신규개발', '유지보수', '컨설팅'];
const CURRENCY_OPT = ['KRW', 'USD', 'EUR', 'JPY'];

const STATUS_VARIANT = { 작성: 'default', 제출: 'info', 승인: 'success', 거절: 'destructive', 계약전환: 'secondary' };

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: '' };
const EMPTY = { quotation_no: '', title: '', client_id: '', salesperson_id: '', status: '작성', valid_until: '', created_date: new Date().toISOString().slice(0, 10), currency: 'KRW', notes: '', items: [{ ...EMPTY_ITEM }] };

const advFilters = [
  { key: 'amount_min', label: '최소 금액', type: 'number', placeholder: '0' },
  { key: 'amount_max', label: '최대 금액', type: 'number', placeholder: '999999999' },
  { key: 'valid_from', label: '유효기간(부터)', type: 'date' },
  { key: 'valid_to', label: '유효기간(까지)', type: 'date' },
];

export default function Quotations() {
  const navigate = useNavigate();
  const { fmtM, fmtFull } = useCurrency();
  const [list, setList] = useState([]);
  const [people, setPeople] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: 'all', search: '', salesperson_id: '' });
  const [modal, setModal] = useState(null);      // { mode: 'create'|'edit'|'detail'|'convert', id? }
  const [form, setForm] = useState(EMPTY);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [sort, setSort] = useState({ key: null, asc: true });
  const [advFilter, setAdvFilter] = useState({});
  const [convertForm, setConvertForm] = useState({ contract_no: '', start_date: '', end_date: '', project_type: '신규개발' });
  const [convertErrors, setConvertErrors] = useState({});

  const debouncedSearch = useDebounce(filter.search);

  const load = useCallback(() => {
    setLoading(true); setError('');
    const params = { ...advFilter };
    if (filter.status !== 'all') params.status = filter.status;
    if (debouncedSearch) params.search = debouncedSearch;
    if (filter.salesperson_id) params.salesperson_id = filter.salesperson_id;
    api.getQuotations(params)
      .then(data => {
        setList(data);
        if (data.length === 0 && filter.status === 'all' && !debouncedSearch && !filter.salesperson_id) {
          alertWarning('견적서 데이터 없음', '등록된 견적서가 없습니다.\n새 견적서를 등록해주세요.');
        }
      })
      .catch(e => {
        setError(e.message);
        alertError('견적서 로드 실패', `견적서 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [filter.status, debouncedSearch, filter.salesperson_id, advFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getSalespeople().then(setPeople);
    api.getClients().then(data => setClients(Array.isArray(data) ? data : (data.rows || [])));
  }, []);

  // ESC로 모달 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && modal) setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  // 항목 합계 계산
  const calcTotal = (items) => items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  const validate = () => {
    const e = {};
    if (!form.title.trim())        e.title = '제목을 입력하세요.';
    if (!form.client_id)           e.client_id = '거래처를 선택하세요.';
    if (!form.salesperson_id)      e.salesperson_id = '담당 영업사원을 선택하세요.';
    // 항목 검증
    const itemErrors = form.items.map(it => {
      const ie = {};
      if (!it.description.trim()) ie.description = '항목명을 입력하세요.';
      if (!it.unit_price || Number(it.unit_price) <= 0) ie.unit_price = '단가를 입력하세요.';
      return ie;
    });
    if (itemErrors.some(ie => Object.keys(ie).length > 0)) e.items = itemErrors;
    return e;
  };

  const openCreate = () => { setForm({ ...EMPTY, items: [{ ...EMPTY_ITEM }] }); setFormErrors({}); setModal({ mode: 'create' }); };
  const openEdit = async (row) => {
    try {
      const d = await api.getQuotation(row.id);
      setForm({
        quotation_no: d.quotation_no,
        title: d.title,
        client_id: d.client_id || '',
        salesperson_id: d.salesperson_id || '',
        status: d.status,
        valid_until: d.valid_until?.slice(0, 10) || '',
        created_date: d.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        currency: d.currency || 'KRW',
        notes: d.notes || '',
        items: d.items && d.items.length > 0 ? d.items.map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })) : [{ ...EMPTY_ITEM }],
      });
      setFormErrors({}); setModal({ mode: 'edit', id: row.id });
    } catch (e) { toastError(e.message); }
  };
  const openDetail = async (id) => {
    try { const d = await api.getQuotation(id); setDetail(d); setModal({ mode: 'detail' }); }
    catch (e) { toastError(e.message); }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => setForm(f => ({
    ...f,
    items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it),
  }));

  const handleSave = async () => {
    const errs = validate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toastError('필수 항목을 확인해주세요.'); return; }
    setSaving(true);
    try {
      const payload = {
        quotation_no: form.quotation_no,
        title: form.title,
        client_id: form.client_id,
        salesperson_id: form.salesperson_id,
        status: form.status,
        valid_until: form.valid_until || null,
        currency: form.currency,
        notes: form.notes,
        items: form.items.map(it => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      };
      if (modal.mode === 'create') { await api.createQuotation(payload); toastSuccess('견적서가 등록되었습니다.'); }
      else { await api.updateQuotation(modal.id, payload); toastSuccess('견적서가 수정되었습니다.'); }
      setModal(null); load();
    } catch (e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, title) => {
    const ok = await confirmDialog({ title: '견적서 삭제', message: `"${title}" 견적서를 삭제하시겠습니까?`, confirmText: '삭제', danger: true });
    if (!ok) return;
    try { await api.deleteQuotation(id); toastSuccess('견적서가 삭제되었습니다.'); load(); }
    catch (e) { toastError(e.message); }
  };

  const openConvert = (row) => {
    setDetail(row);
    setConvertForm({ start_date: '', end_date: '', project_type: '신규개발' });
    setConvertErrors({});
    setModal({ mode: 'convert', id: row.id });
  };

  const handleConvert = async () => {
    const e = {};
    if (!convertForm.start_date) e.start_date = '시작일을 선택하세요.';
    if (!convertForm.end_date) e.end_date = '종료일을 선택하세요.';
    if (convertForm.start_date && convertForm.end_date && convertForm.start_date > convertForm.end_date) e.end_date = '종료일이 시작일보다 빠릅니다.';
    setConvertErrors(e);
    if (Object.keys(e).length > 0) { toastError('필수 항목을 확인해주세요.'); return; }
    setSaving(true);
    try {
      await api.convertQuotation(modal.id, convertForm);
      toastSuccess('견적서가 매출계약으로 전환되었습니다.');
      setModal(null);
      navigate('/sales');
    } catch (err) { toastError(err.message); }
    finally { setSaving(false); }
  };

  // 견적서 리포트 PDF 다운로드
  const downloadReport = async (id, quotationNo) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${id}/report`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('리포트 생성 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `견적서_${quotationNo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess('견적서 리포트가 다운로드되었습니다.');
    } catch (e) { toastError(e.message); }
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
    <TableHead className={cn('cursor-pointer select-none', right && 'text-right')} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.key === k
          ? (sort.asc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
          : <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />}
      </span>
    </TableHead>
  );

  // 거래처 필터: 협력사 제외
  const filteredClients = clients.filter(c => c.type !== '협력사');

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">견적서 관리</h1>
          {!loading && <span className="text-[13px] text-slate-400">총 {list.length}건</span>}
        </div>
        <div className="flex gap-2">
          <ExportButton type="quotations" />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            견적서 등록
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
            placeholder="제목, 견적번호, 거래처 검색..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
          {filter.search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setFilter(f => ({ ...f, search: '' }))}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select className="w-[150px]" value={filter.salesperson_id} onChange={e => setFilter(f => ({ ...f, salesperson_id: e.target.value }))}>
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
            <EmptyState icon="📋" title="견적서 데이터가 없습니다"
              description={filter.status !== 'all' || filter.search ? '검색 조건에 맞는 견적서가 없습니다. 필터를 변경해보세요.' : '첫 견적서를 등록해보세요.'}
              action={!filter.search ? '+ 견적서 등록' : undefined} onAction={!filter.search ? openCreate : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortTh k="quotation_no">견적번호</SortTh>
                    <SortTh k="title">제목</SortTh>
                    <SortTh k="client_name">거래처</SortTh>
                    <SortTh k="amount" right>금액</SortTh>
                    <TableHead>상태</TableHead>
                    <SortTh k="valid_until">유효기간</SortTh>
                    <TableHead>영업사원</TableHead>
                    <TableHead className="text-right">항목수</TableHead>
                    <TableHead>관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-slate-500 text-[13px]">{r.quotation_no}</TableCell>
                      <TableCell>
                        <button className="bg-transparent border-none text-blue-600 font-medium cursor-pointer underline underline-offset-2 text-sm hover:text-blue-800 active:text-blue-900 transition-colors duration-150 rounded px-1 -mx-1 hover:bg-blue-50" onClick={() => openDetail(r.id)}>
                          {r.title}
                        </button>
                      </TableCell>
                      <TableCell>{r.client_name}</TableCell>
                      <TableCell className="text-right text-blue-600 font-medium" title={fmtFull(r.amount)}>{fmtM(r.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{r.valid_until?.slice(0, 10) || '-'}</TableCell>
                      <TableCell>{r.salesperson_name}</TableCell>
                      <TableCell className="text-right">{r.item_count}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.status === '승인' && (
                            <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => openConvert(r)}>
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                              전환
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => downloadReport(r.id, r.quotation_no)}>
                            <FileDown className="h-3.5 w-3.5 mr-1" />
                            리포트
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            수정
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(r.id, r.title)}>
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
      {modal && (modal.mode === 'create' || modal.mode === 'edit') && (
        <Modal title={modal.mode === 'create' ? '견적서 등록' : '견적서 수정'} onClose={() => setModal(null)} wide>
          <FormGrid>
            {modal.mode === 'edit' && (
              <Field label="견적번호">
                <Input value={form.quotation_no} disabled className="bg-slate-100 text-slate-500 cursor-not-allowed" />
              </Field>
            )}
            <Field label="제목 *" error={formErrors.title}>
              <Input className={cn(formErrors.title && 'border-red-300 bg-red-50')} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="거래처 *" error={formErrors.client_id}>
              <Select className={cn(formErrors.client_id && 'border-red-300 bg-red-50')} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">선택</option>
                {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="담당 영업사원 *" error={formErrors.salesperson_id}>
              <Select className={cn(formErrors.salesperson_id && 'border-red-300 bg-red-50')} value={form.salesperson_id} onChange={e => setForm(f => ({ ...f, salesperson_id: e.target.value }))}>
                <option value="">선택</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.department})</option>)}
              </Select>
            </Field>
            <Field label="작성일자">
              <Input type="date" value={form.created_date} onChange={e => setForm(f => ({ ...f, created_date: e.target.value }))} />
            </Field>
            <Field label="유효기간">
              <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
            </Field>
            <Field label="통화">
              <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCY_OPT.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="상태">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPT.filter(s => s !== '계약전환').map(t => <option key={t}>{t}</option>)}
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

          {/* 항목 섹션 */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">견적 항목</h3>
              <Button variant="secondary" size="sm" onClick={addItem}>
                <PlusCircle className="h-4 w-4 mr-1" />
                항목 추가
              </Button>
            </div>
            <div className="flex gap-2 items-center px-3 mb-1">
              <div className="flex-1 text-[11px] font-semibold text-slate-500">항목 설명</div>
              <div className="w-[80px] text-[11px] font-semibold text-slate-500 text-right">개월수</div>
              <div className="w-[140px] text-[11px] font-semibold text-slate-500 text-right">단가</div>
              <div className="w-[120px] text-[11px] font-semibold text-slate-500 text-right">금액</div>
              <div className="w-[28px]"></div>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => {
                const itemErr = formErrors.items?.[idx] || {};
                return (
                  <div key={idx} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <Input
                        className={cn('text-[13px]', itemErr.description && 'border-red-300 bg-red-50')}
                        placeholder="항목 설명"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                      />
                      {itemErr.description && <div className="text-[11px] text-red-600 mt-0.5">{itemErr.description}</div>}
                    </div>
                    <div className="w-[80px]">
                      <Input
                        type="number"
                        className="text-[13px] text-right"
                        placeholder="개월수"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        min="0"
                      />
                    </div>
                    <div className="w-[140px]">
                      <Input
                        type="number"
                        className={cn('text-[13px] text-right', itemErr.unit_price && 'border-red-300 bg-red-50')}
                        placeholder="단가"
                        value={item.unit_price}
                        onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                        min="0"
                      />
                      {itemErr.unit_price && <div className="text-[11px] text-red-600 mt-0.5">{itemErr.unit_price}</div>}
                    </div>
                    <div className="w-[120px] text-right text-[13px] font-medium text-slate-700 pt-2">
                      {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
                    </div>
                    <button
                      className="p-1.5 text-red-400 hover:text-red-600 mt-0.5 disabled:opacity-30"
                      onClick={() => removeItem(idx)}
                      disabled={form.items.length <= 1}
                      title="항목 삭제"
                    >
                      <MinusCircle className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end mt-3 text-sm font-bold text-slate-800">
              합계: {calcTotal(form.items).toLocaleString()} {form.currency}
            </div>
          </div>

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
        <Modal title="견적서 상세" onClose={() => setModal(null)} wide>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <InfoRow label="견적번호" value={detail.quotation_no} />
            <InfoRow label="제목" value={detail.title} />
            <InfoRow label="거래처" value={detail.client_name} />
            <InfoRow label="담당자" value={detail.salesperson_name} />
            <InfoRow label="금액" value={fmtFull(detail.amount)} />
            <InfoRow label="통화" value={detail.currency || 'KRW'} />
            <InfoRow label="유효기간" value={detail.valid_until?.slice(0, 10) || '-'} />
            <InfoRow label="상태" value={<Badge variant={STATUS_VARIANT[detail.status]}>{detail.status}</Badge>} />
            {detail.notes && <InfoRow label="비고" value={detail.notes} />}
          </div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2.5">견적 항목 ({detail.items?.length || 0}건)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>번호</TableHead>
                <TableHead>항목 설명</TableHead>
                <TableHead className="text-right">개월수</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items?.map((it, idx) => (
                <TableRow key={it.id || idx}>
                  <TableCell className="text-slate-400">{idx + 1}</TableCell>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-right">{Number(it.quantity).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(it.unit_price).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{Number(it.amount).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!detail.items?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400">항목 없음</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => downloadReport(detail.id, detail.quotation_no)}>
              <FileDown className="h-4 w-4 mr-1.5" />
              리포트 다운로드
            </Button>
            {detail.status === '승인' && (
              <Button onClick={() => openConvert(detail)}>
                <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                매출계약으로 전환
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* 계약 전환 모달 */}
      {modal?.mode === 'convert' && (
        <Modal title="견적서 → 매출계약 전환" onClose={() => setModal(null)}>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-blue-700">
            견적서 "{detail?.title}"을(를) 매출계약으로 전환합니다.
          </div>
          <FormGrid>
            <Field label="프로젝트 유형 *">
              <Select value={convertForm.project_type} onChange={e => setConvertForm(f => ({ ...f, project_type: e.target.value }))}>
                {TYPE_OPT.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <div></div>
            <Field label="시작일 *" error={convertErrors.start_date}>
              <Input type="date" className={cn(convertErrors.start_date && 'border-red-300 bg-red-50')} value={convertForm.start_date} onChange={e => setConvertForm(f => ({ ...f, start_date: e.target.value }))} />
            </Field>
            <Field label="종료일 *" error={convertErrors.end_date}>
              <Input type="date" className={cn(convertErrors.end_date && 'border-red-300 bg-red-50')} value={convertForm.end_date} onChange={e => setConvertForm(f => ({ ...f, end_date: e.target.value }))} />
            </Field>
          </FormGrid>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={() => setModal(null)}>취소</Button>
            <Button onClick={handleConvert} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {saving ? '전환 중...' : '계약 전환'}
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

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] animate-in fade-in duration-150" onClick={onClose}>
      <div
        className={cn('bg-white rounded-xl p-7 max-h-[90vh] overflow-auto shadow-2xl animate-in zoom-in-95 duration-150', wide ? 'w-[800px]' : 'w-[560px]')}
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
      <label className={cn('block text-xs font-semibold mb-1', error ? 'text-red-600' : 'text-slate-600')}>{label}</label>
      {children}
      {error && typeof error === 'string' && <div className="text-[11px] text-red-600 mt-0.5">{error}</div>}
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
