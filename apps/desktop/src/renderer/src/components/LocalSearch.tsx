import { forwardRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface LocalSearchProps {
  value: string;
  onChange: (v: string) => void;
  matchCount: number;
  onClose: () => void;
}

export const LocalSearch = forwardRef<HTMLInputElement, LocalSearchProps>(
  function LocalSearch({ value, onChange, matchCount, onClose }, ref) {
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (value) {
            onChange('');
            e.preventDefault();
            e.stopPropagation();
          } else {
            onClose();
          }
        }
      };
      window.addEventListener('keydown', handler, true);
      return () => window.removeEventListener('keydown', handler, true);
    }, [value, onChange, onClose]);

    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border-b border-purple-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        <Search className="w-3 h-3 text-text-muted" />
        <input
          ref={ref}
          data-owl-local-search="true"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find in this entry…  /regex/flags"
          className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {value && (
          <span className="text-[10px] text-text-muted tabular-nums">
            {matchCount} {matchCount === 1 ? 'match' : 'matches'}
          </span>
        )}
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary"
          title="Close (Esc)"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  },
);
