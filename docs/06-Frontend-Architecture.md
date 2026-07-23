# Frontend Architecture

## 1. Core Stack
- **Framework**: React JS (No TypeScript)
- **Bundler**: Vite
- **Routing**: React Router DOM (v6+)
- **State Management**: 
  - Server State: TanStack Query (React Query)
  - Client UI State: Zustand
- **Styling**: TailwindCSS (Neubrutalism aesthetic)
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion
- **Icons**: Heroicons
- **HTTP Client**: Axios

## 2. Directory Structure
```text
/src
  /assets        # Images, global CSS
  /components    # Reusable UI components (Buttons, Modals, Inputs)
  /features      # Feature-based modules (Folder, File, Upload, Share)
  /hooks         # Reusable custom hooks (useAuth, useUpload, useCOS)
  /layouts       # Page layouts (Sidebar, Navbar, MainContent)
  /pages         # Route-level components
  /services      # API wrappers (Axios instances, auth logic)
  /store         # Zustand stores (UI state, Drag-Drop state)
  /utils         # Helpers (date formatting, byte conversion)
```

## 3. Neubrutalism Design Guidelines
- **Colors**: Vibrant, high-contrast primary colors (yellow, pink, cyan) against stark white and black.
- **Borders**: Thick black borders (`border-4 border-black`).
- **Shadows**: Hard, non-blurred drop shadows (`shadow-[4px_4px_0_0_#000]`).
- **Typography**: Large, bold, sans-serif fonts (e.g., Space Grotesk or Inter).
- **Interactions**: Button presses compress the hard shadow.

## 4. File Upload Flow (Frontend View)
1. User drops file into Dropzone.
2. Zustand `useUploadStore` adds file to queue.
3. Component mounts progress bar.
4. TanStack Query calls Backend API to create `upload_session` and get STS credentials or Pre-signed URL.
5. Axios uploads directly to Tencent COS URL in chunks.
6. Upon completion, Backend is notified to finalize file metadata.

## 5. Reusable Components
- `NeuButton`: Button with Neubrutalist styling.
- `NeuCard`: Card container.
- `NeuInput`: Input field.
- `ContextMenu`: 3-dot dropdown logic.
- `FilePreview`: Modal rendering PDF, Image, Video, or fallback icons.
