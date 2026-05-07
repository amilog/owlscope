import { Fragment, type ReactNode } from 'react';

/**
 * Split [text] by [query] (case-insensitive) and return ReactNode[] with
 * matches wrapped in <mark>. Returns the text as-is if query is empty.
 */
export function highlight(text: string, query: string): ReactNode {
  if (!query) return text;

  let pattern: RegExp;
  const re = /^\/(.+)\/([gimsuy]*)$/.exec(query);
  if (re) {
    try {
      pattern = new RegExp(re[1], (re[2] ?? '') + (re[2]?.includes('g') ? '' : 'g'));
    } catch {
      pattern = new RegExp(escapeRegExp(query), 'gi');
    }
  } else {
    pattern = new RegExp(escapeRegExp(query), 'gi');
  }

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <mark
        key={`m-${i++}`}
        className="bg-amber-400/40 text-text-primary rounded-sm px-0.5"
      >
        {match[0]}
      </mark>,
    );
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex++;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <Fragment>{parts}</Fragment>;
}

export function countMatches(text: string, query: string): number {
  if (!query) return 0;
  let pattern: RegExp;
  const re = /^\/(.+)\/([gimsuy]*)$/.exec(query);
  try {
    pattern = re
      ? new RegExp(re[1], (re[2] ?? '') + (re[2]?.includes('g') ? '' : 'g'))
      : new RegExp(escapeRegExp(query), 'gi');
  } catch {
    return 0;
  }
  let count = 0;
  while (pattern.exec(text)) {
    count++;
    if (pattern.lastIndex === pattern.lastIndex - 0) {
      pattern.lastIndex++;
    }
  }
  return count;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
