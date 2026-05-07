import { useMemo, useRef, useEffect, useCallback } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useEventsStore, matchSearch } from '@/store/events';
import { useUIStore } from '@/store/ui';
import { LogRow } from '@/components/LogRow';
import { InlineDetail } from '@/components/InlineDetail';
import type { DebugEvent } from '@owlscope/protocol';

export function ErrorsPanel() {
  const events = useEventsStore((s) => s.events);
  const filters = useEventsStore((s) => s.filters);
  const expanded = useEventsStore((s) => s.expandedEventIds);
  const toggleExpand = useEventsStore((s) => s.toggleExpand);
  const order = useUIStore((s) => s.order);
  const isPaused = useEventsStore((s) => s.isPaused);

  const sorted = useMemo(() => {
    const out = events.filter(
      (e) => (e.type === 'error' || e.level === 'error') && matchSearch(e, filters),
    );
    return order === 'newest-top' ? out.reverse() : out;
  }, [events, filters, order]);

  const ref = useRef<VirtuosoHandle | null>(null);
  const lastLenRef = useRef(0);

  useEffect(() => {
    if (isPaused) {
      lastLenRef.current = sorted.length;
      return;
    }
    if (sorted.length > lastLenRef.current && order === 'newest-top') {
      ref.current?.scrollToIndex({ index: 0, behavior: 'auto' });
    }
    lastLenRef.current = sorted.length;
  }, [sorted.length, order, isPaused]);

  const toggleSelect = useCallback(
    (id: string) => toggleExpand(id),
    [toggleExpand],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
        No errors captured yet.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <Virtuoso
        ref={ref}
        style={{ height: '100%' }}
        data={sorted}
        computeItemKey={(_index, ev: DebugEvent) => ev.id}
        followOutput={order === 'newest-bottom' && !isPaused ? 'auto' : false}
        itemContent={(_index, ev) => (
          <div>
            <LogRow event={ev} selected={expanded.has(ev.id)} onSelect={toggleSelect} />
            {expanded.has(ev.id) && <InlineDetail event={ev} />}
          </div>
        )}
      />
    </div>
  );
}
