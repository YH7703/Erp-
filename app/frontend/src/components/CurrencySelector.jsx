import { useState, useRef, useEffect } from 'react';
import { useCurrency } from '../contexts/CurrencyContext';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';

const FLAGS = { KRW: '🇰🇷', USD: '🇺🇸', JPY: '🇯🇵', CNY: '🇨🇳', EUR: '🇪🇺' };
const LABELS = { KRW: '원 (KRW)', USD: '달러 (USD)', JPY: '엔 (JPY)', CNY: '위안 (CNY)', EUR: '유로 (EUR)' };

export default function CurrencySelector({ collapsed }) {
  const { currency, setCurrency, currencies, cur } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (collapsed) {
    return (
      <div ref={ref} className="relative py-2">
        <button
          className="w-full flex justify-center p-2 rounded-lg bg-white/[0.08] border border-white/10 hover:bg-white/15 transition-colors cursor-pointer"
          title={`통화: ${LABELS[currency]}`}
          onClick={() => setOpen(!open)}
        >
          <span className="text-xl">{FLAGS[currency]}</span>
        </button>
        {open && (
          <div className="absolute left-14 top-0 bg-[#1a3352] border border-white/15 rounded-xl p-1.5 w-[130px] shadow-lg z-50">
            {Object.keys(currencies).map(code => (
              <button key={code}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors cursor-pointer',
                  code === currency && 'bg-blue-400/15'
                )}
                onClick={() => { setCurrency(code); setOpen(false); }}>
                <span>{FLAGS[code]}</span>
                <span className="text-xs font-semibold">{code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-4 py-3 border-t border-white/10">
      <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2">통화 선택</label>
      <button
        className="w-full flex items-center gap-3 bg-white/[0.08] border border-white/15 rounded-lg px-3 py-2.5 hover:bg-white/15 transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <span className="text-lg">{FLAGS[currency]}</span>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-white">{cur.symbol} {currency}</div>
          <div className="text-[11px] text-slate-400">{LABELS[currency]}</div>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-[#1a3352] border border-white/15 rounded-xl p-1.5 shadow-2xl z-50">
          {Object.entries(currencies).map(([code, c]) => (
            <button key={code}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer',
                code === currency && 'bg-blue-400/15'
              )}
              onClick={() => { setCurrency(code); setOpen(false); }}>
              <span className="text-base">{FLAGS[code]}</span>
              <div className="flex-1 text-left">
                <div className={cn('text-[13px] font-semibold', code === currency ? 'text-blue-400' : 'text-slate-200')}>
                  {c.symbol} {code}
                </div>
                <div className="text-[10px] text-slate-400">{LABELS[code]}</div>
              </div>
              {code === currency && <Check size={14} className="text-blue-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
