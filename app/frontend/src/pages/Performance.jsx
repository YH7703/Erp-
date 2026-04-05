import { useEffect, useState } from 'react';
import { api } from '../api';
import { toastError } from '../components/Toast';
import { alertError, alertWarning } from '../components/AlertModal';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import { useCurrency } from '../contexts/CurrencyContext';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Trophy, X, Loader2, ChevronUp, ChevronDown, ArrowUpDown, Calendar, RotateCcw, Eye, ExternalLink } from 'lucide-react';

const STATUS_CLASSES = {
  등록: 'bg-blue-50 text-blue-500 border-blue-200',
  진행: 'bg-green-50 text-green-600 border-green-200',
  종료: 'bg-slate-50 text-slate-400 border-slate-200',
};

export default function Performance() {
  const { fmtM, fmtFull } = useCurrency();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [period, setPeriod]   = useState({ start: '', end: '' });
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sort, setSort] = useState({ key: 'total_sales', asc: false });
  const [salesDetail, setSalesDetail] = useState(null);
  const [salesDetailLoading, setSalesDetailLoading] = useState(false);

  const load = () => {
    setLoading(true); setError('');
    api.getPerformance({ start: period.start || undefined, end: period.end || undefined })
      .then(data => {
        setList(data);
        if (data.length === 0 && !period.start && !period.end) {
          alertWarning('성과 데이터 없음', '등록된 영업사원 성과 데이터가 없습니다.\n계약을 먼저 등록해주세요.');
        }
      })
      .catch(e => {
        setError(e.message);
        alertError('성과 데이터 로드 실패', `성과 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const d = await api.getPersonPerf(id, { start: period.start || undefined, end: period.end || undefined });
      setSelected(d);
    } catch(e) { toastError(e.message); }
    finally { setDetailLoading(false); }
  };

  const openSalesDetail = async (salesContractId) => {
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
    return sort.asc ? Number(a[sort.key]) - Number(b[sort.key]) : Number(b[sort.key]) - Number(a[sort.key]);
  });

  const maxSales = Math.max(...list.map(r => Number(r.total_sales)), 1);

  const SortTh = ({ k, children, right }) => (
    <TableHead
      className={cn('cursor-pointer select-none', right && 'text-right')}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.key === k
          ? (sort.asc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
          : <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
        }
      </span>
    </TableHead>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            영업사원 성과
          </h1>
          {!loading && <span className="text-[13px] text-slate-400">총 {list.length}명</span>}
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              className="w-[150px] text-[13px]"
              value={period.start}
              onChange={e => setPeriod(p => ({ ...p, start: e.target.value }))}
            />
            <span className="text-slate-400">~</span>
            <Input
              type="date"
              className="w-[150px] text-[13px]"
              value={period.end}
              onChange={e => setPeriod(p => ({ ...p, end: e.target.value }))}
            />
          </div>
          <Button onClick={load} size="sm">
            조회
          </Button>
          {(period.start || period.end) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-500"
              onClick={() => { setPeriod({ start: '', end: '' }); setTimeout(load, 0); }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              초기화
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className={cn('grid gap-5', selected ? 'grid-cols-[1fr_380px]' : 'grid-cols-1')}>
        {/* Main card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">영업사원별 성과 비교</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Spinner /> : sorted.length === 0 ? (
              <EmptyState icon="🏆" title="성과 데이터가 없습니다"
                description="조회 기간에 해당하는 계약 실적이 없습니다. 기간을 변경하거나 계약을 먼저 등록해주세요." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>순위</TableHead>
                    <TableHead>영업사원</TableHead>
                    <TableHead>부서</TableHead>
                    <SortTh k="contract_count" right>수주건수</SortTh>
                    <SortTh k="total_sales" right>매출금액</SortTh>
                    <SortTh k="total_purchase" right>매입금액</SortTh>
                    <SortTh k="net_profit" right>순이익</SortTh>
                    <SortTh k="roi">ROI</SortTh>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r, i) => (
                    <TableRow
                      key={r.id}
                      className={cn('cursor-pointer', selected?.person?.id === r.id && 'bg-blue-50')}
                      onClick={() => openDetail(r.id)}
                    >
                      <TableCell><RankBadge rank={i + 1} /></TableCell>
                      <TableCell className="font-semibold">{r.name}</TableCell>
                      <TableCell className="text-slate-500 text-[13px]">{r.department || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{r.contract_count}건</TableCell>
                      <TableCell className="text-right text-blue-600 font-medium" title={fmtFull(r.total_sales)}>{fmtM(r.total_sales)}</TableCell>
                      <TableCell className="text-right text-red-600" title={fmtFull(r.total_purchase)}>{fmtM(r.total_purchase)}</TableCell>
                      <TableCell className={cn('text-right font-semibold', Number(r.net_profit) >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {fmtM(r.net_profit)}
                      </TableCell>
                      <TableCell><RoiBar value={Number(r.roi)} /></TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs"
                          onClick={(e) => { e.stopPropagation(); openDetail(r.id); }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {sorted.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">매출 비교</h3>
                {sorted.map(r => (
                  <div key={r.id} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-[13px] font-medium">{r.name}</span>
                      <span className="text-[13px] text-slate-500">{fmtM(r.total_sales)}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded transition-all duration-400"
                        style={{ width: `${(Number(r.total_sales) / maxSales) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold text-slate-800">{selected.person.name} 상세</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {detailLoading ? <Spinner /> : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <MiniKpi label="수주건수" value={`${selected.contracts.length}건`} />
                    <MiniKpi label="총매출" value={fmtM(selected.contracts.reduce((a,c) => a + Number(c.amount), 0))} colorClass="text-blue-600" />
                    <MiniKpi label="총매입" value={fmtM(selected.contracts.reduce((a,c) => a + Number(c.total_purchase), 0))} colorClass="text-red-600" />
                    <MiniKpi label="순이익" value={fmtM(selected.contracts.reduce((a,c) => a + Number(c.net_profit), 0))} colorClass="text-green-600" />
                  </div>

                  <h3 className="text-[13px] font-semibold text-slate-600 mb-2">담당 계약</h3>
                  {selected.contracts.length === 0 ? (
                    <div className="text-center py-5 text-slate-400 text-[13px]">담당 계약이 없습니다</div>
                  ) : selected.contracts.map(c => (
                    <div
                      key={c.id}
                      className="border border-slate-200 rounded-lg p-3 mb-2 transition-shadow hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <button
                            className="font-medium text-[13px] text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-150 inline-flex items-center gap-1 text-left"
                            onClick={() => openSalesDetail(c.id)}
                          >
                            {c.contract_name}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <div className="text-xs text-slate-500">{c.client_name}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-[11px] font-semibold', STATUS_CLASSES[c.status])}
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400">매출</div>
                          <div className="text-xs font-semibold text-blue-600">{fmtM(c.amount)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">매입</div>
                          <div className="text-xs text-red-600">{fmtM(c.total_purchase)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">ROI</div>
                          <div className={cn('text-xs font-bold', Number(c.roi) >= 30 ? 'text-green-600' : 'text-amber-500')}>
                            {c.roi}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {(salesDetail || salesDetailLoading) && (
        <SalesDetailModal
          data={salesDetail}
          loading={salesDetailLoading}
          fmtFull={fmtFull}
          fmtM={fmtM}
          onClose={() => setSalesDetail(null)}
        />
      )}
    </div>
  );
}

function SalesDetailModal({ data, loading, fmtFull, fmtM, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white rounded-xl p-7 w-[600px] max-h-[90vh] overflow-auto shadow-2xl animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">매출계약 상세</h2>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? <Spinner /> : data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="계약번호" value={data.contract_no} />
              <InfoItem label="계약명" value={data.contract_name} />
              <InfoItem label="고객사" value={data.client_name} />
              <InfoItem label="담당 영업사원" value={data.salesperson_name || '-'} />
              <InfoItem label="프로젝트 유형" value={data.project_type || '-'} />
              <InfoItem label="상태">
                <Badge variant="outline" className={cn('text-[11px] font-semibold', STATUS_CLASSES[data.status] || '')}>{data.status}</Badge>
              </InfoItem>
              <InfoItem label="계약금액" value={fmtFull(data.amount)} className="text-blue-600 font-bold" />
              <InfoItem label="계약기간" value={`${data.start_date?.slice(0,10)} ~ ${data.end_date?.slice(0,10)}`} />
            </div>

            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">수익 현황</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-slate-500">총 매출</div>
                  <div className="text-sm font-bold text-blue-600">{fmtFull(data.amount)}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-slate-500">총 매입</div>
                  <div className="text-sm font-bold text-red-600">{fmtFull(data.total_purchase)}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-slate-500">순이익</div>
                  <div className="text-sm font-bold text-green-600">{fmtFull(data.net_profit)}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-slate-500">이익률</div>
                  <div className="text-sm font-bold text-purple-600">{data.roi}%</div>
                </div>
              </div>
            </div>

            {data.purchase_contracts?.length > 0 && (
              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">연결 매입계약 ({data.purchase_contracts.length}건)</h3>
                <div className="space-y-1.5">
                  {data.purchase_contracts.map(pc => (
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

            {data.notes && (
              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">비고</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={onClose}>닫기</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value, children, className }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      {children || <div className={cn('text-sm font-medium text-slate-800', className)}>{value}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
    </div>
  );
}

function RankBadge({ rank }) {
  const classes = rank === 1
    ? 'bg-yellow-400 text-white'
    : rank === 2
      ? 'bg-slate-400 text-white'
      : rank === 3
        ? 'bg-amber-700 text-white'
        : 'bg-slate-200 text-slate-500';
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold', classes)}>
      {rank}
    </span>
  );
}

function RoiBar({ value }) {
  const clamped = Math.min(100, Math.max(0, value));
  const colorClass = value >= 50 ? 'bg-green-600' : value >= 20 ? 'bg-amber-500' : 'bg-red-600';
  const textClass = value >= 50 ? 'text-green-600' : value >= 20 ? 'text-amber-500' : 'text-red-600';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[70px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={cn('text-xs font-semibold min-w-[36px]', textClass)}>{value}%</span>
    </div>
  );
}

function MiniKpi({ label, value, colorClass }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5">
      <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
      <div className={cn('font-bold text-sm', colorClass || 'text-slate-800')}>{value}</div>
    </div>
  );
}
