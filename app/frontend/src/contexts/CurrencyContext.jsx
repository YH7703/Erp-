import { createContext, useContext, useState } from 'react';

const CURRENCIES = {
  KRW: { symbol: '₩', name: '원', locale: 'ko-KR', rate: 1,        short: '원',  shortB: '억',  shortM: '만' },
  USD: { symbol: '$', name: 'USD', locale: 'en-US', rate: 0.00075,  short: '',    shortB: 'B',   shortM: 'K' },
  JPY: { symbol: '¥', name: 'JPY', locale: 'ja-JP', rate: 0.11,     short: '',    shortB: '億',  shortM: '万' },
  CNY: { symbol: '¥', name: 'CNY', locale: 'zh-CN', rate: 0.0054,   short: '',    shortB: '亿',  shortM: '万' },
  EUR: { symbol: '€', name: 'EUR', locale: 'de-DE', rate: 0.00069,  short: '',    shortB: 'B',   shortM: 'K' },
};

const CurrencyContext = createContext();

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('KRW');
  const cur = CURRENCIES[currency];

  const convert = (krwAmount) => {
    const v = Number(krwAmount || 0);
    return v * cur.rate;
  };

  // 축약 포맷 (테이블용)
  const fmtM = (krwAmount) => {
    const v = convert(krwAmount);
    if (currency === 'KRW') {
      if (Math.abs(v) >= 100000000) return cur.symbol + (v / 100000000).toFixed(1) + cur.shortB;
      if (Math.abs(v) >= 10000)     return cur.symbol + Math.round(v / 10000) + cur.shortM;
      return cur.symbol + v.toLocaleString(cur.locale);
    }
    if (currency === 'JPY') {
      if (Math.abs(v) >= 100000000) return cur.symbol + (v / 100000000).toFixed(1) + cur.shortB;
      if (Math.abs(v) >= 10000)     return cur.symbol + Math.round(v / 10000) + cur.shortM;
      return cur.symbol + Math.round(v).toLocaleString(cur.locale);
    }
    if (currency === 'CNY') {
      if (Math.abs(v) >= 100000000) return cur.symbol + (v / 100000000).toFixed(2) + cur.shortB;
      if (Math.abs(v) >= 10000)     return cur.symbol + Math.round(v / 10000) + cur.shortM;
      return cur.symbol + v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    // USD, EUR
    if (Math.abs(v) >= 1000000000) return cur.symbol + (v / 1000000000).toFixed(2) + cur.shortB;
    if (Math.abs(v) >= 1000)       return cur.symbol + (v / 1000).toFixed(0) + cur.shortM;
    return cur.symbol + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 전체 금액 표시 (모달/툴팁용)
  const fmtFull = (krwAmount) => {
    const v = convert(krwAmount);
    if (currency === 'KRW' || currency === 'JPY') {
      return cur.symbol + Math.round(v).toLocaleString(cur.locale) + (cur.short ? cur.short : '');
    }
    return cur.symbol + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, currencies: CURRENCIES, fmtM, fmtFull, convert, cur }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

export { CURRENCIES };
