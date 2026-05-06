import type { OwlScopeClientApi, OwlScopePlugin } from '../types.js';
import { uuidv4 } from '../core/uuid.js';

export interface NetworkXhrPluginOptions {
  ignore?: (RegExp | string)[];
}

interface XhrMeta {
  method: string;
  url: string;
  correlationId: string;
  startTime: number;
  startPerf: number;
  requestBody: unknown;
  requestHeaders: Record<string, string>;
}

const META_KEY = '__owlscopeMeta';

function shouldIgnore(url: string, ignore: (RegExp | string)[]): boolean {
  for (const rule of ignore) {
    if (typeof rule === 'string' && url.includes(rule)) return true;
    if (rule instanceof RegExp && rule.test(url)) return true;
  }
  return false;
}

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class NetworkXhrPlugin implements OwlScopePlugin {
  name = 'network-xhr';
  private originalOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalSend: typeof XMLHttpRequest.prototype.send | null = null;
  private originalSetHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null = null;
  private ignore: (RegExp | string)[];

  constructor(opts: NetworkXhrPluginOptions = {}) {
    this.ignore = opts.ignore ?? [];
  }

  install(client: OwlScopeClientApi): void {
    if (typeof XMLHttpRequest === 'undefined') return;
    const ignore = this.ignore;

    this.originalOpen = XMLHttpRequest.prototype.open;
    this.originalSend = XMLHttpRequest.prototype.send;
    this.originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

    const origOpen = this.originalOpen;
    const origSend = this.originalSend;
    const origSetHeader = this.originalSetHeader;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      const meta: XhrMeta = {
        method: method.toUpperCase(),
        url: typeof url === 'string' ? url : url.toString(),
        correlationId: uuidv4(),
        startTime: Date.now(),
        startPerf:
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now(),
        requestBody: null,
        requestHeaders: {},
      };
      (this as unknown as Record<string, unknown>)[META_KEY] = meta;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-rest-params
      return origOpen.apply(this, [method, url, ...(rest as [])] as any);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (
      this: XMLHttpRequest,
      name: string,
      value: string,
    ) {
      const meta = (this as unknown as Record<string, unknown>)[META_KEY] as XhrMeta | undefined;
      if (meta) meta.requestHeaders[name] = value;
      return origSetHeader.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const meta = (this as unknown as Record<string, unknown>)[META_KEY] as XhrMeta | undefined;
      if (!meta) return origSend.call(this, body as XMLHttpRequestBodyInit | null);

      if (shouldIgnore(meta.url, ignore)) {
        return origSend.call(this, body as XMLHttpRequestBodyInit | null);
      }

      meta.requestBody =
        typeof body === 'string'
          ? tryJson(body)
          : body == null
            ? null
            : `[${(body as object).constructor.name}]`;

      const onLoadEnd = () => {
        const duration = Math.round(
          (typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()) - meta.startPerf,
        );

        const status = this.status;
        const statusText = this.statusText;
        const ok = status >= 200 && status < 300;
        const responseHeaders = parseHeaders(this.getAllResponseHeaders());
        let responseBody: unknown;
        try {
          const ct = (responseHeaders['content-type'] || '').toLowerCase();
          if (ct.includes('application/json')) {
            responseBody = tryJson(this.responseText);
          } else if (this.responseType && this.responseType !== 'text') {
            responseBody = `[${this.responseType} response]`;
          } else {
            responseBody = this.responseText;
          }
        } catch {
          responseBody = '[unreadable]';
        }

        client.emit({
          type: 'network:response',
          level: ok ? undefined : status === 0 ? 'error' : 'warn',
          payload: {
            method: meta.method,
            url: meta.url,
            status,
            statusText,
            ok,
            duration,
            startedAt: meta.startTime,
            requestHeaders: meta.requestHeaders,
            requestBody: meta.requestBody,
            responseHeaders,
            responseBody,
          },
          meta: { duration, correlationId: meta.correlationId },
        });

        this.removeEventListener('loadend', onLoadEnd);
      };

      this.addEventListener('loadend', onLoadEnd);
      return origSend.call(this, body as XMLHttpRequestBodyInit | null);
    };
  }

  uninstall(): void {
    if (typeof XMLHttpRequest === 'undefined') return;
    if (this.originalOpen) XMLHttpRequest.prototype.open = this.originalOpen;
    if (this.originalSend) XMLHttpRequest.prototype.send = this.originalSend;
    if (this.originalSetHeader) XMLHttpRequest.prototype.setRequestHeader = this.originalSetHeader;
    this.originalOpen = null;
    this.originalSend = null;
    this.originalSetHeader = null;
  }
}
