const BASE = '/api';

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 상태 또는 서버 실행 여부를 확인해주세요.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export const api = {
  // Dashboard
  getStats:    ()  => request('GET', '/dashboard/stats'),
  getRoi:      ()  => request('GET', '/dashboard/roi'),
  getMonthly:  ()  => request('GET', '/dashboard/monthly'),
  getByType:   ()  => request('GET', '/dashboard/by-type'),
  getExpiring: ()  => request('GET', '/dashboard/expiring'),

  // 매출계약
  getSalesContracts: (p)    => request('GET',    '/sales-contracts' + toQS(p)),
  getSalesContract:  (id)   => request('GET',    `/sales-contracts/${id}`),
  createSales:       (body) => request('POST',   '/sales-contracts', body),
  updateSales:       (id, b)=> request('PUT',    `/sales-contracts/${id}`, b),
  deleteSales:       (id)   => request('DELETE', `/sales-contracts/${id}`),

  // 매입계약
  getPurchaseContracts: (p)    => request('GET',    '/purchase-contracts' + toQS(p)),
  getPurchaseContract:  (id)   => request('GET',    `/purchase-contracts/${id}`),
  createPurchase:       (body) => request('POST',   '/purchase-contracts', body),
  updatePurchase:       (id, b)=> request('PUT',    `/purchase-contracts/${id}`, b),
  deletePurchase:       (id)   => request('DELETE', `/purchase-contracts/${id}`),

  // 영업사원
  getSalespeople:     ()       => request('GET',    '/salespeople'),
  createSalesperson:  (body)   => request('POST',   '/salespeople', body),
  updateSalesperson:  (id, b)  => request('PUT',    `/salespeople/${id}`, b),
  deleteSalesperson:  (id)     => request('DELETE', `/salespeople/${id}`),

  // 성과
  getPerformance: (p)      => request('GET', '/performance' + toQS(p)),
  getPersonPerf:  (id, p)  => request('GET', `/performance/${id}` + toQS(p)),
};

function toQS(params) {
  if (!params) return '';
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
}
