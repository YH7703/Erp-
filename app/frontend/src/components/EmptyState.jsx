import { Button } from '@/components/ui/button';

export default function EmptyState({ icon = '📭', title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-muted-foreground">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="text-base font-semibold text-slate-600 mb-2">{title}</div>
      {description && <div className="text-sm text-muted-foreground mb-5 text-center max-w-xs">{description}</div>}
      {action && onAction && (
        <Button onClick={onAction}>{action}</Button>
      )}
    </div>
  );
}
