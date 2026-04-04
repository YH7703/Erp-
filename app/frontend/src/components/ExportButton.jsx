import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { toastError } from './Toast';

export default function ExportButton({ type }) {
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem('token');

  const download = async (format) => {
    setOpen(false);
    try {
      const res = await fetch(`/api/export/${type}/${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || '다운로드 실패');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toastError(e.message);
    }
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Download className="w-4 h-4 mr-1" />내보내기
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 w-40">
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => download('excel')}
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />엑셀 다운로드
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => download('pdf')}
            >
              <FileText className="w-4 h-4 text-red-600" />PDF 다운로드
            </button>
          </div>
        </>
      )}
    </div>
  );
}
