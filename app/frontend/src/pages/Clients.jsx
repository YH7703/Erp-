import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { toastSuccess, toastError } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { alertError, alertWarning } from '../components/AlertModal';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import useDebounce from '../hooks/useDebounce';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { Building2, Plus, Edit2, Trash2, X, Search, Loader2 } from 'lucide-react';

const TYPE_OPT = ['고객', '협력사', '고객/협력사'];
const TYPE_VARIANT = { '고객': 'default', '협력사': 'secondary', '고객/협력사': 'success' };

const EMPTY = { name: '', business_no: '', ceo_name: '', address: '', phone: '', email: '', client_type: '고객', notes: '' };

export default function Clients() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: 'all', search: '' });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const debouncedSearch = useDebounce(filter.search);

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.getClients({
      type: filter.type !== 'all' ? filter.type : undefined,
      search: debouncedSearch || undefined,
    })
      .then(data => {
        setList(data);
        if (data.length === 0 && filter.type === 'all' && !debouncedSearch) {
          alertWarning('거래처 데이터 없음', '등록된 거래처가 없습니다.\n새 거래처를 등록해주세요.');
        }
      })
      .catch(e => {
        setError(e.message);
        alertError('거래처 로드 실패', `거래처 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [filter.type, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  // ESC로 모달 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && modal) setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const openCreate = () => { setForm(EMPTY); setFormErrors({}); setModal({ mode: 'create' }); };
  const openEdit = (row) => {
    setForm({
      name: row.name,
      business_no: row.business_no || '',
      ceo_name: row.ceo_name || '',
      address: row.address || '',
      phone: row.phone || '',
      email: row.email || '',
      client_type: row.client_type,
      notes: row.notes || '',
    });
    setFormErrors({});
    setModal({ mode: 'edit', id: row.id });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = '거래처명을 입력하세요.';
    if (!form.client_type) e.client_type = '거래처 유형을 선택하세요.';
    setFormErrors(e);
    if (Object.keys(e).length) {
      toastError(Object.values(e)[0]);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await api.createClient(form);
        toastSuccess('거래처가 등록되었습니다.');
      } else {
        await api.updateClient(modal.id, form);
        toastSuccess('거래처 정보가 수정되었습니다.');
      }
      setModal(null); load();
    } catch (e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirmDialog({
      title: '거래처 삭제',
      message: `"${name}" 거래처를 삭제하시겠습니까?\n연결된 계약이 있으면 삭제할 수 없습니다.`,
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteClient(id);
      toastSuccess(`${name} 거래처가 삭제되었습니다.`);
      load();
    } catch (e) { toastError(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-slate-800">거래처 관리</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          거래처 등록
        </Button>
      </div>

      {/* 필터: 탭 + 검색 */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <Tabs value={filter.type} onValueChange={v => setFilter(f => ({ ...f, type: v }))}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="고객">고객</TabsTrigger>
            <TabsTrigger value="협력사">협력사</TabsTrigger>
            <TabsTrigger value="고객/협력사">고객/협력사</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="w-72 pl-9"
            placeholder="거래처명, 사업자번호, 대표자 검색..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* 테이블 */}
      {list.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>거래처명</TableHead>
                  <TableHead>사업자번호</TableHead>
                  <TableHead>대표자</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className="text-center">매출계약</TableHead>
                  <TableHead className="text-center">매입계약</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.business_no || '-'}</TableCell>
                    <TableCell>{row.ceo_name || '-'}</TableCell>
                    <TableCell>{row.phone || '-'}</TableCell>
                    <TableCell>{row.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[row.client_type] || 'default'}>
                        {row.client_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{row.sales_count}</TableCell>
                    <TableCell className="text-center">{row.purchase_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)}>
                          <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id, row.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : !loading && (
        <EmptyState
          icon={<Building2 className="h-12 w-12 text-slate-400" />}
          title={filter.search || filter.type !== 'all' ? '검색 결과가 없습니다' : '등록된 거래처가 없습니다'}
          description={filter.search || filter.type !== 'all' ? '다른 검색어나 필터로 시도해보세요.' : '거래처를 등록하면 계약 관리에서 선택할 수 있습니다.'}
          action={!filter.search && filter.type === 'all' ? '+ 거래처 등록' : undefined}
          onAction={!filter.search && filter.type === 'all' ? openCreate : undefined}
        />
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* 등록/수정 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <Card className="w-[520px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-5">
              <CardTitle className="text-lg font-bold">
                {modal.mode === 'create' ? '거래처 등록' : '거래처 수정'}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => setModal(null)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3.5">
                <Field label="거래처명 *">
                  <Input
                    className={cn(formErrors.name && 'border-red-300 bg-red-50')}
                    value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormErrors(fe => ({ ...fe, name: undefined })); }}
                    placeholder="(주)한국기업"
                  />
                  {formErrors.name && <div className="text-[11px] text-red-600 mt-1">{formErrors.name}</div>}
                </Field>
                <Field label="거래처 유형 *">
                  <Select
                    className={cn(formErrors.client_type && 'border-red-300 bg-red-50')}
                    value={form.client_type}
                    onChange={e => { setForm(f => ({ ...f, client_type: e.target.value })); setFormErrors(fe => ({ ...fe, client_type: undefined })); }}
                  >
                    {TYPE_OPT.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  {formErrors.client_type && <div className="text-[11px] text-red-600 mt-1">{formErrors.client_type}</div>}
                </Field>
                <Field label="사업자번호">
                  <Input
                    value={form.business_no}
                    onChange={e => setForm(f => ({ ...f, business_no: e.target.value }))}
                    placeholder="123-45-67890"
                  />
                </Field>
                <Field label="대표자">
                  <Input
                    value={form.ceo_name}
                    onChange={e => setForm(f => ({ ...f, ceo_name: e.target.value }))}
                    placeholder="홍길동"
                  />
                </Field>
                <Field label="주소">
                  <Input
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="서울특별시 강남구..."
                  />
                </Field>
                <Field label="연락처">
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="02-1234-5678"
                  />
                </Field>
                <Field label="이메일">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="info@company.com"
                  />
                </Field>
                <Field label="비고">
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="메모 사항..."
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="secondary" onClick={() => setModal(null)}>취소</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : '저장'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
