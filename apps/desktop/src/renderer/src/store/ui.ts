import { create } from 'zustand';

export type PanelKey =
  | 'logs'
  | 'network'
  | 'state'
  | 'errors'
  | 'timeline'
  | 'performance';

export type EventOrder = 'newest-bottom' | 'newest-top';

const ORDER_KEY = 'owlscope.eventOrder';

function loadOrder(): EventOrder {
  try {
    const v = localStorage.getItem(ORDER_KEY);
    if (v === 'newest-bottom' || v === 'newest-top') return v;
  } catch {
    /* ignore */
  }
  return 'newest-bottom';
}

interface UIState {
  activePanel: PanelKey;
  order: EventOrder;
  setPanel: (p: PanelKey) => void;
  setOrder: (o: EventOrder) => void;
  toggleOrder: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activePanel: 'logs',
  order: loadOrder(),
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
}));
