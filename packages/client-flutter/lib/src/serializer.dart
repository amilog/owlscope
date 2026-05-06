const _maxDepth = 10;
const _maxKeys = 200;

/// Convert any Dart value into a JSON-safe structure (no circular refs,
/// functions stripped, depth-limited).
dynamic safeClone(dynamic value, {int depth = 0, Set<Object>? seen}) {
  if (depth > _maxDepth) return '[MaxDepth]';
  if (value == null) return null;
  if (value is num || value is bool || value is String) return value;
  if (value is BigInt) return '${value.toString()}n';
  if (value is DateTime) return {'__type': 'DateTime', 'value': value.toIso8601String()};
  if (value is Duration) return {'__type': 'Duration', 'ms': value.inMilliseconds};
  if (value is RegExp) return {'__type': 'RegExp', 'pattern': value.pattern};

  seen ??= <Object>{};

  if (value is Iterable) {
    if (seen.contains(value)) return '[Circular]';
    seen.add(value);
    final list = value.take(200).toList();
    return list.map((e) => safeClone(e, depth: depth + 1, seen: seen)).toList();
  }

  if (value is Map) {
    if (seen.contains(value)) return '[Circular]';
    seen.add(value);
    final out = <String, dynamic>{};
    var i = 0;
    for (final entry in value.entries) {
      if (i++ >= _maxKeys) break;
      final key = entry.key.toString();
      out[key] = safeClone(entry.value, depth: depth + 1, seen: seen);
    }
    return out;
  }

  // Fallback: stringify other objects.
  try {
    return value.toString();
  } catch (_) {
    return '[Unserializable]';
  }
}
