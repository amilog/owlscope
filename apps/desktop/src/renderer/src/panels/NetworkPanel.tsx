import { useMemo, useRef, useEffect, useCallback } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useEventsStore, matchSearch } from '@/store/events';
import { useUIStore } from '@/store/ui';
import { NetworkRow } from '@/components/NetworkRow';
import { InlineDetail } from '@/components/InlineDetail';
import type { DebugEvent } from '@owlscope/protocol';

export function NetworkPanel() {
  const events = useEventsStore((s) => s.events);
  const filters = useEventsStore((s) => s.filters);
  const expanded = useEventsStore((s) => s.expandedEventIds);
  const toggleExpand = useEventsStore((s) => s.toggleExpand);
  const order = useUIStore((s) => s.order);
  const narrow = useUIStore((s) => s.sidebarCollapsed);
  const isPaused = useEventsStore((s) => s.isPaused);

  const sorted = useMemo(() => {
    const out = events.filter(
      (e) =>
        (e.type === 'network:request' || e.type === 'network:response') &&
        matchSearch(e, filters),
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
        No network requests captured yet.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className={`h-8 shrink-0 flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle bg-bg-surface ${
          narrow ? 'px-2' : 'px-3'
        }`}
      >
        <span className={`shrink-0 ${narrow ? 'w-[60px]' : 'w-[92px]'}`}>Time</span>
        <span className="w-12 shrink-0">Method</span>
        <span className="w-12 shrink-0">Status</span>
        {!narrow && <span className="w-32 shrink-0">Host</span>}
        <span className="flex-1 min-w-0">Path</span>
        {!narrow && <span className="w-14 shrink-0 text-right">Time</span>}
      </div>
      <div className="flex-1 min-h-0">
        <Virtuoso
          ref={ref}
          style={{ height: '100%' }}
          data={sorted}
          computeItemKey={(_index, ev: DebugEvent) => ev.id}
          followOutput={order === 'newest-bottom' && !isPaused ? 'auto' : false}
          itemContent={(_index, ev) => (
            <div>
              <NetworkRow
                event={ev}
                selected={expanded.has(ev.id)}
                onSelect={toggleSelect}
              />
              {expanded.has(ev.id) && <InlineDetail event={ev} />}
            </div>
          )}
        />
      </div>
    </div>
  );
}
