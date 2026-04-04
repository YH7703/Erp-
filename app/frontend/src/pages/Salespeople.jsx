import { useEffect, useState } from 'react';
import { api } from '../api';
import { toastSuccess, toastError } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import { alertError, alertWarning } from '../components/AlertModal';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { UserPlus, Edit2, Trash2, X, Search, Users, Mail, Building2, Phone, Loader2 } from 'lucide-react';

const EMPTY = { name: '', email: '', phone: '', department: '' };

export default function Salespeople() {
  const [list,   setList]   = useState([]);
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error,  setError]  = useState('');
  const [formError, setFormError] = useState('');

  const load = () => {
    setError('');
    api.getSalespeople()
      .then(data => {
        setList(data);
        if (data.length === 0) {
          alertWarning('영업사원 데이터 없음', '등록된 영업사원이 없습니다.\n영업사원을 먼저 등록해주세요.');
        }
      })
      .catch(e => {
        setError(e.message);
        alertError('영업사원 로드 실패', `영업사원 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      });
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setFormError(''); setModal({ mode: 'create' }); };
  const openEdit   = (row) => { setForm({ name: row.name, email: row.email || '', phone: row.phone || '', department: row.department || '' }); setFormError(''); setModal({ mode: 'edit', id: row.id }); };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('이름을 입력하세요.'); toastError('이름을 입력하세요.'); return; }
    setFormError('');
    setSaving(true);
    try {
      if (modal.mode === 'create') { await api.createSalesperson(form); toastSuccess('영업사원이 등록되었습니다.'); }
      else { await api.updateSalesperson(modal.id, form); toastSuccess('영업사원 정보가 수정되었습니다.'); }
      setModal(null); load();
    } catch(e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirmDialog({ title: '영업사원 삭제', message: `"${name}" 영업사원을 삭제하시겠습니까?\n담당 계약이 있으면 삭제할 수 없습니다.`, confirmText: '삭제', danger: true });
    if (!ok) return;
    try { await api.deleteSalesperson(id); toastSuccess(`${name} 영업사원이 삭제되었습니다.`); load(); }
    catch(e) { toastError(e.message); }
  };

  const filtered = list.filter(p =>
    p.name.includes(search) || (p.department || '').includes(search) || (p.email || '').includes(search) || (p.phone || '').includes(search)
  );

  // 팀별 그룹
  const byDept = filtered.reduce((acc, p) => {
    const d = p.department || '미지정';
    (acc[d] = acc[d] || []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-slate-800">영업사원 관리</h1>
        <Button onClick={openCreate}>
          <UserPlus className="mr-2 h-4 w-4" />
          사원 등록
        </Button>
      </div>

      {/* 검색 */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          className="w-72 pl-9"
          placeholder="이름, 부서, 이메일 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* 팀별 카드 그리드 */}
      {Object.entries(byDept).map(([dept, members]) => (
        <Card key={dept} className="mb-4">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-[15px]">
              <Badge variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-50">
                {dept}
              </Badge>
              <span className="text-xs text-slate-400 font-normal">{members.length}명</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {members.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3.5 border border-slate-200 rounded-[10px] bg-slate-50">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0">
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px] text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {p.email || '이메일 없음'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {p.phone || '연락처 없음'}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {p.department || '부서 미지정'}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(p.id, p.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <EmptyState icon="👥"
          title={search ? '검색 결과가 없습니다' : '등록된 영업사원이 없습니다'}
          description={search ? '다른 검색어로 시도해보세요.' : '영업사원을 등록해야 계약 담당자를 지정할 수 있습니다.'}
          action={!search ? '+ 사원 등록' : undefined} onAction={!search ? openCreate : undefined} />
      )}

      {/* 등록/수정 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <Card className="w-[440px] shadow-2xl">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-5">
              <CardTitle className="text-lg font-bold">
                {modal.mode === 'create' ? '영업사원 등록' : '영업사원 수정'}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => setModal(null)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3.5">
                <Field label="이름 *">
                  <Input
                    className={cn(formError && 'border-red-300 bg-red-50')}
                    value={form.name}
                    onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormError(''); }}
                    placeholder="홍길동"
                  />
                  {formError && <div className="text-[11px] text-red-600 mt-1">{formError}</div>}
                </Field>
                <Field label="이메일">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="hong@company.com"
                  />
                </Field>
                <Field label="연락처">
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="010-1234-5678"
                  />
                </Field>
                <Field label="부서">
                  <Input
                    value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    placeholder="영업1팀"
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
