import { create } from 'zustand';
import type { DebugEvent, EventType, LogLevel } from '@owlscope/protocol';

const MAX_EVENTS = 50_000;

export interface Filters {
  types: Set<EventType>;
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
      filters: { types: new Set(), levels: new Set(), search: '', clientId: null },
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

export function matchEvent(event: DebugEvent, filters: Filters): boolean {
  if (filters.types.size > 0 && !filters.types.has(event.type)) return false;
  if (filters.levels.size > 0) {
    if (!event.level || !filters.levels.has(event.level)) return false;
  }
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
