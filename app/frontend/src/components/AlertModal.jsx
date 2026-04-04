import { useState, useEffect } from 'react';

// 전역 알림 이벤트 버스
const listeners = [];

export function alertModal({ title, message, type = 'error' }) {
  return new Promise(resolve => {
    listeners.forEach(fn => fn({ title, message, type, resolve, id: Date.now() }));
  });
}

// 편의 함수
export function alertError(title, message) { return alertModal({ title, message, type: 'error' }); }
export function alertWarning(title, message) { return alertModal({ title, message, type: 'warning' }); }
export function alertInfo(title, message) { return alertModal({ title, message, type: 'info' }); }

const TYPE_CONFIG = {
  error:   { icon: '🚨', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: '오류' },
  warning: { icon: '⚠️', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: '경고' },
  info:    { icon: 'ℹ️', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', label: '안내' },
};

export function AlertModalContainer() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const handler = (alert) => setAlerts(prev => [...prev, alert]);
    listeners.push(handler);
    return () => listeners.splice(listeners.indexOf(handler), 1);
  }, []);

  // ESC로 닫기
  useEffect(() => {
    if (alerts.length === 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        const current = alerts[0];
        if (current) {
          current.resolve();
          setAlerts(prev => prev.slice(1));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alerts]);

  if (alerts.length === 0) return null;

  const current = alerts[0];
  const cfg = TYPE_CONFIG[current.type] || TYPE_CONFIG.error;

  const handleClose = () => {
    current.resolve();
    setAlerts(prev => prev.slice(1));
  };

  return (
    <div style={s.overlay} onClick={handleClose}>
      <div style={s.box} onClick={e => e.stopPropagation()}>
        {/* 상단 아이콘 + 타입 라벨 */}
        <div style={{ ...s.typeBanner, background: cfg.bg, borderColor: cfg.border }}>
          <span style={{ fontSize: 36 }}>{cfg.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color, letterSpacing: 1 }}>{cfg.label}</span>
        </div>

        {/* 제목 */}
        <h3 style={{ ...s.title, color: cfg.color }}>{current.title}</h3>

        {/* 메시지 */}
        <div style={s.message}>{current.message}</div>

        {/* 남은 알림 수 */}
        {alerts.length > 1 && (
          <div style={s.remaining}>
            +{alerts.length - 1}건의 추가 알림이 있습니다
          </div>
        )}

        {/* 타임스탬프 */}
        <div style={s.timestamp}>
          {new Date(current.id).toLocaleTimeString('ko-KR')}
        </div>

        {/* 확인 버튼 */}
        <button style={{ ...s.btn, background: cfg.color }} onClick={handleClose}>
          확인
        </button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 3000, animation: 'fadeIn 0.15s',
  },
  box: {
    background: '#fff', borderRadius: 16, padding: '0 32px 28px',
    width: 420, textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    animation: 'scaleIn 0.15s',
    overflow: 'hidden',
  },
  typeBanner: {
    margin: '0 -32px', padding: '24px 0 16px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    borderBottom: '2px solid', marginBottom: 20,
  },
  title: {
    fontSize: 18, fontWeight: 700, marginBottom: 12,
  },
  message: {
    fontSize: 14, color: '#475569', lineHeight: 1.6,
    marginBottom: 20, whiteSpace: 'pre-line',
  },
  remaining: {
    fontSize: 12, color: '#94a3b8', marginBottom: 12,
    background: '#f8fafc', padding: '6px 12px', borderRadius: 6,
    display: 'inline-block',
  },
  timestamp: {
    fontSize: 11, color: '#cbd5e1', marginBottom: 16,
  },
  btn: {
    width: '100%', padding: '12px 0', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
};
