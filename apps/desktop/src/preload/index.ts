import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

export interface IncomingPayload {
  kind: string;
  [k: string]: unknown;
}

const api = {
  onIncoming(handler: (payload: IncomingPayload) => void): () => void {
    const listener = (_e: IpcRendererEvent, payload: IncomingPayload) => handler(payload);
    ipcRenderer.on('owlscope:incoming', listener);
    return () => ipcRenderer.off('owlscope:incoming', listener);
  },
  getClients(): Promise<unknown[]> {
    return ipcRenderer.invoke('owlscope:get-clients');
  },
  getServerStatus(): Promise<{ running: boolean; port: number; address: string }> {
    return ipcRenderer.invoke('owlscope:get-server-status');
  },
  restartServer(): Promise<boolean> {
    return ipcRenderer.invoke('owlscope:server:restart');
  },
  setAlwaysOnTop(value: boolean): Promise<boolean> {
    return ipcRenderer.invoke('owlscope:set-always-on-top', value);
  },
};

contextBridge.exposeInMainWorld('owlscope', api);

export type OwlScopeBridge = typeof api;
