const defaultRedactKeys = [
  'password',
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'secret',
  'token',
];

const _redacted = '[REDACTED]';

dynamic redact(dynamic value, List<String> keys) {
  if (keys.isEmpty) return value;
  final lowered = keys.map((k) => k.toLowerCase()).toList();

  dynamic walk(dynamic v) {
    if (v is Map) {
      final out = <String, dynamic>{};
      v.forEach((k, val) {
        final ks = k.toString();
        if (lowered.contains(ks.toLowerCase())) {
          out[ks] = _redacted;
        } else {
          out[ks] = walk(val);
        }
      });
      return out;
    }
    if (v is List) return v.map(walk).toList();
    return v;
  }

  return walk(value);
}
