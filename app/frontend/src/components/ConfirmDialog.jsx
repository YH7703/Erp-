import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info } from 'lucide-react';

const listeners = [];
export function confirmDialog({ title, message, confirmText = '확인', cancelText = '취소', danger = false }) {
  return new Promise(resolve => {
    listeners.forEach(fn => fn({ title, message, confirmText, cancelText, danger, resolve }));
  });
}

export function ConfirmDialogContainer() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const handler = (d) => setDialog(d);
    listeners.push(handler);
    return () => listeners.splice(listeners.indexOf(handler), 1);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { dialog.resolve(false); setDialog(null); }
      if (e.key === 'Enter')  { dialog.resolve(true);  setDialog(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (!dialog) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] animate-in fade-in duration-150"
      onClick={() => { dialog.resolve(false); setDialog(null); }}>
      <div className="bg-white rounded-2xl p-8 w-[380px] text-center shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}>
        <div className="text-4xl mb-3">
          {dialog.danger ? <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" /> : <Info className="h-10 w-10 text-blue-500 mx-auto" />}
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{dialog.title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-6 whitespace-pre-line">{dialog.message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => { dialog.resolve(false); setDialog(null); }}>
            {dialog.cancelText}
          </Button>
          <Button variant={dialog.danger ? 'destructive' : 'default'} className="flex-1"
            onClick={() => { dialog.resolve(true); setDialog(null); }}>
            {dialog.confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
