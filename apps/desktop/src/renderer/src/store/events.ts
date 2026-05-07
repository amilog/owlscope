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
  selectedEventId: string | null;
  isPaused: boolean;
  filters: Filters;

  addEvent: (event: DebugEvent) => void;
  addEvents: (events: DebugEvent[]) => void;
  selectEvent: (id: string | null) => void;
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
  selectedEventId: null,
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

  selectEvent: (id) => set({ selectedEventId: id }),

  clearEvents: () => set({ events: [], selectedEventId: null }),

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
