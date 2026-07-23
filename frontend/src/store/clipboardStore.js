import { create } from 'zustand';

export const useClipboardStore = create((set) => ({
    clipboard: { action: null, items: [] },
    setClipboard: (action, items) => set({ clipboard: { action, items } }),
    clearClipboard: () => set({ clipboard: { action: null, items: [] } })
}));
