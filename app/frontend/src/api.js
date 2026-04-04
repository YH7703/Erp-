const BASE = '/api';

async function request(method, path, body) {
  let res;
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 상태 또는 서버 실행 여부를 확인해주세요.');
  }

  // 응답이 JSON이 아닌 경우 (백엔드 미실행 시 Vite가 HTML 반환)
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('서버 응답 오류: 백엔드 서버가 실행 중인지 확인해주세요.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export const api = {
  // Auth
  login:          (b) => request('POST', '/auth/login', b),
  register:       (b) => request('POST', '/auth/register', b),
  getMe:          ()  => request('GET',  '/auth/me'),
  changePassword: (b) => request('PUT',  '/auth/password', b),

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

  // 견적서
  getQuotations:      (p)     => request('GET',    '/quotations' + toQS(p)),
  getQuotation:       (id)    => request('GET',    `/quotations/${id}`),
  createQuotation:    (body)  => request('POST',   '/quotations', body),
  updateQuotation:    (id, b) => request('PUT',    `/quotations/${id}`, b),
  deleteQuotation:    (id)    => request('DELETE', `/quotations/${id}`),
  convertQuotation:   (id, b) => request('POST',   `/quotations/${id}/convert`, b),

  // 인보이스
  getInvoices:    (p)     => request('GET',    '/invoices' + toQS(p)),
  getInvoice:     (id)    => request('GET',    `/invoices/${id}`),
  createInvoice:  (body)  => request('POST',   '/invoices', body),
  updateInvoice:  (id, b) => request('PUT',    `/invoices/${id}`, b),
  deleteInvoice:  (id)    => request('DELETE', `/invoices/${id}`),
  payInvoice:     (id, b) => request('POST',   `/invoices/${id}/pay`, b),

  // 거래처
  getClients:    (p)     => request('GET',    '/clients' + toQS(p)),
  getClient:     (id)    => request('GET',    `/clients/${id}`),
  createClient:  (body)  => request('POST',   '/clients', body),
  updateClient:  (id, b) => request('PUT',    `/clients/${id}`, b),
  deleteClient:  (id)    => request('DELETE', `/clients/${id}`),

  // 첨부파일
  getAttachments: (entityType, entityId) => request('GET', `/attachments/${entityType}/${entityId}`),
  uploadFile: (entityType, entityId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    return fetch(`${BASE}/attachments/${entityType}/${entityId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    }).then(r => r.ok ? r.json() : r.json().then(b => { throw new Error(b.error || '업로드 실패'); }));
  },
  deleteAttachment: (id) => request('DELETE', `/attachments/${id}`),
};

function toQS(params) {
  if (!params) return '';
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
}
