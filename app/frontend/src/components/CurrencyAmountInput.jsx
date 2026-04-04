import { useState, useRef, useEffect } from 'react';
import { CURRENCIES } from '../contexts/CurrencyContext';

const FLAGS = { KRW: '🇰🇷', USD: '🇺🇸', JPY: '🇯🇵', CNY: '🇨🇳', EUR: '🇪🇺' };
const LABELS = { KRW: '원', USD: 'USD', JPY: 'JPY', CNY: 'CNY', EUR: 'EUR' };

// 통화 → KRW 환산 비율 (1 외화 = ? KRW)
const TO_KRW = {
  KRW: 1,
  USD: 1 / 0.00075,   // ~1,333
  JPY: 1 / 0.11,      // ~9.09
  CNY: 1 / 0.0054,    // ~185
  EUR: 1 / 0.00069,   // ~1,449
};

/**
 * 통화 선택 + 금액 입력 컴포넌트
 * - currency: 선택된 통화 코드
 * - onCurrencyChange: 통화 변경 콜백
 * - value: 입력된 금액 (선택된 통화 기준)
 * - onValueChange: 금액 변경 콜백
 * - krwAmount: 환산된 KRW 금액 (부모가 표시용으로 사용)
 * - error: 에러 여부
 * - placeholder: 플레이스홀더
 */
export default function CurrencyAmountInput({ currency, onCurrencyChange, value, onValueChange, error, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const cur = CURRENCIES[currency] || CURRENCIES.KRW;
  const numVal = Number(value) || 0;
  const krwAmount = numVal * TO_KRW[currency];

  // KRW 포맷
  const fmtKrw = (v) => {
    if (Math.abs(v) >= 100000000) return '₩' + (v / 100000000).toFixed(1) + '억';
    if (Math.abs(v) >= 10000) return '₩' + Math.round(v / 10000) + '만';
    return '₩' + v.toLocaleString('ko-KR');
  };

  // 선택된 통화 포맷
  const fmtCur = (v) => {
    if (currency === 'KRW') return null; // KRW일 때는 환산 불필요
    return cur.symbol + Number(v).toLocaleString(cur.locale, { maximumFractionDigits: 2 });
  };

  return (
    <div>
      <div style={s.wrapper}>
        {/* 통화 선택 버튼 */}
        <div ref={ref} style={{ position: 'relative' }}>
          <button type="button" style={{ ...s.currencyBtn, ...(error ? s.currencyBtnErr : {}) }}
            onClick={() => setOpen(!open)}>
            <span style={{ fontSize: 14 }}>{FLAGS[currency]}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{currency}</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
          </button>
          {open && (
            <div style={s.dropdown}>
              {Object.keys(CURRENCIES).map(code => (
                <button key={code} type="button"
                  style={{ ...s.dropItem, ...(code === currency ? s.dropItemActive : {}) }}
                  onClick={() => { onCurrencyChange(code); setOpen(false); }}>
                  <span>{FLAGS[code]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{code}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{LABELS[code]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 금액 입력 */}
        <input
          type="number"
          style={{ ...s.input, ...(error ? s.inputErr : {}) }}
          value={value}
          onChange={e => onValueChange(e.target.value)}
          placeholder={placeholder || '금액 입력'}
        />
      </div>

      {/* 환산 힌트 */}
      {numVal > 0 && (
        <div style={s.hintRow}>
          {currency !== 'KRW' ? (
            <>
              <span style={s.hintLabel}>KRW 환산:</span>
              <span style={s.hintValue}>{fmtKrw(krwAmount)}</span>
              <span style={s.hintRate}>(1 {currency} = ₩{Math.round(TO_KRW[currency]).toLocaleString()})</span>
            </>
          ) : (
            <span style={s.hintValue}>{fmtKrw(numVal)}</span>
          )}
        </div>
      )}
    </div>
  );
}

// KRW로 환산하는 유틸 함수 (외부에서 사용)
export function toKRW(amount, currency) {
  return (Number(amount) || 0) * (TO_KRW[currency] || 1);
}

// KRW에서 해당 통화로 변환
export function fromKRW(krwAmount, currency) {
  return (Number(krwAmount) || 0) / (TO_KRW[currency] || 1);
}

const s = {
  wrapper: {
    display: 'flex', gap: 0,
  },
  currencyBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '8px 10px', background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRight: 'none',
    borderRadius: '8px 0 0 8px', cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'background 0.15s',
  },
  currencyBtnErr: {
    borderColor: '#fca5a5', background: '#fef2f2',
  },
  input: {
    flex: 1, width: '100%', padding: '8px 12px',
    border: '1px solid #e2e8f0', borderRadius: '0 8px 8px 0',
    fontSize: 13, outline: 'none', transition: 'border-color 0.15s',
  },
  inputErr: {
    borderColor: '#fca5a5', background: '#fef2f2',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0,
    background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 10, padding: 4, marginTop: 4,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    zIndex: 100, width: 160,
  },
  dropItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    background: 'transparent', border: 'none', borderRadius: 6,
    padding: '8px 10px', cursor: 'pointer', transition: 'background 0.1s',
    color: '#1e293b',
  },
  dropItemActive: {
    background: '#eff6ff', color: '#2563eb',
  },
  hintRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginTop: 4, fontSize: 11,
  },
  hintLabel: {
    color: '#64748b', fontWeight: 500,
  },
  hintValue: {
    color: '#16a34a', fontWeight: 700,
  },
  hintRate: {
    color: '#94a3b8',
  },
};
