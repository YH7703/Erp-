import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

const listeners = [];
export function toast(message, type = 'success') {
  listeners.forEach(fn => fn({ message, type, id: Date.now() }));
}
export function toastSuccess(message) { toast(message, 'success'); }
export function toastError(message)   { toast(message, 'error'); }

const TYPE_CONFIG = {
  success: { bg: 'bg-green-600', icon: CheckCircle2 },
  error:   { bg: 'bg-red-600',   icon: XCircle },
  info:    { bg: 'bg-blue-600',  icon: Info },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    listeners.push(handler);
    return () => listeners.splice(listeners.indexOf(handler), 1);
  }, []);

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2">
      {toasts.map(t => {
        const config = TYPE_CONFIG[t.type] || TYPE_CONFIG.info;
        const Icon = config.icon;
        return (
          <div key={t.id} className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium min-w-[240px] max-w-[360px] shadow-lg animate-in slide-in-from-right duration-200',
            config.bg
          )}>
            <Icon size={18} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
