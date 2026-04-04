import { useState, useEffect } from 'react';
import { Download, Trash2, File } from 'lucide-react';
import { Button } from './ui/button';
import { toastSuccess, toastError } from './Toast';
import { confirmDialog } from './ConfirmDialog';
import { api } from '../api';

export default function FileList({ entityType, entityId, refreshKey }) {
  const [files, setFiles] = useState([]);

  const load = async () => {
    if (!entityId) return;
    try {
      setFiles(await api.getAttachments(entityType, entityId));
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => { load(); }, [entityType, entityId, refreshKey]);

  const handleDownload = async (f) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/attachments/download/${f.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || '다운로드 실패');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toastError(e.message);
    }
  };

  const handleDelete = async (f) => {
    const ok = await confirmDialog({
      title: '파일 삭제',
      message: `"${f.file_name}"을(를) 삭제하시겠습니까?`,
      danger: true
    });
    if (!ok) return;
    try {
      await api.deleteAttachment(f.id);
      toastSuccess('삭제되었습니다');
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const fmtSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  if (!files.length) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500">첨부파일 ({files.length})</p>
      {files.map(f => (
        <div key={f.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-slate-50">
          <File className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate flex-1">{f.file_name}</span>
          <span className="text-xs text-slate-400">{fmtSize(f.file_size)}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownload(f)}>
            <Download className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(f)}>
            <Trash2 className="w-3 h-3 text-red-400" />
          </Button>
        </div>
      ))}
    </div>
  );
}
