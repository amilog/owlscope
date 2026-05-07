import { useState, memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const STRING_CLAMP = 240;
const ARRAY_PAGE = 50;

interface JsonViewProps {
  value: unknown;
  initiallyExpanded?: boolean;
  depthExpand?: number;
  rootKey?: string;
}

interface NodeProps {
  value: unknown;
  depth: number;
  depthExpand: number;
  keyName?: string;
  indexName?: number;
  isLast?: boolean;
}

function Punct({ children }: { children: string }) {
  return <span className="text-text-muted">{children}</span>;
}

function Key({ name }: { name: string }) {
  return <span className="text-owl-warn">"{name}"</span>;
}

function IndexLabel({ index }: { index: number }) {
  return <span className="text-text-muted/70 mr-1">{index}</span>;
}

const URL_RE = /^https?:\/\//i;

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-text-muted italic">null</span>;
  if (value === undefined) return <span className="text-text-muted italic">undefined</span>;
  const t = typeof value;
  if (t === 'string') {
    const s = value as string;
    return <ClampString text={s} />;
  }
  if (t === 'number' || t === 'bigint') {
    return <span className="text-owl-info font-medium">{String(value)}</span>;
  }
  if (t === 'boolean') {
    return <span className="text-owl-debug font-medium">{String(value)}</span>;
  }
  return <span className="text-text-secondary">{String(value)}</span>;
}

function ClampString({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isUrl = URL_RE.test(text);
  const colorClass = isUrl ? 'text-owl-info underline decoration-owl-info/30' : 'text-owl-success';
  if (text.length <= STRING_CLAMP) {
    return <span className={`${colorClass} break-all`}>"{text}"</span>;
  }
  return (
    <span className={`${colorClass} break-all`}>
      "{expanded ? text : text.slice(0, STRING_CLAMP) + '…'}"
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-soft text-text-muted hover:text-text-primary"
      >
        {expanded ? 'collapse' : `show ${text.length - STRING_CLAMP} more`}
      </button>
    </span>
  );
}

/** A short summary of a collapsed value — ".id: 12383, sale_type: "sale" …" —
 *  so the user can recognise the row without expanding. */
function previewOf(value: unknown, max = 80): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') {
    if (typeof value === 'string') {
      const s = value.length > 30 ? `${value.slice(0, 30)}…` : value;
      return JSON.stringify(s);
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    const inner = value
      .slice(0, 3)
      .map((v) => previewOf(v, 24))
      .join(', ');
    const more = value.length > 3 ? `, +${value.length - 3}` : '';
    return inner ? `${inner}${more}` : '';
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const parts: string[] = [];
  for (const [k, v] of entries.slice(0, 3)) {
    let val: string;
    if (v === null) val = 'null';
    else if (typeof v === 'object') val = Array.isArray(v) ? `[…${(v as unknown[]).length}]` : '{…}';
    else if (typeof v === 'string')
      val = JSON.stringify(v.length > 24 ? `${v.slice(0, 24)}…` : v);
    else val = String(v);
    parts.push(`${k}: ${val}`);
  }
  let joined = parts.join(', ');
  const more = entries.length > 3 ? `, +${entries.length - 3}` : '';
  joined = `${joined}${more}`;
  if (joined.length > max) joined = joined.slice(0, max) + '…';
  return joined;
}

function Toggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center justify-center w-3.5 h-3.5 -ml-3.5 mr-1 text-text-muted hover:text-text-primary align-middle"
    >
      {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
    </button>
  );
}

function Label({
  keyName,
  indexName,
}: {
  keyName?: string;
  indexName?: number;
}) {
  if (keyName !== undefined) {
    return (
      <>
        <Key name={keyName} />
        <Punct>{': '}</Punct>
      </>
    );
  }
  if (indexName !== undefined) {
    return <IndexLabel index={indexName} />;
  }
  return null;
}

function ObjectNode({ value, depth, depthExpand, keyName, indexName, isLast }: NodeProps) {
  const obj = value as Record<string, unknown>;
  const entries = Object.entries(obj);
  const [open, setOpen] = useState(depth < depthExpand);

  if (entries.length === 0) {
    return (
      <div className="flex items-baseline flex-wrap">
        <Label keyName={keyName} indexName={indexName} />
        <span className="text-text-muted">{'{}'}</span>
        {!isLast && <Punct>,</Punct>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex items-baseline flex-wrap">
        <Toggle open={false} onClick={() => setOpen(true)} />
        <Label keyName={keyName} indexName={indexName} />
        <span
          className="cursor-pointer hover:bg-soft rounded px-1 -mx-1"
          onClick={() => setOpen(true)}
        >
          <span className="text-text-muted">{'{ '}</span>
          <span className="text-text-secondary/80">{previewOf(obj)}</span>
          <span className="text-text-muted">{' }'}</span>
          <span className="text-text-muted/60 ml-1">· {entries.length} keys</span>
        </span>
        {!isLast && <Punct>,</Punct>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline flex-wrap">
        <Toggle open onClick={() => setOpen(false)} />
        <Label keyName={keyName} indexName={indexName} />
        <Punct>{'{'}</Punct>
        <span className="text-text-muted/60 ml-2 text-[10px]">{entries.length} keys</span>
      </div>
      <div className="ml-3 border-l border-border-subtle/40 pl-2">
        {entries.map(([k, v], i) => (
          <Node
            key={k}
            keyName={k}
            value={v}
            depth={depth + 1}
            depthExpand={depthExpand}
            isLast={i === entries.length - 1}
          />
        ))}
      </div>
      <div>
        <Punct>{isLast ? '}' : '},'}</Punct>
      </div>
    </div>
  );
}

function ArrayNode({ value, depth, depthExpand, keyName, indexName, isLast }: NodeProps) {
  const arr = value as unknown[];
  const [open, setOpen] = useState(depth < depthExpand);
  const [shown, setShown] = useState(ARRAY_PAGE);

  if (arr.length === 0) {
    return (
      <div className="flex items-baseline flex-wrap">
        <Label keyName={keyName} indexName={indexName} />
        <span className="text-text-muted">[]</span>
        {!isLast && <Punct>,</Punct>}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex items-baseline flex-wrap">
        <Toggle open={false} onClick={() => setOpen(true)} />
        <Label keyName={keyName} indexName={indexName} />
        <span
          className="cursor-pointer hover:bg-soft rounded px-1 -mx-1"
          onClick={() => setOpen(true)}
        >
          <span className="text-text-muted">{'[ '}</span>
          <span className="text-text-secondary/80">{previewOf(arr)}</span>
          <span className="text-text-muted">{' ]'}</span>
          <span className="text-text-muted/60 ml-1">· {arr.length} items</span>
        </span>
        {!isLast && <Punct>,</Punct>}
      </div>
    );
  }

  const visible = arr.slice(0, shown);
  const remaining = arr.length - shown;

  return (
    <div>
      <div className="flex items-baseline flex-wrap">
        <Toggle open onClick={() => setOpen(false)} />
        <Label keyName={keyName} indexName={indexName} />
        <Punct>[</Punct>
        <span className="text-text-muted/60 ml-2 text-[10px]">{arr.length} items</span>
      </div>
      <div className="ml-3 border-l border-border-subtle/40 pl-2">
        {visible.map((v, i) => (
          <Node
            key={i}
            indexName={i}
            value={v}
            depth={depth + 1}
            depthExpand={depthExpand}
            isLast={i === visible.length - 1 && remaining <= 0}
          />
        ))}
        {remaining > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShown((n) => n + ARRAY_PAGE);
            }}
            className="mt-1 text-[10px] px-2 py-0.5 rounded bg-soft text-text-muted hover:text-text-primary"
          >
            show {Math.min(remaining, ARRAY_PAGE)} more · {remaining} left
          </button>
        )}
      </div>
      <div>
        <Punct>{isLast ? ']' : '],'}</Punct>
      </div>
    </div>
  );
}

function Node({ value, depth, depthExpand, keyName, indexName, isLast }: NodeProps) {
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      return (
        <ArrayNode
          value={value}
          depth={depth}
          depthExpand={depthExpand}
          keyName={keyName}
          indexName={indexName}
          isLast={isLast}
        />
      );
    }
    return (
      <ObjectNode
        value={value}
        depth={depth}
        depthExpand={depthExpand}
        keyName={keyName}
        indexName={indexName}
        isLast={isLast}
      />
    );
  }

  return (
    <div className="flex items-baseline flex-wrap gap-1">
      <Label keyName={keyName} indexName={indexName} />
      <Primitive value={value} />
      {!isLast && <Punct>,</Punct>}
    </div>
  );
}

function JsonViewImpl({
  value,
  initiallyExpanded = true,
  depthExpand = 2,
  rootKey,
}: JsonViewProps) {
  return (
    <div className="font-mono text-[11px] leading-relaxed text-text-primary">
      <Node
        value={value}
        depth={initiallyExpanded ? 0 : depthExpand}
        depthExpand={depthExpand}
        keyName={rootKey}
        isLast
      />
    </div>
  );
}

export const JsonView = memo(JsonViewImpl);
