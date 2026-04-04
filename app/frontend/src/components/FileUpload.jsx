import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/button';
import { toastSuccess, toastError } from './Toast';
import { api } from '../api';

export default function FileUpload({ entityType, entityId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef();

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toastError('10MB 이하 파일만 업로드 가능합니다');
      return;
    }
    setUploading(true);
    try {
      await api.uploadFile(entityType, entityId, file);
      toastSuccess('파일이 업로드되었습니다');
      onUploaded?.();
    } catch (err) {
      toastError(err.message);
    } finally {
      setUploading(false);
      ref.current.value = '';
    }
  };

  return (
    <div>
      <input ref={ref} type="file" className="hidden" onChange={handleChange} />
      <Button variant="outline" size="sm" disabled={uploading} onClick={() => ref.current.click()}>
        <Upload className="w-4 h-4 mr-1" />
        {uploading ? '업로드 중...' : '파일 첨부'}
      </Button>
    </div>
  );
}
