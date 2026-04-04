import { useEffect, useState } from 'react';
import { api } from '../api';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import { alertError, alertWarning } from '../components/AlertModal';
import { useCurrency } from '../contexts/CurrencyContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, AlertTriangle, Loader2, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const STATUS_CLASSES = {
  등록: 'border-blue-200 bg-blue-50 text-blue-700',
  진행: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  종료: 'border-slate-200 bg-slate-100 text-slate-500',
};

const TYPE_COLOR = {
  신규개발: { text: 'text-violet-700', bg: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700' },
  유지보수: { text: 'text-cyan-700', bg: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-700' },
  컨설팅: { text: 'text-amber-700', bg: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
};

export default function Dashboard() {
  const { fmtM } = useCurrency();
  const [stats, setStats] = useState(null);
  const [roi, setRoi] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [byType, setByType] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true); setError('');
    Promise.all([api.getStats(), api.getRoi(), api.getMonthly(), api.getByType(), api.getExpiring()])
      .then(([s, r, m, t, e]) => {
        setStats(s); setRoi(r); setMonthly(m); setByType(t); setExpiring(e);
        if (!s || (s.sales?.total === 0 && s.purchase?.total === 0))
          alertWarning('데이터 없음', '등록된 계약 데이터가 없습니다.\n계약을 먼저 등록해주세요.');
      })
      .catch(e => {
        setError(e.message);
        alertError('데이터 로드 실패', `대시보드 데이터를 불러오는 중 오류가 발생했습니다.\n\n오류: ${e.message}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[400px] gap-3">
      <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
      <span className="text-sm text-muted-foreground">데이터를 불러오는 중...</span>
    </div>
  );
  if (error) return <ErrorBanner message={error} onRetry={loadData} />;

  const { sales, purchase, net_profit, roi: totalRoi } = stats;

  return (
    <div className="animate-slideUp space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">계약 현황 대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">프로젝트 계약 현황과 수익성을 한눈에 확인하세요</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock size={14} />
          <span>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="총 매출금액" value={fmtM(sales.total_amount)} sub={`계약 ${sales.total}건`}
          gradient="gradient-blue" iconBg="bg-blue-500/10" iconColor="text-blue-600" />
        <KpiCard icon={TrendingDown} label="총 매입금액" value={fmtM(purchase.total_amount)} sub={`계약 ${purchase.total}건`}
          gradient="gradient-red" iconBg="bg-red-500/10" iconColor="text-red-600" />
        <KpiCard icon={DollarSign} label="순이익" value={fmtM(net_profit)}
          sub={<span className={cn('inline-flex items-center gap-0.5', net_profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {net_profit >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {net_profit >= 0 ? '흑자' : '적자'}
          </span>}
          gradient="gradient-green" iconBg={net_profit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          iconColor={net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'} valueColor={net_profit >= 0 ? 'text-emerald-700' : 'text-red-600'} />
        <KpiCard icon={BarChart3} label="전체 ROI" value={`${totalRoi}%`} sub="매출 대비 이익률"
          gradient="gradient-violet" iconBg="bg-violet-500/10" iconColor="text-violet-600" valueColor="text-violet-700" />
      </div>

      {/* 상태 요약 */}
      <div className="flex items-center gap-3 flex-wrap">
        {['등록', '진행', '종료'].map(label => {
          const cnt = label === '등록' ? sales.cnt_registered : label === '진행' ? sales.cnt_active : sales.cnt_closed;
          return (
            <div key={label} className="flex items-center gap-3 bg-card rounded-xl px-5 py-3 shadow-card border border-border/50">
              <Badge variant="outline" className={cn('text-xs font-semibold', STATUS_CLASSES[label])}>{label}</Badge>
              <span className="text-lg font-bold text-foreground">{cnt}<span className="text-sm font-normal text-muted-foreground ml-0.5">건</span></span>
            </div>
          );
        })}
        {expiring.length > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-5 py-3 animate-pulse">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-bold text-orange-800">만료 임박 {expiring.length}건</span>
          </div>
        )}
      </div>

      {/* 만료 임박 */}
      {expiring.length > 0 && (
        <Card className="border-l-4 border-l-orange-500 shadow-card overflow-hidden">
          <CardHeader className="pb-3 bg-orange-50/50">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-orange-700">
              <AlertTriangle size={16} /> 만료 임박 계약 (30일 이내)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">계약번호</TableHead>
                  <TableHead className="text-xs">계약명</TableHead>
                  <TableHead className="text-xs">고객사</TableHead>
                  <TableHead className="text-xs">담당자</TableHead>
                  <TableHead className="text-xs">종료일</TableHead>
                  <TableHead className="text-xs">남은 일수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiring.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{r.contract_no}</TableCell>
                    <TableCell className="font-medium text-sm">{r.contract_name}</TableCell>
                    <TableCell className="text-sm">{r.client_name}</TableCell>
                    <TableCell className="text-sm">{r.salesperson_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.end_date?.slice(0,10)}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
                        r.days_left <= 7 ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
                      )}>D-{r.days_left}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 차트 행 */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Card className="shadow-card card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">월별 매출 / 매입 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={monthly} fmtM={fmtM} />
          </CardContent>
        </Card>
        <Card className="shadow-card card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">프로젝트 유형별 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <TypeChart data={byType} fmtM={fmtM} />
          </CardContent>
        </Card>
      </div>

      {/* ROI 테이블 */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">프로젝트별 수익성 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold">계약번호</TableHead>
                  <TableHead className="text-xs font-semibold">프로젝트명</TableHead>
                  <TableHead className="text-xs font-semibold">고객사</TableHead>
                  <TableHead className="text-xs font-semibold">담당자</TableHead>
                  <TableHead className="text-xs font-semibold text-right">매출금액</TableHead>
                  <TableHead className="text-xs font-semibold text-right">매입금액</TableHead>
                  <TableHead className="text-xs font-semibold text-right">순이익</TableHead>
                  <TableHead className="text-xs font-semibold text-right">ROI</TableHead>
                  <TableHead className="text-xs font-semibold">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roi.length === 0 && (
                  <TableRow><TableCell colSpan={9}>
                    <EmptyState icon="📋" title="등록된 계약이 없습니다" description="매출계약을 먼저 등록해주세요." />
                  </TableCell></TableRow>
                )}
                {roi.map(r => (
                  <TableRow key={r.id} className={cn(Number(r.net_profit) < 0 && 'bg-red-50/50')}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{r.contract_no}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{r.contract_name}</div>
                      <span className={cn('inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded', TYPE_COLOR[r.project_type]?.badge || 'bg-slate-100 text-slate-600')}>
                        {r.project_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.client_name}</TableCell>
                    <TableCell className="text-sm">{r.salesperson_name}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-blue-700">{fmtM(r.sales_amount)}</TableCell>
                    <TableCell className="text-right text-sm text-red-600">{fmtM(r.total_purchase)}</TableCell>
                    <TableCell className={cn('text-right text-sm font-bold', Number(r.net_profit) >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      <span className="inline-flex items-center gap-0.5">
                        {Number(r.net_profit) < 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                        {fmtM(r.net_profit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right"><RoiBar value={Number(r.roi)} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px] font-semibold', STATUS_CLASSES[r.status])}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── 서브 컴포넌트 ──────────────────────────── */

function KpiCard({ icon: Icon, label, value, sub, iconBg, iconColor, valueColor }) {
  return (
    <Card className="shadow-card card-hover overflow-hidden border-0 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-xl', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
        <div className={cn('text-2xl font-extrabold tracking-tight', valueColor || 'text-foreground')}>{value}</div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyChart({ data, fmtM }) {
  if (!data.length) return <div className="text-center text-muted-foreground py-12 text-sm">데이터 없음</div>;
  const maxVal = Math.max(...data.map(d => Math.max(d.sales_amount, d.purchase_amount)), 1);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 180 }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 justify-end h-full group">
            <div className="w-full flex gap-[2px] items-end flex-1">
              <div title={`매출: ${fmtM(d.sales_amount)}`}
                className="flex-1 bg-blue-500 rounded-t-sm opacity-85 group-hover:opacity-100 transition-opacity"
                style={{ height: `${(d.sales_amount / maxVal) * 100}%`, minHeight: 2 }} />
              <div title={`매입: ${fmtM(d.purchase_amount)}`}
                className="flex-1 bg-rose-400 rounded-t-sm opacity-85 group-hover:opacity-100 transition-opacity"
                style={{ height: `${(d.purchase_amount / maxVal) * 100}%`, minHeight: 2 }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{d.month.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-5 mt-4 justify-center">
        <Dot color="bg-blue-500" label="매출" />
        <Dot color="bg-rose-400" label="매입" />
      </div>
    </div>
  );
}

function TypeChart({ data, fmtM }) {
  if (!data.length) return <div className="text-center text-muted-foreground py-12 text-sm">데이터 없음</div>;
  const total = data.reduce((s, d) => s + Number(d.count), 0);
  return (
    <div className="space-y-4">
      {data.map((d, i) => {
        const pct = Math.round((Number(d.count) / total) * 100);
        const tc = TYPE_COLOR[d.project_type] || { text: 'text-slate-600', bg: 'bg-slate-500', badge: 'bg-slate-100 text-slate-600' };
        return (
          <div key={i} className="group">
            <div className="flex justify-between mb-1.5">
              <span className={cn('text-xs font-bold', tc.text)}>{d.project_type}</span>
              <span className="text-xs text-muted-foreground font-medium">{d.count}건 · {pct}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500 group-hover:opacity-80', tc.bg)} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{fmtM(d.total_amount)}</div>
          </div>
        );
      })}
    </div>
  );
}

function Dot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function RoiBar({ value }) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColor = value >= 50 ? 'bg-emerald-500' : value >= 20 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = value >= 50 ? 'text-emerald-700' : value >= 20 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-300', barColor)} style={{ width: `${clamped}%` }} />
      </div>
      <span className={cn('text-xs font-bold min-w-[36px] text-right', textColor)}>{value}%</span>
    </div>
  );
}
