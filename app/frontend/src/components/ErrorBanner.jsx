import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-5 py-4 mb-4">
      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
      <div className="flex-1">
        <div className="font-semibold text-red-600 text-sm">오류가 발생했습니다</div>
        <div className="text-xs text-red-500 mt-0.5">{message}</div>
      </div>
      {onRetry && (
        <Button variant="destructive" size="sm" onClick={onRetry}>
          <RotateCcw size={14} className="mr-1" /> 다시 시도
        </Button>
      )}
    </div>
  );
}
