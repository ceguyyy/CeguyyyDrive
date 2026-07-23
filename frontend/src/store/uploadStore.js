import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUploadStore = create(
    persist(
        (set) => ({
    uploads: {},
    addUpload: (id, name) => set((state) => ({
        uploads: {
            ...state.uploads,
            [id]: { name, progress: 0, status: 'uploading' }
        }
    })),
    updateProgress: (id, progress) => set((state) => ({
        uploads: {
            ...state.uploads,
            [id]: { ...state.uploads[id], progress }
        }
    })),
    setStatus: (id, status) => set((state) => ({
        uploads: {
            ...state.uploads,
            [id]: { ...state.uploads[id], status }
        }
    })),
    removeUpload: (id) => set((state) => {
        const newUploads = { ...state.uploads };
        delete newUploads[id];
        return { uploads: newUploads };
    })
}),
{
    name: 'upload-logs-storage', // name of the item in the storage (must be unique)
}
));
