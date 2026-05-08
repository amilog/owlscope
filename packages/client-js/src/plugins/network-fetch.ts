import type { OwlScopeClientApi, OwlScopePlugin } from '../types.js';
import { uuidv4 } from '../core/uuid.js';

const MAX_BODY_BYTES = 64 * 1024;

export interface NetworkFetchPluginOptions {
  ignore?: (RegExp | string)[];
}

function shouldIgnore(url: string, ignore: (RegExp | string)[]): boolean {
  for (const rule of ignore) {
    if (typeof rule === 'string' && url.includes(rule)) return true;
    if (rule instanceof RegExp && rule.test(url)) return true;
  }
  return false;
}

function headersToObject(input: HeadersInit | Headers | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  if (typeof Headers !== 'undefined' && input instanceof Headers) {
    input.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(input)) {
    for (const pair of input) {
      if (Array.isArray(pair) && pair.length === 2) out[String(pair[0])] = String(pair[1]);
    }
    return out;
  }
  for (const [k, v] of Object.entries(input as Record<string, string>)) {
    out[k] = v;
  }
  return out;
}

function truncate(text: string): { value: string; truncated: boolean } {
  if (text.length <= MAX_BODY_BYTES) return { value: text, truncated: false };
  return { value: text.slice(0, MAX_BODY_BYTES), truncated: true };
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readRequestBody(body: BodyInit | null | undefined): Promise<unknown> {
  if (body == null) return null;
  if (typeof body === 'string') {
    const { value, truncated } = truncate(body);
    return truncated ? { __truncated: true, value: tryJson(value) } : tryJson(value);
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const out: Record<string, unknown> = {};
    body.forEach((v, k) => {
      out[k] = typeof v === 'string' ? v : `[File: ${(v as File).name}]`;
    });
    return out;
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries());
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return `[Blob: ${body.size} bytes, ${body.type || 'unknown'}]`;
  }
  if (body instanceof ArrayBuffer) {
    return `[ArrayBuffer: ${body.byteLength} bytes]`;
  }
  return '[Unknown body]';
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const text = await response.text();
      const { value, truncated } = truncate(text);
      const parsed = tryJson(value);
      return truncated ? { __truncated: true, value: parsed } : parsed;
    }
    if (contentType.startsWith('text/') || contentType.includes('xml') || contentType.includes('javascript')) {
      const text = await response.text();
      const { value, truncated } = truncate(text);
      return truncated ? { __truncated: true, value } : value;
    }
    const blob = await response.blob();
    return `[Binary: ${blob.size} bytes, ${blob.type || 'unknown'}]`;
  } catch (err) {
    return `[Failed to read body: ${(err as Error).message}]`;
  }
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== 'string' && !(input instanceof URL)) return input.method.toUpperCase();
  return 'GET';
}

export class NetworkFetchPlugin implements OwlScopePlugin {
  name = 'network-fetch';
  private original: typeof fetch | null = null;
  private ignore: (RegExp | string)[];

  constructor(opts: NetworkFetchPluginOptions = {}) {
    this.ignore = opts.ignore ?? [];
  }

  install(client: OwlScopeClientApi): void {
    // `globalThis.fetch` works in browser, Node 18+, React Native (Hermes
    // and JSC), Electron, and Web Workers — anywhere fetch is available.
    const g = globalThis as unknown as { fetch?: typeof fetch };
    if (typeof g.fetch !== 'function') return;
    const original = g.fetch.bind(globalThis);
    this.original = original;

    g.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = resolveUrl(input);
      const method = resolveMethod(input, init);

      if (shouldIgnore(url, this.ignore)) {
        return original(input as RequestInfo, init);
      }

      const correlationId = uuidv4();
      const startTime = Date.now();
      const startPerf =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : startTime;

      const requestHeaders = headersToObject(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      const requestBody = init?.body
        ? await readRequestBody(init.body).catch(() => null)
        : input instanceof Request
          ? '[Request body]'
          : null;

      try {
        const response = await original(input as RequestInfo, init);
        const duration = Math.round(
          (typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()) - startPerf,
        );

        const clone = response.clone();
        const responseHeaders = headersToObject(clone.headers);
        const responseBody = await readResponseBody(clone);

        client.emit({
          type: 'network:response',
          level: response.ok ? undefined : 'warn',
          payload: {
            method,
            url,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            duration,
            startedAt: startTime,
            requestHeaders,
            requestBody,
            responseHeaders,
            responseBody,
          },
          meta: { duration, correlationId },
        });

        return response;
      } catch (err) {
        const duration = Math.round(
          (typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()) - startPerf,
        );
        client.emit({
          type: 'network:response',
          level: 'error',
          payload: {
            method,
            url,
            status: 0,
            error: (err as Error).message,
            duration,
            startedAt: startTime,
            requestHeaders,
            requestBody,
          },
          meta: { duration, correlationId },
        });
        throw err;
      }
    };
  }

  uninstall(): void {
    if (this.original) {
      (globalThis as unknown as { fetch?: typeof fetch }).fetch = this.original;
    }
    this.original = null;
  }
}
