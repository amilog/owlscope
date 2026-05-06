import { create } from 'zustand';
import type { ConnectedClient } from '@owlscope/protocol';

interface ClientsState {
  clients: Record<string, ConnectedClient>;
  serverRunning: boolean;
  serverAddress: string;
  addClient: (client: ConnectedClient) => void;
  removeClient: (clientId: string) => void;
  setServerStatus: (running: boolean, address: string) => void;
}

export const useClientsStore = create<ClientsState>((set) => ({
  clients: {},
  serverRunning: false,
  serverAddress: 'ws://localhost:9090',
  addClient: (client) =>
    set((s) => ({ clients: { ...s.clients, [client.clientId]: client } })),
  removeClient: (clientId) =>
    set((s) => {
      const next = { ...s.clients };
      delete next[clientId];
      return { clients: next };
    }),
  setServerStatus: (running, address) =>
    set({ serverRunning: running, serverAddress: address }),
}));
