import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { DebugEvent } from '@owlscope/protocol';

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
}: {
  data: Record<string, string> | undefined;
  empty: string;
}) {
  const entries = data ? Object.entries(data) : [];
  if (entries.length === 0) {
    return <div className="px-3 py-2 text-text-muted text-[11px]">{empty}</div>;
  }
  return (
    <div className="text-[11px] divide-y divide-border-subtle/40">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 px-3 py-1">
          <span className="w-32 shrink-0 text-text-muted">{k}</span>
          <span className="flex-1 break-all text-text-primary">{v}</span>
        </div>
      ))}
    </div>
  );
}

function BodyView({
  body,
  empty,
  showCopy = true,
  label = 'Body',
}: {
  body: unknown;
  empty: string;
  showCopy?: boolean;
  label?: string;
}) {
  if (body == null || body === '') {
    return (
      <>
        {showCopy && <SectionHeader label={label} />}
        <div className="px-3 py-2 text-text-muted text-[11px]">{empty}</div>
      </>
    );
  }
  const text = prettyJson(body);
  return (
    <>
      {showCopy && <SectionHeader label={label} copyText={text} />}
      <pre className="px-3 py-2 text-[11px] whitespace-pre-wrap break-all text-text-primary max-h-[360px] overflow-auto">
{text}
      </pre>
    </>
  );
}

interface StatePayload {
  provider?: { name?: string; argument?: string; family?: string };
  previous?: unknown;
  next?: unknown;
  type?: string;
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
          <pre className="px-3 py-2 text-[11px] whitespace-pre-wrap break-all text-text-primary max-h-[320px] overflow-auto">
{previousText || '–'}
          </pre>
        </div>
        <div className="min-w-0">
          <SectionHeader label="Next" copyText={nextText} />
          <pre className="px-3 py-2 text-[11px] whitespace-pre-wrap break-all text-text-primary max-h-[320px] overflow-auto">
{nextText || '–'}
          </pre>
        </div>
      </div>
    </div>
  );
}

type NetworkTab = 'headers' | 'request' | 'response' | 'timing';

function NetworkDetail({ event }: { event: DebugEvent }) {
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
                ? 'text-blue-400 border-b border-blue-500'
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
            <KeyValue data={p.requestHeaders} empty="No request headers." />
            <SectionHeader
              label="Response headers"
              copyText={headersToText(p.responseHeaders)}
            />
            <KeyValue data={p.responseHeaders} empty="No response headers." />
          </>
        )}
        {tab === 'request' && (
          <BodyView body={p.requestBody} empty="No request body." label="Request body" />
        )}
        {tab === 'response' &&
          (p.error ? (
            <>
              <SectionHeader label="Error" copyText={p.error} />
              <div className="px-3 py-2 text-owl-error text-[11px]">{p.error}</div>
            </>
          ) : (
            <BodyView
              body={p.responseBody}
              empty="No response body."
              label="Response body"
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

function GenericDetail({ event }: { event: DebugEvent }) {
  const json = useMemo(() => prettyJson(event.payload), [event]);
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

      <pre className="px-3 py-2 text-[11px] whitespace-pre-wrap break-all text-text-primary max-h-[360px] overflow-auto">
{json}
      </pre>

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
  return (
    <div className="bg-bg-elevated/60 border-y border-border-subtle/60 text-text-primary">
      {isNetwork ? (
        <NetworkDetail event={event} />
      ) : isState ? (
        <StateDetail event={event} />
      ) : (
        <GenericDetail event={event} />
      )}
    </div>
  );
}
