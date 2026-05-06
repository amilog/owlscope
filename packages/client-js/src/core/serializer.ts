export function safeClone(value: unknown, maxDepth = 10): unknown {
  const seen = new WeakSet<object>();

  const walk = (val: unknown, depth: number): unknown => {
    if (depth > maxDepth) return '[MaxDepth]';
    if (val === null || val === undefined) return val;

    const t = typeof val;
    if (t === 'string' || t === 'number' || t === 'boolean') return val;
    if (t === 'bigint') return `${(val as bigint).toString()}n`;
    if (t === 'function') return `[Function: ${(val as Function).name || 'anonymous'}]`;
    if (t === 'symbol') return (val as symbol).toString();

    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack };
    }
    if (val instanceof Date) return { __type: 'Date', value: val.toISOString() };
    if (val instanceof RegExp) return { __type: 'RegExp', value: val.toString() };
    if (val instanceof Map) {
      return { __type: 'Map', entries: Array.from(val.entries()).slice(0, 100) };
    }
    if (val instanceof Set) {
      return { __type: 'Set', values: Array.from(val.values()).slice(0, 100) };
    }

    if (typeof val === 'object') {
      if (seen.has(val as object)) return '[Circular]';
      seen.add(val as object);

      if (Array.isArray(val)) {
        return val.slice(0, 200).map((item) => walk(item, depth + 1));
      }

      const out: Record<string, unknown> = {};
      const obj = val as Record<string, unknown>;
      const keys = Object.keys(obj).slice(0, 200);
      for (const key of keys) {
        try {
          out[key] = walk(obj[key], depth + 1);
        } catch {
          out[key] = '[Unserializable]';
        }
      }
      return out;
    }

    return String(val);
  };

  return walk(value, 0);
}

export function safeStringify(value: unknown, maxDepth = 10): string {
  try {
    return JSON.stringify(safeClone(value, maxDepth));
  } catch {
    return '"[Unserializable]"';
  }
}
