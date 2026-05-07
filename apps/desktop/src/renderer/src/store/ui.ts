import { create } from 'zustand';

export type PanelKey =
  | 'home'
  | 'logs'
  | 'network'
  | 'state'
  | 'errors'
  | 'timeline'
  | 'performance';

export type EventOrder = 'newest-bottom' | 'newest-top';

const ORDER_KEY = 'owlscope.eventOrder';
const PIN_KEY = 'owlscope.alwaysOnTop';

function loadOrder(): EventOrder {
  try {
    const v = localStorage.getItem(ORDER_KEY);
    if (v === 'newest-bottom' || v === 'newest-top') return v;
  } catch {
    /* ignore */
  }
  return 'newest-bottom';
}

function loadPin(): boolean {
  try {
    return localStorage.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
}

interface UIState {
  activePanel: PanelKey;
  order: EventOrder;
  alwaysOnTop: boolean;
  sidebarCollapsed: boolean;
  setPanel: (p: PanelKey) => void;
  setOrder: (o: EventOrder) => void;
  toggleOrder: () => void;
  toggleAlwaysOnTop: () => Promise<void>;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activePanel: 'home',
  order: loadOrder(),
  alwaysOnTop: loadPin(),
  sidebarCollapsed: false,
  setPanel: (p) => set({ activePanel: p }),
  setOrder: (order) => {
    try {
      localStorage.setItem(ORDER_KEY, order);
    } catch {
      /* ignore */
    }
    set({ order });
  },
  toggleOrder: () => {
    const next: EventOrder =
      get().order === 'newest-bottom' ? 'newest-top' : 'newest-bottom';
    try {
      localStorage.setItem(ORDER_KEY, next);
    } catch {
      /* ignore */
    }
    set({ order: next });
  },
  toggleAlwaysOnTop: async () => {
    const next = !get().alwaysOnTop;
    const applied =
      typeof window !== 'undefined' && window.owlscope
        ? await window.owlscope.setAlwaysOnTop(next)
        : next;
    try {
      localStorage.setItem(PIN_KEY, applied ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ alwaysOnTop: applied });
  },
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}));
