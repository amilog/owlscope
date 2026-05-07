/**
 * Pretty-print Dart `toString()`-style output, e.g.
 *   `{id: 8, title: Hi, items: [{a: 1}, {b: 2}], meta: {x: y}}`
 * into:
 *   {
 *     id: 8,
 *     title: Hi,
 *     items: [
 *       {a: 1},
 *       {b: 2}
 *     ],
 *     meta: {x: y}
 *   }
 *
 * Heuristic — does not parse structure, just inserts newlines + indentation at
 * sensible boundaries. Robust against most well-formed Dart map/list output;
 * stays as-is if the input doesn't contain { } [ ] structure.
 */
export function prettyDartLike(input: string): string {
  if (!input.includes('{') && !input.includes('[')) return input;

  const indent = (n: number) => '  '.repeat(Math.max(0, n));
  let out = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let i = 0;

  while (i < input.length) {
    const c = input[i];
    const prev = i > 0 ? input[i - 1] : '';

    if (inSingle) {
      out += c;
      if (c === "'" && prev !== '\\') inSingle = false;
    } else if (inDouble) {
      out += c;
      if (c === '"' && prev !== '\\') inDouble = false;
    } else if (c === "'") {
      out += c;
      inSingle = true;
    } else if (c === '"') {
      out += c;
      inDouble = true;
    } else if (c === '{' || c === '[') {
      depth++;
      out += c + '\n' + indent(depth);
    } else if (c === '}' || c === ']') {
      depth = Math.max(0, depth - 1);
      out = out.replace(/[ \t]+$/, '');
      out += '\n' + indent(depth) + c;
    } else if (c === ',' && (input[i + 1] === ' ' || input[i + 1] === undefined)) {
      out += ',\n' + indent(depth);
      // skip the space after comma if any
      if (input[i + 1] === ' ') i++;
    } else {
      out += c;
    }
    i++;
  }

  return out
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');
}
