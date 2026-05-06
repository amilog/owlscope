export const DEFAULT_REDACT_KEYS = [
  'password',
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'secret',
  'token',
];

const REDACTED = '[REDACTED]';

export function redact<T>(value: T, keys: string[] = DEFAULT_REDACT_KEYS): T {
  if (keys.length === 0) return value;
  const lowered = keys.map((k) => k.toLowerCase());

  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(walk);

    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (lowered.includes(k.toLowerCase())) {
        out[k] = REDACTED;
      } else {
        out[k] = walk(val);
      }
    }
    return out;
  };

  return walk(value) as T;
}
