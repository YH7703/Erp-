import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function AdvancedFilter({ filters, values, onChange, onReset }) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.values(values).filter(v => v !== '' && v !== null && v !== undefined).length;

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} className="relative">
        <Filter className="w-4 h-4 mr-1" />고급 필터
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeCount}</span>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
      </Button>
      {expanded && (
        <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filters.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-slate-600">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm mt-1" value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)}>
                    <option value="">전체</option>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'date' ? (
                  <Input type="date" className="mt-1" value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)} />
                ) : f.type === 'number' ? (
                  <Input type="number" className="mt-1" placeholder={f.placeholder} value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)} />
                ) : (
                  <Input className="mt-1" placeholder={f.placeholder} value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={onReset}><X className="w-3 h-3 mr-1" />필터 초기화</Button>
          </div>
        </div>
      )}
    </div>
  );
}
