import { create } from 'zustand';
import type { DebugEvent, EventType, LogLevel } from '@owlscope/protocol';

const MAX_EVENTS = 50_000;

export interface Filters {
  types: Set<EventType>;
  /** Event types the user has toggled off via the Timeline type pills.
   *  Default empty — every type visible. Only matchEvent (Timeline) checks
   *  this; per-panel filters (matchSearch) ignore it so a hidden type on
   *  Timeline doesn't silently empty the Network/State/Performance panels. */
  excludedTypes: Set<string>;
  levels: Set<LogLevel>;
  search: string;
  clientId: string | null;
}

interface EventsState {
  events: DebugEvent[];
  /** Every row whose inline detail is currently open. Multiple events can
   *  be expanded at once so the user can compare two requests / states /
   *  errors side-by-side. */
  expandedEventIds: Set<string>;
  isPaused: boolean;
  filters: Filters;

  addEvent: (event: DebugEvent) => void;
  addEvents: (events: DebugEvent[]) => void;
  toggleExpand: (id: string) => void;
  collapseAll: () => void;
  clearEvents: () => void;
  togglePause: () => void;
  setSearch: (search: string) => void;
  toggleType: (type: EventType) => void;
  toggleTypeGroup: (types: string[]) => void;
  toggleLevel: (level: LogLevel) => void;
  setClientFilter: (clientId: string | null) => void;
  resetFilters: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  expandedEventIds: new Set<string>(),
  isPaused: false,
  filters: {
    types: new Set<EventType>(),
    excludedTypes: new Set<string>(),
    levels: new Set<LogLevel>(),
    search: '',
    clientId: null,
  },

  addEvent: (event) => {
    if (get().isPaused) return;
    set((s) => {
      const next = s.events.length >= MAX_EVENTS ? s.events.slice(-MAX_EVENTS + 1) : s.events;
      return { events: [...next, event] };
    });
  },

  addEvents: (events) => {
    if (get().isPaused || events.length === 0) return;
    set((s) => {
      const combined = s.events.concat(events);
      const trimmed =
        combined.length > MAX_EVENTS ? combined.slice(combined.length - MAX_EVENTS) : combined;
      return { events: trimmed };
    });
  },

  toggleExpand: (id) =>
    set((s) => {
      const next = new Set(s.expandedEventIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedEventIds: next };
    }),

  collapseAll: () => set({ expandedEventIds: new Set<string>() }),

  clearEvents: () =>
    set({ events: [], expandedEventIds: new Set<string>() }),

  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),

  setSearch: (search) =>
    set((s) => ({ filters: { ...s.filters, search } })),

  toggleType: (type) =>
    set((s) => {
      const types = new Set(s.filters.types);
      if (types.has(type)) types.delete(type);
      else types.add(type);
      return { filters: { ...s.filters, types } };
    }),

  /** Toggle a group of event types as visible/hidden in the Timeline. If any
   *  of the group is currently visible, hide them all; otherwise re-show them. */
  toggleTypeGroup: (groupTypes) =>
    set((s) => {
      const next = new Set(s.filters.excludedTypes);
      const allHidden = groupTypes.every((t) => next.has(t));
      if (allHidden) groupTypes.forEach((t) => next.delete(t));
      else groupTypes.forEach((t) => next.add(t));
      return { filters: { ...s.filters, excludedTypes: next } };
    }),

  toggleLevel: (level) =>
    set((s) => {
      const levels = new Set(s.filters.levels);
      if (levels.has(level)) levels.delete(level);
      else levels.add(level);
      return { filters: { ...s.filters, levels } };
    }),

  setClientFilter: (clientId) =>
    set((s) => ({ filters: { ...s.filters, clientId } })),

  resetFilters: () =>
    set({
      filters: {
        types: new Set(),
        excludedTypes: new Set(),
        levels: new Set(),
        search: '',
        clientId: null,
      },
    }),
}));

/** Console events whose entire body is just frame-drawing characters
 *  (box edges, ASCII rules) or ANSI colour escapes. Pretty-print loggers
 *  like Dio's `PrettyDioLogger` emit one of these for every line of their
 *  banner, which clutters the list but adds zero information. We hide them
 *  from panel listings — they're still in the underlying events store so
 *  counts stay correct. */
export function isNoiseConsole(event: DebugEvent): boolean {
  if (event.type !== 'console') return false;
  const args = (event.payload as { args?: unknown[] } | null)?.args;
  if (!Array.isArray(args) || args.length === 0) return true;
  const text = args
    .map((a) => (typeof a === 'string' ? a : ''))
    .join(' ')
    // Strip ANSI escape codes — Dio's logger wraps lines in colour codes.
    .replace(/\x1b\[[\d;]*m/g, '')
    .replace(/\[\d+(;\d+)*m/g, '');
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Box drawing block U+2500–U+259F + common ASCII separators / pipes / dots.
  return /^[─-▟\s|\-=_+*.·●○•]+$/.test(trimmed);
}

export function compileSearch(search: string): RegExp | string | null {
  if (!search) return null;
  const m = /^\/(.+)\/([gimsuy]*)$/.exec(search);
  if (m) {
    try {
      return new RegExp(m[1], m[2]);
    } catch {
      return search;
    }
  }
  return search.toLowerCase();
}

/** Search + client + type checks. Used by every panel. */
function matchSearchAndClient(event: DebugEvent, filters: Filters): boolean {
  if (filters.types.size > 0 && !filters.types.has(event.type)) return false;
  if (filters.clientId && event.clientId !== filters.clientId) return false;
  if (filters.search) {
    const compiled = compileSearch(filters.search);
    if (compiled === null) return true;
    const blob =
      `${event.type} ${event.level ?? ''} ${event.source} ${JSON.stringify(event.payload)}`.toLowerCase();
    if (compiled instanceof RegExp) {
      if (!compiled.test(blob)) return false;
    } else if (!blob.includes(compiled)) {
      return false;
    }
  }
  return true;
}

/** Full match including level + type pills. Used by Timeline. Both pill
 *  sets hold the selections the user has *toggled off* — default empty
 *  means everything is visible. Events without a level (Network, State,
 *  Performance) bypass the level pills. */
export function matchEvent(event: DebugEvent, filters: Filters): boolean {
  if (!matchSearchAndClient(event, filters)) return false;
  if (event.level && filters.levels.has(event.level)) return false;
  if (filters.excludedTypes.has(event.type)) return false;
  return true;
}

/** Filter without the level pills — for panels whose events have no
 *  `level` (Network, State, Performance). */
export function matchSearch(event: DebugEvent, filters: Filters): boolean {
  return matchSearchAndClient(event, filters);
}
