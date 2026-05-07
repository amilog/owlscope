import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { DebugEvent } from '@owlscope/protocol';
import { JsonView } from './JsonView';
import { LocalSearch } from './LocalSearch';
import { prettyDartLike } from '@/lib/dartFormat';
import { countMatches, highlight } from '@/lib/highlight';

interface NetworkPayload {
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  ok?: boolean;
  duration?: number;
  startedAt?: number;
  error?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
}

function prettyJson(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Try to parse a JSON-shaped string into a structured value. Returns the
 *  parsed value if successful AND the result is an object/array; otherwise
 *  returns the original input. */
function maybeParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return value;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === 'object') return parsed;
  } catch {
    /* not JSON */
  }
  return value;
}

/** Best-effort indentation for a JSON-shaped string that won't `JSON.parse`
 *  (typically because it was truncated server-side or by the SDK's body cap).
 *  Walks the text, tracks string-state so commas inside values aren't broken,
 *  and inserts newlines + 2-space indent at structural punctuation. Also
 *  decodes the `\uXXXX` escapes so Azerbaijani / Cyrillic / etc. read normally
 *  instead of as `əı…`. */
function tolerantPrettifyJson(text: string): string {
  // First decode \uXXXX so the result is human-readable.
  let decoded: string;
  try {
    decoded = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  } catch {
    decoded = text;
  }

  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let escape = false;
  const indent = () => '  '.repeat(depth);

  for (let i = 0; i < decoded.length; i++) {
    const ch = decoded[i];
    if (escape) {
      out.push(ch);
      escape = false;
      continue;
    }
    if (ch === '\\') {
      out.push(ch);
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      out.push(ch);
      continue;
    }
    if (inStr) {
      out.push(ch);
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth++;
      out.push(ch);
      out.push('\n');
      out.push(indent());
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      out.push('\n');
      out.push(indent());
      out.push(ch);
      continue;
    }
    if (ch === ',') {
      out.push(ch);
      out.push('\n');
      out.push(indent());
      continue;
    }
    if (ch === ':') {
      out.push(': ');
      continue;
    }
    // Skip raw whitespace between tokens — we manage layout ourselves.
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    if (ch === ' ' && (out[out.length - 1] === '\n' || out[out.length - 1] === ' ')) {
      continue;
    }
    out.push(ch);
  }
  return out.join('');
}

function statusColor(status?: number, error?: string): string {
  if (error || status === 0) return 'text-owl-error';
  if (!status) return 'text-text-muted';
  if (status >= 200 && status < 300) return 'text-owl-success';
  if (status >= 300 && status < 400) return 'text-owl-info';
  if (status >= 400 && status < 500) return 'text-owl-warn';
  return 'text-owl-error';
}

function buildCurl(p: NetworkPayload): string {
  const parts: string[] = ['curl'];
  if (p.method && p.method !== 'GET') parts.push(`-X ${p.method}`);
  if (p.requestHeaders) {
    for (const [k, v] of Object.entries(p.requestHeaders)) {
      parts.push(`-H ${JSON.stringify(`${k}: ${v}`)}`);
    }
  }
  if (p.requestBody != null && p.requestBody !== '') {
    const body = typeof p.requestBody === 'string' ? p.requestBody : JSON.stringify(p.requestBody);
    parts.push(`--data ${JSON.stringify(body)}`);
  }
  parts.push(JSON.stringify(p.url ?? ''));
  return parts.join(' \\\n  ');
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => {});
      }}
      className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-border-subtle bg-bg-elevated text-text-secondary hover:bg-soft"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function SectionHeader({ label, copyText }: { label: string; copyText?: string }) {
  return (
    <div className="px-3 py-1.5 flex items-center justify-between bg-bg-elevated/60 border-b border-border-subtle/60">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      {copyText !== undefined && copyText !== '' && (
        <CopyButton text={copyText} label="Copy" />
      )}
    </div>
  );
}

function headersToText(data: Record<string, string> | undefined): string {
  if (!data) return '';
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function KeyValue({
  data,
  empty,
  query = '',
}: {
  data: Record<string, string> | undefined;
  empty: string;
  query?: string;
}) {
  const entries = data ? Object.entries(data) : [];
  if (entries.length === 0) {
    return <div className="px-3 py-2 text-text-muted text-[11px]">{empty}</div>;
  }
  return (
    <div className="text-[11px] divide-y divide-border-subtle/40">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 px-3 py-1">
          <span className="w-32 shrink-0 text-text-muted">{highlight(k, query)}</span>
          <span className="flex-1 break-all text-text-primary">{highlight(v, query)}</span>
        </div>
      ))}
    </div>
  );
}

// Above ~80k chars React+browser layout starts to lag on every keystroke and
// scroll, even just inside a <pre>. We render the first chunk and let the
// user opt into the rest.
const TEXT_CHUNK = 80_000;

function BodyView({
  body,
  empty,
  showCopy = true,
  label = 'Body',
  query = '',
}: {
  body: unknown;
  empty: string;
  showCopy?: boolean;
  label?: string;
  query?: string;
}) {
  const resolved = useMemo(() => maybeParseJson(body), [body]);
  const isStructured = typeof resolved === 'object' && resolved !== null;
  const isTruncatedJson =
    !isStructured &&
    typeof resolved === 'string' &&
    resolved.length > 0 &&
    (resolved.trimStart().startsWith('{') || resolved.trimStart().startsWith('[')) &&
    body === resolved;

  const [showFull, setShowFull] = useState(false);

  // Raw body string (untouched). Cheap.
  const rawText = useMemo(() => {
    if (body == null || body === '') return '';
    if (isStructured) return ''; // tree path doesn't use rawText
    return typeof resolved === 'string' ? resolved : String(resolved);
  }, [body, resolved, isStructured]);

  const longText = !isStructured && rawText.length > TEXT_CHUNK;
  const visibleRaw = longText && !showFull ? rawText.slice(0, TEXT_CHUNK) : rawText;

  // What we actually render. tolerantPrettifyJson is expensive on a 1 MiB
  // string (hundreds of ms — long enough to make the first paint of the
  // detail look blank). By formatting only the visible chunk, the first
  // paint stays cheap; "show more" pays the cost on demand.
  const visibleText = useMemo(() => {
    if (isStructured) return '';
    if (isTruncatedJson) return tolerantPrettifyJson(visibleRaw);
    return visibleRaw;
  }, [isStructured, isTruncatedJson, visibleRaw]);

  // Text for clipboard. JSON.stringify is fast; we deliberately skip
  // tolerantPrettifyJson on the full body so Copy doesn't hang. Raw escape
  // sequences in the clipboard are fine — the user can re-format in their
  // editor.
  const copyText = useMemo(() => {
    if (body == null || body === '') return '';
    if (isStructured) return prettyJson(resolved);
    return rawText;
  }, [body, resolved, isStructured, rawText]);

  // Root collapse depth: large objects start more collapsed so the first
  // render doesn't have to mount thousands of <Node /> components.
  const depthExpand = useMemo(() => {
    if (!isStructured) return 2;
    const root = resolved as object;
    const size = Array.isArray(root) ? root.length : Object.keys(root).length;
    if (size > 200) return 0;
    if (size > 40) return 1;
    return 2;
  }, [resolved, isStructured]);

  if (body == null || body === '') {
    return (
      <>
        {showCopy && <SectionHeader label={label} />}
        <div className="px-3 py-2 text-text-muted text-[11px]">{empty}</div>
      </>
    );
  }

  return (
    <>
      {showCopy && <SectionHeader label={label} copyText={copyText} />}
      {isTruncatedJson && (
        <div className="px-3 py-1.5 text-[10px] text-owl-warn bg-owl-warn/10 border-b border-owl-warn/20">
          Body is too large or was truncated — showing best-effort formatted
          text. Increase <code className="font-mono">_maxBodyBytes</code> in
          the SDK to capture more.
        </div>
      )}
      <div className="px-3 py-2 max-h-[360px] overflow-auto">
        {isStructured ? (
          query ? (
            <pre className="text-[11px] whitespace-pre-wrap break-words text-text-primary leading-relaxed">
{highlight(copyText, query)}
            </pre>
          ) : (
            <JsonView value={resolved} depthExpand={depthExpand} />
          )
        ) : (
          <>
            <pre className="text-[11px] whitespace-pre-wrap break-words text-text-primary leading-relaxed">
{query ? highlight(visibleText, query) : visibleText}
            </pre>
            {longText && !showFull && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFull(true);
                }}
                className="mt-2 text-[10px] px-2 py-1 rounded bg-soft text-text-muted hover:text-text-primary"
              >
                show {((rawText.length - TEXT_CHUNK) / 1024).toFixed(0)}KB more
              </button>
            )}
            {longText && showFull && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFull(false);
                }}
                className="mt-2 text-[10px] px-2 py-1 rounded bg-soft text-text-muted hover:text-text-primary"
              >
                collapse
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

interface StatePayload {
  provider?: { name?: string; argument?: string; family?: string };
  previous?: unknown;
  next?: unknown;
  type?: string;
}

function StateValue({ value }: { value: unknown }) {
  if (value == null) return <span className="text-text-muted text-[11px]">–</span>;
  if (typeof value === 'object') {
    return <JsonView value={value} depthExpand={2} />;
  }
  if (typeof value === 'string') {
    return (
      <pre className="text-[11px] whitespace-pre-wrap break-words text-text-primary">
{value}
      </pre>
    );
  }
  return (
    <span className="text-[11px] text-text-primary">{String(value)}</span>
  );
}

function StateDetail({ event }: { event: DebugEvent }) {
  const p = event.payload as StatePayload;
  const previousText = prettyJson(p.previous);
  const nextText = prettyJson(p.next);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-border-subtle/60 flex items-center gap-3 text-[11px]">
        <span className="text-owl-event font-medium">{event.type}</span>
        <span className="flex-1 truncate text-text-primary">
          {p.provider?.name ?? p.type ?? 'state'}
          {p.provider?.argument && (
            <span className="text-text-muted"> ({p.provider.argument})</span>
          )}
        </span>
        <span className="text-text-muted tabular-nums">
          {new Date(event.timestamp).toISOString().slice(11, 23)}
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border-subtle/60">
        <div className="min-w-0">
          <SectionHeader label="Previous" copyText={previousText} />
          <div className="px-3 py-2 max-h-[320px] overflow-auto">
            <StateValue value={p.previous} />
          </div>
        </div>
        <div className="min-w-0">
          <SectionHeader label="Next" copyText={nextText} />
          <div className="px-3 py-2 max-h-[320px] overflow-auto">
            <StateValue value={p.next} />
          </div>
        </div>
      </div>
    </div>
  );
}

type NetworkTab = 'headers' | 'request' | 'response' | 'timing';

function NetworkDetail({ event, query = '' }: { event: DebugEvent; query?: string }) {
  const [tab, setTab] = useState<NetworkTab>('response');
  const p = event.payload as NetworkPayload;
  const curl = useMemo(() => buildCurl(p), [p]);

  const tabs: { key: NetworkTab; label: string }[] = [
    { key: 'headers', label: 'Headers' },
    { key: 'request', label: 'Request' },
    { key: 'response', label: 'Response' },
    { key: 'timing', label: 'Timing' },
  ];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-border-subtle/60 flex items-center gap-3 text-[11px]">
        <span className="text-owl-network font-medium">{p.method ?? 'GET'}</span>
        <span className={`tabular-nums ${statusColor(p.status, p.error)}`}>
          {p.error ? 'ERR' : (p.status ?? '–')}
        </span>
        {p.statusText && <span className="text-text-muted">{p.statusText}</span>}
        <span className="flex-1 text-text-muted truncate">{p.url}</span>
        <span className="text-text-muted tabular-nums">
          {p.duration !== undefined ? `${Math.round(p.duration)}ms` : ''}
        </span>
        <CopyButton text={curl} label="cURL" />
      </div>

      <div className="flex border-b border-border-subtle/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={(e) => {
              e.stopPropagation();
              setTab(t.key);
            }}
            className={`text-[11px] px-3 py-1.5 transition-colors ${
              tab === t.key
                ? 'text-purple-400 border-b border-purple-500'
                : 'text-text-secondary hover:bg-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'headers' && (
          <>
            <SectionHeader
              label="Request headers"
              copyText={headersToText(p.requestHeaders)}
            />
            <KeyValue
              data={p.requestHeaders}
              empty="No request headers."
              query={query}
            />
            <SectionHeader
              label="Response headers"
              copyText={headersToText(p.responseHeaders)}
            />
            <KeyValue
              data={p.responseHeaders}
              empty="No response headers."
              query={query}
            />
          </>
        )}
        {tab === 'request' && (
          <BodyView
            body={p.requestBody}
            empty="No request body."
            label="Request body"
            query={query}
          />
        )}
        {tab === 'response' &&
          (p.error ? (
            <>
              <SectionHeader label="Error" copyText={p.error} />
              <div className="px-3 py-2 text-owl-error text-[11px]">
                {highlight(p.error, query)}
              </div>
            </>
          ) : (
            <BodyView
              body={p.responseBody}
              empty="No response body."
              label="Response body"
              query={query}
            />
          ))}
        {tab === 'timing' && (
          <div className="px-3 py-2 text-[11px] space-y-1 text-text-secondary">
            {p.startedAt !== undefined && (
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">started</span>
                <span className="tabular-nums">{new Date(p.startedAt).toISOString()}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-text-muted">duration</span>
              <span className="tabular-nums">
                {p.duration !== undefined ? `${Math.round(p.duration)}ms` : '–'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StringArg({ text, query }: { text: string; query: string }) {
  const looksStructured = useMemo(
    () => /[{\[][^}\]]*[:,][^{}\[\]]*[}\]]/.test(text) && text.length > 80,
    [text],
  );
  const [pretty, setPretty] = useState(looksStructured);
  const display = pretty ? prettyDartLike(text) : text;

  return (
    <div className="relative group">
      {looksStructured && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPretty((v) => !v);
          }}
          className="absolute right-0 top-0 px-1.5 py-0.5 text-[10px] rounded bg-soft text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {pretty ? 'raw' : 'format'}
        </button>
      )}
      <pre className="text-[11px] whitespace-pre-wrap break-words text-text-primary leading-relaxed pr-12">
{highlight(display, query)}
      </pre>
    </div>
  );
}

function ConsoleArgs({ args, query }: { args: unknown[]; query: string }) {
  return (
    <div className="space-y-2">
      {args.map((arg, i) => {
        const key = `arg-${i}`;
        if (typeof arg === 'string') {
          return <StringArg key={key} text={arg} query={query} />;
        }
        if (arg !== null && typeof arg === 'object') {
          // Json tree highlighting is complex; for now show as formatted text
          // when a query is active so users can find matches.
          if (query) {
            return (
              <pre
                key={key}
                className="text-[11px] whitespace-pre-wrap break-words text-text-primary leading-relaxed"
              >
{highlight(prettyJson(arg), query)}
              </pre>
            );
          }
          return <JsonView key={key} value={arg} depthExpand={2} />;
        }
        return (
          <span key={key} className="text-text-secondary text-[11px]">
            {highlight(String(arg), query)}
          </span>
        );
      })}
    </div>
  );
}

function GenericDetail({
  event,
  query,
}: {
  event: DebugEvent;
  query: string;
}) {
  const json = useMemo(() => prettyJson(event.payload), [event]);

  const isConsole = event.type === 'console';
  const consoleArgs =
    isConsole && event.payload && typeof event.payload === 'object'
      ? ((event.payload as { args?: unknown[] }).args ?? null)
      : null;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-border-subtle/60 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
        <span>
          <span className="text-text-muted">time </span>
          <span className="tabular-nums">{new Date(event.timestamp).toISOString()}</span>
        </span>
        <span>
          <span className="text-text-muted">source </span>
          <span>{event.source}</span>
        </span>
        {event.clientId && (
          <span>
            <span className="text-text-muted">client </span>
            <span>{event.clientId.slice(0, 8)}</span>
          </span>
        )}
        {event.meta?.duration !== undefined && (
          <span>
            <span className="text-text-muted">duration </span>
            <span>{Math.round(event.meta.duration)}ms</span>
          </span>
        )}
        <span className="ml-auto">
          <CopyButton text={json} label="Copy JSON" />
        </span>
      </div>

      <div className="px-3 py-2 max-h-[360px] overflow-auto">
        {consoleArgs && Array.isArray(consoleArgs) && consoleArgs.length > 0 ? (
          <ConsoleArgs args={consoleArgs} query={query} />
        ) : query ? (
          <pre className="text-[11px] whitespace-pre-wrap break-words text-text-primary leading-relaxed">
{highlight(json, query)}
          </pre>
        ) : (
          <JsonView value={event.payload} depthExpand={2} />
        )}
      </div>

      {event.meta?.stackTrace && (
        <div className="border-t border-border-subtle/60">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted">
            Stack
          </div>
          <pre className="px-3 pb-2 text-[10px] whitespace-pre-wrap text-text-muted max-h-[240px] overflow-auto">
{event.meta.stackTrace}
          </pre>
        </div>
      )}
    </div>
  );
}

export function InlineDetail({ event }: { event: DebugEvent }) {
  const isNetwork = event.type === 'network:request' || event.type === 'network:response';
  const isState =
    event.type === 'state:change' ||
    event.type === 'redux:action' ||
    event.type === 'bloc:transition';

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cmd+F inside an open inline detail focuses the local find input rather
  // than the global toolbar search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const fullPayloadText = useMemo(() => prettyJson(event.payload), [event]);
  const matchCount = useMemo(() => {
    if (!query) return 0;
    return countMatches(fullPayloadText, query);
  }, [fullPayloadText, query]);

  return (
    <div
      className="bg-bg-elevated/60 border-y border-border-subtle/60 text-text-primary"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 bg-bg-elevated">
        <LocalSearch
          ref={inputRef}
          value={query}
          onChange={setQuery}
          matchCount={matchCount}
          onClose={() => setQuery('')}
        />
      </div>
      {isNetwork ? (
        <NetworkDetail event={event} query={query} />
      ) : isState ? (
        <StateDetailWithQuery event={event} query={query} />
      ) : (
        <GenericDetail event={event} query={query} />
      )}
    </div>
  );
}

function StateDetailWithQuery({
  event,
  query,
}: {
  event: DebugEvent;
  query: string;
}) {
  if (!query) return <StateDetail event={event} />;
  const p = event.payload as StatePayload;
  return (
    <div>
      <div className="px-3 py-2 border-b border-border-subtle/60 text-[11px] text-text-secondary">
        {p.provider?.name ?? 'state'}
      </div>
      <div className="grid grid-cols-2 divide-x divide-border-subtle/60">
        <div className="px-3 py-2 max-h-[320px] overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
            Previous
          </div>
          <pre className="text-[11px] whitespace-pre-wrap break-words text-text-primary leading-relaxed">
{highlight(prettyJson(p.previous), query)}
          </pre>
        </div>
        <div className="px-3 py-2 max-h-[320px] overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
            Next
          </div>
          <pre className="text-[11px] whitespace-pre-wrap break-words text-text-primary leading-relaxed">
{highlight(prettyJson(p.next), query)}
          </pre>
        </div>
      </div>
    </div>
  );
}
