import { useMemo, useRef, useEffect, useCallback } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useEventsStore, matchSearch } from '@/store/events';
import { useUIStore } from '@/store/ui';
import { InlineDetail } from '@/components/InlineDetail';
import type { DebugEvent } from '@owlscope/protocol';

interface PerfPayload {
  entryType?: string;
  name?: string;
  startTime?: number;
  duration?: number;
  initiatorType?: string;
  transferSize?: number;
  // Flutter style
  frames?: number;
  avgBuildMs?: string;
  avgRasterMs?: string;
  maxBuildMs?: string;
  maxRasterMs?: string;
  slowFrames?: number;
  windowMs?: number;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function summary(p: PerfPayload): string {
  if (p.frames !== undefined) {
    return `${p.frames} frames · build ${p.avgBuildMs ?? '?'}ms · raster ${p.avgRasterMs ?? '?'}ms${
      p.slowFrames ? ` · ${p.slowFrames} slow` : ''
    }`;
  }
  return `${p.entryType ?? '?'} · ${p.name ?? ''}`;
}

function PerfRow({
  event,
  selected,
  onSelect,
}: {
  event: DebugEvent;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const p = event.payload as PerfPayload;
  const isSlow =
    (p.duration ?? 0) > 100 ||
    (typeof p.maxBuildMs === 'string' && parseFloat(p.maxBuildMs) > 16) ||
    (typeof p.maxRasterMs === 'string' && parseFloat(p.maxRasterMs) > 16) ||
    (p.slowFrames ?? 0) > 0;

  const rowClass = [
    'flex items-center gap-2 h-8 px-3 text-[11px] cursor-pointer border-b border-border-subtle/40',
    selected ? 'row-selected' : 'row-hover',
    isSlow ? 'row-warn' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass} onClick={() => onSelect(event.id)}>
      <span className="w-[92px] shrink-0 text-text-muted tabular-nums">
        {formatTime(event.timestamp)}
      </span>
      <span className="w-24 shrink-0 text-owl-info">
        {p.entryType ?? (p.frames !== undefined ? 'frame' : '?')}
      </span>
      <span className="flex-1 truncate text-text-primary">{summary(p)}</span>
      {p.duration !== undefined && (
        <span className="w-16 shrink-0 text-right text-text-muted tabular-nums">
          {Math.round(p.duration)}ms
        </span>
      )}
    </div>
  );
}

export function PerformancePanel() {
  const events = useEventsStore((s) => s.events);
  const filters = useEventsStore((s) => s.filters);
  const expanded = useEventsStore((s) => s.expandedEventIds);
  const toggleExpand = useEventsStore((s) => s.toggleExpand);
  const order = useUIStore((s) => s.order);
  const isPaused = useEventsStore((s) => s.isPaused);

  const sorted = useMemo(() => {
    const out = events.filter((e) => e.type === 'performance' && matchSearch(e, filters));
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
        No performance entries captured yet.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="h-8 shrink-0 flex items-center gap-2 px-3 text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle bg-bg-surface">
        <span className="w-[92px] shrink-0">Time</span>
        <span className="w-24 shrink-0">Type</span>
        <span className="flex-1">Detail</span>
        <span className="w-16 shrink-0 text-right">Duration</span>
      </div>
      <div className="flex-1 min-h-0">
        <Virtuoso
          ref={ref}
          style={{ height: '100%' }}
          data={sorted}
          computeItemKey={(_index, ev) => ev.id}
          followOutput={order === 'newest-bottom' && !isPaused ? 'auto' : false}
          itemContent={(_index, ev) => (
            <div>
              <PerfRow event={ev} selected={expanded.has(ev.id)} onSelect={toggleSelect} />
              {expanded.has(ev.id) && <InlineDetail event={ev} />}
            </div>
          )}
        />
      </div>
    </div>
  );
}
